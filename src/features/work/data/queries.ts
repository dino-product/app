import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import {
  applyOptimistic,
  optimisticChange,
  type OptimisticChange,
} from '../../../shared/api';
import {
  useStableLoadState,
  type LoadState,
} from '../../../shared/layout/LoadStateView';
import type { WorkDetail } from '../model';
import { workStatusChip } from './convert';
import { shouldRefetchAfter, workErrorMessage } from './errors';
import { workKeys } from './keys';
import type {
  AcceptWorkCommand,
  MySchedule,
  Period,
  RejectWorkCommand,
  ScheduledWork,
  WorkRepository,
} from './types';
import { useWorkRepository } from './WorkRepositoryProvider';

// 화면이 작업 저장소를 쓰는 React Query 훅. 사용법:
//   const schedule = useMySchedule(weekPeriod(today));   조회 (구간·작업 id 로 캐시)
//   const accept = useAcceptWork(); await accept.mutateAsync({ workId, assignmentNumber })   변경
// 변경이 성공하면 목록·상세·이력을 새로 받고(끝날 때까지 isPending), 서버 작업이 달라져 실패했으면(-010·-002) 그때도 새로 받는다.
// 그 밖의 실패는 화면 상태를 그대로 둔다.
// 수락·거절은 서버 답을 기다리지 않고 곧바로 반영한다(낙관 반영, #197). 실패하면 보내기 전 값으로 되돌린다

export const myScheduleQuery = (repository: WorkRepository, period: Period) =>
  queryOptions({
    queryKey: workKeys.schedule(period),
    queryFn: ({ signal }) => repository.getMySchedule(period, { signal }),
  });

export const pendingWorksQuery = (repository: WorkRepository) =>
  queryOptions({
    queryKey: workKeys.pending,
    queryFn: ({ signal }) => repository.getPendingWorks({ signal }),
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

const NO_WORKS: ScheduledWork[] = [];

/** 응답 필요(수락 대기 전부)와 불러오기 상태. 받기 전에는 빈 목록이다 */
export function usePendingWorks({
  subscribed,
}: Omit<WorkQueryOptions, 'enabled'> = {}) {
  const query = useQuery({
    ...pendingWorksQuery(useWorkRepository()),
    subscribed,
  });
  return {
    works: query.data?.works ?? NO_WORKS,
    load: useLoadState(query),
    refetch: query.refetch,
  };
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

// 응답 필요의 수락·거절. 응답을 잇달아 보낼 수 있어 보내는 중인 응답을 이 키로 센다
const RESPOND_MUTATION_KEY = ['work', 'respond'] as const;

const byStart = (a: ScheduledWork, b: ScheduledWork) =>
  Date.parse(a.startTime) - Date.parse(b.startTime) || a.workId - b.workId;

// 내 일정 조회 키(['work', 'schedule', from, to])의 구간과 일정이 겹치는지. 반열림 [from, to)
function overlapsScheduleKey(work: ScheduledWork, queryKey: QueryKey) {
  const [, , from, to] = queryKey as ReturnType<typeof workKeys.schedule>;
  return (
    Date.parse(work.startTime) < Date.parse(to) &&
    Date.parse(work.endTime) > Date.parse(from)
  );
}

// 목록(응답 필요·내 일정)에서 그 작업을 뺀다
const removeWork = (queryKey: QueryKey, workId: number) =>
  optimisticChange<MySchedule>({ queryKey }, data =>
    data.works.some(work => work.workId === workId)
      ? { works: data.works.filter(work => work.workId !== workId) }
      : data,
  );

/** 수락하면: 응답 필요에서 빠지고, 내 일정(겹치는 구간)에 작업전으로 들어가고, 상세가 작업전이 된다 */
function acceptedChanges(
  queryClient: QueryClient,
  { workId }: AcceptWorkCommand,
): OptimisticChange[] {
  // 내 일정에 수락 대기가 없으면(운영 API) 응답 필요의 행을 수락됨으로 넣는다
  const request = queryClient
    .getQueryData<MySchedule>(workKeys.pending)
    ?.works.find(work => work.workId === workId);
  const accepted = request && { ...request, status: 'ACCEPTED' as const };
  return [
    removeWork(workKeys.pending, workId),
    optimisticChange<MySchedule>(
      { queryKey: workKeys.schedules },
      (data, queryKey) => {
        if (data.works.some(work => work.workId === workId)) {
          return {
            works: data.works.map(work =>
              work.workId === workId ? { ...work, status: 'ACCEPTED' } : work,
            ),
          };
        }
        if (accepted && overlapsScheduleKey(accepted, queryKey)) {
          return { works: [...data.works, accepted].sort(byStart) };
        }
        return data;
      },
    ),
    // 상세는 지연 여부를 칩으로만 들고 있어, 지연이면 그대로 두고 아니면 작업전 칩이다
    optimisticChange<WorkDetail>(
      { queryKey: workKeys.details(workId) },
      detail => ({
        ...detail,
        workStatus: 'ACCEPTED',
        status:
          detail.status === 'delayed'
            ? 'delayed'
            : workStatusChip('ACCEPTED', false).status,
      }),
    ),
  ];
}

/** 거절하면: 응답 필요와 내 일정에서 빠진다 (본인 배정이 끝나 더는 보이지 않는다) */
const rejectedChanges = (
  _queryClient: QueryClient,
  { workId }: RejectWorkCommand,
): OptimisticChange[] => [
  removeWork(workKeys.pending, workId),
  removeWork(workKeys.schedules, workId),
];

// 잇달아 보낸 응답 가운데 먼저 끝나 다시 받기를 미뤄 둔 것이 있다 (QueryClient 마다, 마지막 응답이 끝나면 지운다)
const deferredRefetch = new WeakSet<QueryClient>();

/**
 * 결과를 먼저 보이는 응답(수락·거절). 보내기 전에 화면을 바꾸고, 실패하면 되돌린다.
 * 답이 오면 서버 값으로 다시 받는다. 다만 잇달아 보낸 응답이 남아 있으면 마지막 답이 올 때 한 번에 받는다:
 * 앞 답에 바로 받으면 서버가 아직 처리하지 않은 뒤 요청이 목록에 잠깐 돌아온다
 */
function useRespondMutation<T>(
  run: (repository: WorkRepository, command: T) => Promise<void>,
  changes: (queryClient: QueryClient, command: T) => OptimisticChange[],
) {
  const repository = useWorkRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: RESPOND_MUTATION_KEY,
    mutationFn: (command: T) => run(repository, command),
    onMutate: command =>
      applyOptimistic(queryClient, changes(queryClient, command)),
    onError: (_error, _command, rollback) => rollback?.(),
    onSettled: (_data, error) => {
      // 성공했거나, 서버 작업이 화면과 달라져 실패했다(-010·-002·-016)
      const outdated = !error || shouldRefetchAfter(error);
      // 끝나는 중인 이 응답도 아직 센다
      if (queryClient.isMutating({ mutationKey: RESPOND_MUTATION_KEY }) > 1) {
        if (outdated) {
          deferredRefetch.add(queryClient);
        }
        return;
      }
      const refetch = outdated || deferredRefetch.has(queryClient);
      deferredRefetch.delete(queryClient);
      return refetch
        ? queryClient.invalidateQueries({ queryKey: workKeys.all })
        : undefined;
    },
  });
}

export const useAcceptWork = () =>
  useRespondMutation(
    (repository, command: AcceptWorkCommand) => repository.acceptWork(command),
    acceptedChanges,
  );

export const useRejectWork = () =>
  useRespondMutation(
    (repository, command: RejectWorkCommand) => repository.rejectWork(command),
    rejectedChanges,
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
