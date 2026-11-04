import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import type { LoadState } from '../../../shared/layout/LoadStateView';
import { shouldRefetchAfter, workErrorMessage } from './errors';
import { workKeys } from './keys';
import type { MySchedule, Period, WorkRepository } from './types';
import { useWorkRepository } from './WorkRepositoryProvider';

// 화면이 작업 저장소를 쓰는 React Query 훅. 사용법:
//   const schedule = useMySchedule(weekPeriod(today));   조회 (구간·작업 id 로 캐시)
//   const accept = useAcceptWork(); await accept.mutateAsync({ workId, assignmentNumber })   변경
// 변경이 성공하면 목록·상세·이력을 새로 받고(끝날 때까지 isPending), 서버 작업이 달라져 실패했으면(-010·-002) 그때도 새로 받는다.
// 그 밖의 실패는 화면 상태를 그대로 둔다

export const myScheduleQuery = (repository: WorkRepository, period: Period) =>
  queryOptions({
    queryKey: workKeys.schedule(period),
    queryFn: ({ signal }) => repository.getMySchedule(period, { signal }),
  });

export const workDetailQuery = (
  repository: WorkRepository,
  workId: number,
  organizationId?: number,
) =>
  queryOptions({
    queryKey: workKeys.detail(workId, organizationId),
    queryFn: ({ signal }) =>
      repository.getWorkDetail(workId, { signal, organizationId }),
  });

export const workHistoryQuery = (repository: WorkRepository, period: Period) =>
  queryOptions({
    queryKey: workKeys.history(period),
    queryFn: ({ signal }) => repository.getWorkHistory(period, { signal }),
  });

/**
 * 조회 훅 공통 옵션. 탭·스택에서 포커스를 잃은 화면은 subscribed: false 로 구독을 멈춘다 (#110 관례, useIsFocused).
 * 멈춘 동안 무효화된 조회는 다시 포커스를 받을 때 새로 받는다
 */
export type WorkQueryOptions = { subscribed?: boolean; enabled?: boolean };

export function useMySchedule(
  period: Period,
  { subscribed }: WorkQueryOptions = {},
) {
  return useQuery({
    ...myScheduleQuery(useWorkRepository(), period),
    subscribed,
  });
}

// 여러 구간의 결과를 합친다. React Query 가 결과를 깊게 비교해 같은 값이면 앞 결과를 그대로 주므로(replaceEqualDeep)
// 함수(refetch·onRetry)는 넣지 않는다: 함수가 들면 매번 새 객체가 되어 화면이 다시 그려진다
const combineSchedules = (results: UseQueryResult<MySchedule>[]) => ({
  works: results.flatMap(result => result.data?.works ?? []),
  statuses: results.map(({ data, isPending, isError, error }) => ({
    data: data === undefined ? undefined : true,
    isPending,
    isError,
    error,
  })),
});

/** 여러 구간의 내 일정을 합친다 (구간은 하나 이상). periods 는 같은 값이면 같은 배열로 준다 (useMemo) */
export function useMySchedules(
  periods: readonly Period[],
  {
    subscribed,
    loadBy = 'all',
  }: Omit<WorkQueryOptions, 'enabled'> & { loadBy?: 'first' | 'all' } = {},
) {
  const repository = useWorkRepository();
  const queryClient = useQueryClient();
  const { works, statuses } = useQueries({
    queries: periods.map(period => myScheduleQuery(repository, period)),
    combine: combineSchedules,
    subscribed,
  });
  const refetch = useCallback(
    () =>
      Promise.all(
        periods.map(period =>
          queryClient.refetchQueries({
            queryKey: workKeys.schedule(period),
            exact: true,
          }),
        ),
      ),
    [periods, queryClient],
  );
  // 불러오는 상태: 첫 구간만 (내 일정은 고른 날의 달을 먼저 두고, 펼친 달력의 달은 점만 늦게 온다) / 모든 구간
  const state = loadStateOf(
    ...(loadBy === 'first' ? statuses.slice(0, 1) : statuses).map(status => ({
      ...status,
      refetch,
    })),
  );
  return { works, load: useStableLoadState(state, refetch), refetch };
}

export function useWorkDetail(
  workId: number,
  {
    subscribed,
    enabled,
    organizationId,
    onlyErrors,
  }: WorkQueryOptions & {
    organizationId?: number;
    /** 오류가 바뀔 때만 다시 그린다 (값은 쓰지 않고 볼 수 없는지만 보는 화면) */
    onlyErrors?: boolean;
  } = {},
) {
  return useQuery({
    ...workDetailQuery(useWorkRepository(), workId, organizationId),
    notifyOnChangeProps: onlyErrors ? ['error'] : undefined,
    subscribed,
    enabled,
  });
}

/** 달을 바꾸는 동안에는 앞 달 결과를 placeholder 로 두어 누적 완료 수가 깜빡이지 않게 한다 (isPlaceholderData 로 가린다) */
export function useWorkHistory(
  period: Period,
  { subscribed }: WorkQueryOptions = {},
) {
  return useQuery({
    ...workHistoryQuery(useWorkRepository(), period),
    placeholderData: keepPreviousData,
    subscribed,
  });
}

function useWorkMutation<T>(
  run: (repository: WorkRepository, command: T) => Promise<void>,
) {
  const repository = useWorkRepository();
  const queryClient = useQueryClient();
  const refetchWork = () =>
    queryClient.invalidateQueries({ queryKey: workKeys.all });
  return useMutation({
    mutationFn: (command: T) => run(repository, command),
    onSuccess: refetchWork,
    onError: error => {
      if (shouldRefetchAfter(error)) {
        refetchWork();
      }
    },
  });
}

export const useAcceptWork = () =>
  useWorkMutation(
    (repository, command: Parameters<WorkRepository['acceptWork']>[0]) =>
      repository.acceptWork(command),
  );

export const useRejectWork = () =>
  useWorkMutation(
    (repository, command: Parameters<WorkRepository['rejectWork']>[0]) =>
      repository.rejectWork(command),
  );

export const useStartWork = () =>
  useWorkMutation(
    (repository, command: Parameters<WorkRepository['startWork']>[0]) =>
      repository.startWork(command),
  );

export const useSubmitCompletionReport = () =>
  useWorkMutation(
    (
      repository,
      command: Parameters<WorkRepository['submitCompletionReport']>[0],
    ) => repository.submitCompletionReport(command),
  );

/**
 * loadStateOf 를 화면에 줄 값으로: 상태·문구가 같으면 같은 객체라 화면(memo)이 다시 그려지지 않는다.
 * 다시 시도는 retry 로 한다 (같은 함수를 주어야 한다)
 */
function useStableLoadState(
  state: LoadState,
  retry: () => Promise<unknown>,
): LoadState {
  const { status } = state;
  const message = state.status === 'error' ? state.message : undefined;
  return useMemo(
    () =>
      status === 'error'
        ? {
            status,
            message: message ?? '',
            onRetry: () => {
              retry();
            },
          }
        : { status },
    [status, message, retry],
  );
}

/** 조회 하나의 로딩·오류(다시 시도) 상태. 상태·문구가 같으면 같은 객체다 */
export function useLoadState(query: QueryLike): LoadState {
  return useStableLoadState(loadStateOf(query), query.refetch);
}

type QueryLike = {
  data: unknown;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
};

/** 조회 결과를 화면의 로딩·오류(다시 시도) 상태로. 이미 받은 값이 있으면 다시 받다 실패해도 그 값을 보인다 */
export function loadStateOf(...queries: QueryLike[]): LoadState {
  const failed = queries.filter(
    query => query.isError && query.data === undefined,
  );
  if (failed.length > 0) {
    return {
      status: 'error',
      message: workErrorMessage(failed[0].error),
      onRetry: () => failed.forEach(query => query.refetch()),
    };
  }
  if (queries.some(query => query.isPending)) {
    return { status: 'loading' };
  }
  return { status: 'ready' };
}

/** 당겨서 새로고침. 다시 받는 동안 refreshing 이 켜진다 */
export function useRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  return { refreshing, onRefresh };
}
