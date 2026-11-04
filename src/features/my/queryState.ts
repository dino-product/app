import { useMemo } from 'react';
import type { LoadState } from '../../shared/layout/LoadStateView';

// 마이 탭 조회 결과를 화면 상태로 (#115). 사용법:
//   const profile = useQueryState(useQuery(…), '프로필을 불러오지 못했어요.')
//   profile.status === 'ready' ? <Card profile={profile.data} /> : <LoadStateView state={profile} />

export type QueryState<T> =
  | { status: 'ready'; data: T }
  | Exclude<LoadState, { status: 'ready' }>;

/**
 * 받은 값이 있으면 그 값(다시 받다 실패해도 보이던 값을 둔다), 없으면 받는 중 또는 실패 문구와 다시 시도.
 * 값·상태가 같으면 같은 객체를 돌려줘 memo 화면이 다시 그리지 않는다.
 * useQuery 결과에서 data·isError·refetch 만 읽어 그 밖의 변화(isFetching 등)로는 다시 그리지 않는다
 */
export function useQueryState<T>(
  {
    data,
    isError,
    refetch,
  }: {
    data: T | undefined;
    isError: boolean;
    refetch: () => Promise<unknown>;
  },
  failedMessage: string,
): QueryState<T> {
  return useMemo<QueryState<T>>(() => {
    if (data !== undefined) {
      return { status: 'ready', data };
    }
    if (isError) {
      return {
        status: 'error',
        message: failedMessage,
        onRetry: () => {
          refetch();
        },
      };
    }
    return { status: 'loading' };
  }, [data, isError, refetch, failedMessage]);
}
