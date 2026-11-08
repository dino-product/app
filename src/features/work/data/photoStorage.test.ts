import { PhotoUploadError } from './errors';
import { createPhotoStorage } from './photoStorage';
import type { PhotoUploadRequest, PhotoUploadResponse } from './types';

// 완료 보고 사진 한 장 올리기 (#155, ADR-007 직접 업로드): 기기 파일을 읽어 형식·크기로 주소를 받고, 그 주소에 바이트를 PUT 한다.
// 기기 파일 읽기와 저장소 PUT 은 fetch 하나로 하므로 테스트는 그 fetch 를 가짜로 준다

type FakeBlob = { size: number; type: string; close: jest.Mock };
const fakeBlob = (size: number, type = 'image/jpeg'): FakeBlob => ({
  size,
  type,
  close: jest.fn(),
});

const fileResponse = (blob: FakeBlob) =>
  ({
    ok: true,
    status: 200,
    blob: async () => blob,
  } as unknown as Response);

const storageResponse = (status: number) =>
  ({ ok: status >= 200 && status < 300, status } as unknown as Response);

const UPLOAD_URL =
  'https://storage.example.com/incoming/file-1?X-Amz-Signature=abc';

const issued = (
  overrides: Partial<PhotoUploadResponse> = {},
): PhotoUploadResponse => ({
  fileId: 'file-1',
  uploadUrl: UPLOAD_URL,
  requiredHeaders: {
    'content-type': 'image/jpeg',
    'content-length': '2457600',
  },
  expiresAt: '2026-10-21T00:10:00Z',
  ...overrides,
});

// 저장소 주소에는 정한 상태로 답하고, 그 밖의 주소(file://·content://)는 기기 파일로 읽는다
function setup({
  blob = fakeBlob(2457600),
  storageStatus = 200,
}: { blob?: FakeBlob; storageStatus?: number } = {}) {
  const fetch = jest.fn(async (input: RequestInfo, _init?: RequestInit) =>
    input === UPLOAD_URL ? storageResponse(storageStatus) : fileResponse(blob),
  );
  const issue = jest.fn(async (_photo: PhotoUploadRequest) => issued());
  return {
    blob,
    fetch,
    issue,
    storage: createPhotoStorage({
      fetch: fetch as unknown as typeof globalThis.fetch,
    }),
  };
}

const putCall = (fetch: jest.Mock) =>
  fetch.mock.calls.find(([input]) => input === UPLOAD_URL);

describe('createPhotoStorage().upload', () => {
  it('기기 사진을 읽어 형식·크기로 주소를 받고, 서명된 헤더를 붙여 PUT 한 뒤 파일 식별자를 준다', async () => {
    const { storage, fetch, issue, blob } = setup();

    await expect(
      storage.upload('file:///tmp/photo-1.jpg', issue),
    ).resolves.toBe('file-1');

    expect(fetch).toHaveBeenCalledWith('file:///tmp/photo-1.jpg');
    expect(issue).toHaveBeenCalledWith({
      contentType: 'image/jpeg',
      sizeBytes: 2457600,
    });
    const [, init] = putCall(fetch)!;
    // content-length 는 HTTP 클라이언트가 본문 길이로 붙인다 (직접 붙이면 플랫폼마다 무시하거나 겹친다)
    expect(init).toMatchObject({
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      body: blob,
    });
    expect(init.headers).not.toHaveProperty('content-length');
  });

  it('다 올리면 읽어 둔 사진 바이트를 놓는다 (RN Blob.close)', async () => {
    const { storage, issue, blob } = setup();

    await storage.upload('file:///tmp/photo-1.jpg', issue);

    expect(blob.close).toHaveBeenCalled();
  });

  it.each([
    ['file:///tmp/a.png', 'image/png'],
    ['file:///tmp/a.JPG', 'image/jpeg'],
    ['file:///tmp/a.jpeg', 'image/jpeg'],
    ['file:///tmp/a.webp', 'image/webp'],
    ['file:///tmp/a.heic', 'image/heic'],
    ['file:///tmp/a.heif', 'image/heif'],
    ['content://media/picker/0/1', 'image/jpeg'],
  ])(
    '파일이 형식을 알려 주지 않으면 확장자로 정한다 (%s → %s)',
    async (uri, type) => {
      const { storage, issue } = setup({ blob: fakeBlob(10, '') });

      await storage.upload(uri, issue);

      expect(issue).toHaveBeenCalledWith({ contentType: type, sizeBytes: 10 });
    },
  );

  it('기기 파일을 읽지 못하면(OS 가 임시 파일을 지움) 주소를 받지 않고 읽기 오류다', async () => {
    const { storage, issue, fetch } = setup();
    fetch.mockRejectedValueOnce(new TypeError('Network request failed'));

    const error = await storage
      .upload('file:///tmp/gone.jpg', issue)
      .catch(e => e);

    expect(error).toBeInstanceOf(PhotoUploadError);
    expect(error.reason).toBe('unreadable');
    expect(issue).not.toHaveBeenCalled();
  });

  it('빈 파일이면 읽기 오류다 (서버는 1바이트 이상만 받는다)', async () => {
    const { storage, issue } = setup({ blob: fakeBlob(0) });

    const error = await storage
      .upload('file:///tmp/empty.jpg', issue)
      .catch(e => e);

    expect(error).toMatchObject({ reason: 'unreadable' });
    expect(issue).not.toHaveBeenCalled();
  });

  it('주소 발급이 실패하면 그 오류를 그대로 주고 PUT 하지 않는다', async () => {
    const { storage, issue, fetch, blob } = setup();
    const rejected = new Error('SCHEDULE-023');
    issue.mockRejectedValueOnce(rejected);

    await expect(storage.upload('file:///tmp/photo-1.jpg', issue)).rejects.toBe(
      rejected,
    );
    expect(putCall(fetch)).toBeUndefined();
    expect(blob.close).toHaveBeenCalled();
  });

  it.each([403, 500])('저장소가 %i 로 거부하면 업로드 오류다', async status => {
    const { storage, issue } = setup({ storageStatus: status });

    const error = await storage
      .upload('file:///tmp/photo-1.jpg', issue)
      .catch(e => e);

    expect(error).toBeInstanceOf(PhotoUploadError);
    expect(error.reason).toBe('failed');
  });

  it('저장소에 닿지 못하면 업로드 오류다', async () => {
    const { storage, issue, fetch } = setup();
    fetch.mockImplementation(async (input: RequestInfo) => {
      if (String(input).startsWith('file://')) {
        return fileResponse(fakeBlob(10));
      }
      throw new TypeError('Network request failed');
    });

    const error = await storage
      .upload('file:///tmp/photo-1.jpg', issue)
      .catch(e => e);

    expect(error).toMatchObject({ reason: 'failed' });
  });

  it('저장소가 답하지 않으면 제한 시간 뒤 요청을 끊고 업로드 오류다', async () => {
    const fetch = jest.fn(
      (input: RequestInfo, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          if (String(input).startsWith('file://')) {
            resolve(fileResponse(fakeBlob(10)));
            return;
          }
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
          );
        }),
    );
    const storage = createPhotoStorage({
      fetch: fetch as unknown as typeof globalThis.fetch,
      timeoutMs: 20,
    });

    const error = await storage
      .upload('file:///tmp/photo-1.jpg', async () => issued())
      .catch(e => e);

    expect(error).toMatchObject({ reason: 'failed' });
  });
});
