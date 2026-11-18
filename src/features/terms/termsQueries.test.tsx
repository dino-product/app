import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createFakeServer, rawResponse } from '../../shared/testing/fakeServer';
import { createTestApi } from '../../shared/testing/renderWithApi';
import { termsDocumentUrl, type TermsDocument } from './documents';
import { termsText, withTermsDocuments } from './testing';
import { TERMS_LOAD_FAILED, useTermsDocuments } from './termsQueries';

// 약관 전문 조회 (#192). 받는 동안 loading(화면은 스켈레톤), 받으면 덩어리, 실패하면 다시 시도할 수 있는 안내
const serviceUrl = termsDocumentUrl('service');

async function renderDocuments(
  documents: readonly (TermsDocument | null)[],
  server = withTermsDocuments(createFakeServer()),
) {
  const api = createTestApi({ server });
  const hook = await renderHook(() => useTermsDocuments(documents), {
    wrapper: api.wrapper,
  });
  return { ...hook, api };
}

describe('useTermsDocuments', () => {
  it('받는 동안은 loading, 받으면 조 제목·본문 덩어리다', async () => {
    const server = withTermsDocuments(createFakeServer(), {
      service: termsText('제1조(목적)\n\n이 약관은 목적을 규정합니다.'),
    });
    const { result, api } = await renderDocuments(['service'], server);

    expect(result.current).toEqual([{ status: 'loading' }]);
    await waitFor(() =>
      expect(result.current).toEqual([
        {
          status: 'ready',
          blocks: [
            { kind: 'article', text: '제1조(목적)' },
            {
              kind: 'paragraph',
              text: '이 약관은 목적을 규정합니다.',
              indented: true,
            },
          ],
        },
      ]),
    );
    expect(api.server.callsTo('GET', serviceUrl)).toHaveLength(1);
  });

  it('불러오지 못하면 안내 문구와 다시 시도를 주고, 다시 시도하면 다시 받는다', async () => {
    const server = withTermsDocuments(createFakeServer(), {
      service: rawResponse(404, 'NoSuchKey'),
    });
    const { result, api } = await renderDocuments(['service'], server);

    await waitFor(() =>
      expect(result.current[0]).toMatchObject({
        status: 'error',
        message: TERMS_LOAD_FAILED,
      }),
    );

    api.server.on('GET', serviceUrl, termsText('제1조(목적)'));
    const [failed] = result.current;
    await act(() => {
      if (failed.status === 'error') {
        failed.onRetry();
      }
    });

    await waitFor(() =>
      expect(result.current[0]).toEqual({
        status: 'ready',
        blocks: [{ kind: 'article', text: '제1조(목적)' }],
      }),
    );
    expect(api.server.callsTo('GET', serviceUrl)).toHaveLength(2);
  });

  it('전문이 없는 약관(null)은 받지 않고 unavailable 이다', async () => {
    const { result, api } = await renderDocuments([null, 'marketing']);

    expect(result.current[0]).toEqual({ status: 'unavailable' });
    await waitFor(() =>
      expect(result.current[1]).toMatchObject({ status: 'ready' }),
    );
    expect(api.server.calls).toHaveLength(1);
  });

  // 주소에 버전(시행일)이 들어 있어 같은 주소의 내용은 바뀌지 않는다. 상세를 다시 열 때 다시 받지 않는다
  it('한 번 받은 전문은 상세를 다시 열어도 다시 받지 않는다', async () => {
    const { result, api, unmount } = await renderDocuments(['service']);
    await waitFor(() =>
      expect(result.current[0]).toMatchObject({ status: 'ready' }),
    );
    await unmount();

    const again = await renderHook(() => useTermsDocuments(['service']), {
      wrapper: api.wrapper,
    });

    expect(again.result.current[0]).toMatchObject({ status: 'ready' });
    await act(async () => {});
    expect(api.server.callsTo('GET', serviceUrl)).toHaveLength(1);
  });
});
