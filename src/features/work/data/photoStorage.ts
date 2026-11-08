import { PhotoUploadError } from './errors';
import type { PhotoUploadRequest, PhotoUploadResponse } from './types';

// 완료 보고 사진 한 장을 오브젝트 저장소에 바로 올린다 (#155, 백엔드 ADR-007 직접 업로드). 사용법:
//   const fileId = await photoStorage.upload(uri, photo => api.post(발급 경로, photo))
// 1) 기기 파일(촬영·앨범의 file://·content://)을 읽어 형식·크기를 알고 2) 그 값으로 업로드 주소를 받고(issue)
// 3) 주소에 requiredHeaders 를 붙여 바이트를 PUT 한다. 사진 바이트는 API 서버를 거치지 않는다.
// 기기 파일 읽기와 PUT 은 RN fetch(Blob)로 한다. 테스트는 fetch 를 가짜로 준다

/** 저장소 PUT 이 이만큼 답이 없으면 끊는다. 사진은 장당 수 MB 라 API 요청(15초)보다 길게 둔다 */
export const PHOTO_UPLOAD_TIMEOUT_MS = 60 * 1000;

export type PhotoStorage = {
  /** 기기 사진 한 장을 올리고 파일 식별자를 준다. issue 는 형식·크기로 업로드 주소를 받는다(발급 실패는 그 오류 그대로) */
  upload(
    uri: string,
    issue: (photo: PhotoUploadRequest) => Promise<PhotoUploadResponse>,
  ): Promise<string>;
};

// 파일이 형식을 알려 주지 않을 때 확장자로 정한다. 서버는 JPEG·PNG·WebP·HEIC/HEIF 만 받는다.
// 촬영·앨범은 JPEG 로 받으므로(photoPicker 'compatible') 확장자가 없으면 JPEG 다
const typesByExtension: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

function contentTypeOf(uri: string, blob: Blob): string {
  if (blob.type) {
    return blob.type;
  }
  const extension = /\.([a-z0-9]+)$/i.exec(uri.split(/[?#]/)[0])?.[1];
  return typesByExtension[extension?.toLowerCase() ?? ''] ?? 'image/jpeg';
}

// RN Blob 은 네이티브 메모리를 잡고 있어 다 쓰면 놓는다 (웹 Blob 에는 close 가 없다)
const release = (blob: Blob) =>
  (blob as Blob & { close?: () => void }).close?.();

// content-length 는 HTTP 클라이언트가 본문 길이로 붙인다 (서명한 크기와 같다). 직접 붙이면 플랫폼마다 무시하거나 겹친다
const withoutContentLength = (headers: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) => name.toLowerCase() !== 'content-length',
    ),
  );

export function createPhotoStorage({
  fetch: fetchImpl,
  timeoutMs = PHOTO_UPLOAD_TIMEOUT_MS,
}: {
  /** 없으면 부를 때의 전역 fetch */
  fetch?: typeof fetch;
  timeoutMs?: number;
} = {}): PhotoStorage {
  const callFetch: typeof fetch =
    fetchImpl ?? ((input, init) => fetch(input, init));

  async function read(uri: string): Promise<Blob> {
    let blob: Blob;
    try {
      blob = await (await callFetch(uri)).blob();
    } catch {
      throw new PhotoUploadError('unreadable');
    }
    if (blob.size < 1) {
      release(blob);
      throw new PhotoUploadError('unreadable');
    }
    return blob;
  }

  async function put(
    { uploadUrl, requiredHeaders }: PhotoUploadResponse,
    body: Blob,
  ) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await callFetch(uploadUrl, {
        method: 'PUT',
        headers: withoutContentLength(requiredHeaders),
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new PhotoUploadError('failed');
      }
    } catch (error) {
      throw error instanceof PhotoUploadError
        ? error
        : new PhotoUploadError('failed');
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async upload(uri, issue) {
      const body = await read(uri);
      try {
        const target = await issue({
          contentType: contentTypeOf(uri, body),
          sizeBytes: body.size,
        });
        await put(target, body);
        return target.fileId;
      } finally {
        release(body);
      }
    },
  };
}
