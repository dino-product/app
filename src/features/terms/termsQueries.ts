import {
  queryOptions,
  useQueries,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { useApiClient, type ApiClient } from '../../shared/api';
import { termsDocumentUrl, type TermsDocument } from './documents';
import { toTermsBlocks, type TermsBlock } from './termsText';

// 약관 전문 조회 (#192). 웹 버킷의 txt 를 GET 으로 받아 덩어리로 나눠 캐시에 둔다.
// 받는 동안 화면은 스켈레톤, 실패하면 다시 시도할 수 있는 안내다 (재시도 규칙은 다른 조회와 같다: 네트워크·5xx 만 두 번)

export type TermsDocumentState =
  | { status: 'ready'; blocks: readonly TermsBlock[] }
  | { status: 'loading' }
  | { status: 'error'; message: string; onRetry: () => void }
  /** 원격 전문이 없는 약관 (제3자 제공·위치기반) */
  | { status: 'unavailable' };

export const TERMS_LOAD_FAILED = '약관을 불러오지 못했어요.';

/** 주소(개발·운영 웹, 버전)마다 따로 둔다 */
export const termsDocumentQueryKey = (document: TermsDocument) =>
  ['terms-document', termsDocumentUrl(document)] as const;

export const termsDocumentQuery = (api: ApiClient, document: TermsDocument) =>
  queryOptions({
    queryKey: termsDocumentQueryKey(document),
    queryFn: async ({ signal }) =>
      toTermsBlocks(
        await api.getPlainText(termsDocumentUrl(document), { signal }),
      ),
  });

const UNAVAILABLE: TermsDocumentState = { status: 'unavailable' };
const LOADING: TermsDocumentState = { status: 'loading' };

const isDocument = (
  document: TermsDocument | null,
): document is TermsDocument => document !== null;

function toState({
  data,
  isError,
  refetch,
}: UseQueryResult<TermsBlock[]>): TermsDocumentState {
  if (data !== undefined) {
    return { status: 'ready', blocks: data };
  }
  if (isError) {
    return {
      status: 'error',
      message: TERMS_LOAD_FAILED,
      onRetry: () => {
        refetch();
      },
    };
  }
  return LOADING;
}

/**
 * 약관마다 전문 상태 (documents 와 같은 순서). null 은 원격 전문이 없어 받지 않는다.
 * documents 는 같은 배열을 주어야(상수·useMemo) 결과를 다시 만들지 않는다
 */
export function useTermsDocuments(
  documents: readonly (TermsDocument | null)[],
): TermsDocumentState[] {
  const api = useApiClient();
  const combine = useCallback(
    (results: UseQueryResult<TermsBlock[]>[]) => {
      let next = 0;
      return documents.map(document =>
        document === null ? UNAVAILABLE : toState(results[next++]),
      );
    },
    [documents],
  );
  return useQueries({
    queries: documents
      .filter(isDocument)
      .map(document => termsDocumentQuery(api, document)),
    combine,
  });
}
