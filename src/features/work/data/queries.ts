import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useMutationState,
  useQueries,
  useQuery,
  useQueryClient,
  type Mutation,
  type Query,
  type QueryClient,
  type QueryKey,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { createMutationBatch } from '../../../shared/api';
import {
  useStableLoadState,
  type LoadState,
} from '../../../shared/layout/LoadStateView';
import type { WorkDetail } from '../model';
import { shouldRefetchAfter, workErrorMessage } from './errors';
import { workKeys } from './keys';
import {
  detailWithResponses,
  pendingWithResponses,
  scheduleWithResponses,
  type RespondingWork,
} from './responding';
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
// 수락·거절은 서버 답을 기다리지 않고 곧바로 반영한다(낙관 반영, #197): 조회 훅이 보내는 중인 응답을 서버 값 위에 얹어 준다.
// 캐시는 고치지 않으므로 응답 중에 다시 받아도 흔들리지 않고, 실패하면 저절로 보내기 전으로 돌아간다 (responding.ts)

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

// 응답(수락·거절) 변경 키. 보내는 중인 응답을 조회 훅이 이 키로 찾는다
const RESPOND_KEY = ['work', 'respond'] as const;
const respondKeys = {
  accept: [...RESPOND_KEY, 'accept'],
  reject: [...RESPOND_KEY, 'reject'],
} as const;

type RespondContext = { request?: ScheduledWork };

const toRespondingWork = (
  mutation: Mutation<unknown, Error, unknown, unknown>,
): RespondingWork => ({
  kind: mutation.options.mutationKey?.[2] === 'reject' ? 'reject' : 'accept',
  workId: (mutation.state.variables as { workId: number }).workId,
  request: (mutation.state.context as RespondContext | undefined)?.request,
});

/**
 * 보내는 중인 응답. 성공한 응답은 서버 값을 다시 받을 때까지 보내는 중이다 (createMutationBatch).
 * 같은 값이면 같은 배열이다 (useMutationState 가 깊게 비교한다)
 */
function useRespondingWorks(): readonly RespondingWork[] {
  return useMutationState({
    filters: { mutationKey: RESPOND_KEY, status: 'pending' },
    select: toRespondingWork,
  });
}

/** 내 일정 조회에 보내는 중인 응답을 얹는다 (구간마다) */
const scheduleSelect =
  (period: Period, responses: readonly RespondingWork[]) =>
  (schedule: MySchedule) =>
    scheduleWithResponses(schedule, period, responses);

export function useMySchedule(
  period: Period,
  { subscribed }: WorkQueryOptions = {},
) {
  const responses = useRespondingWorks();
  return useQuery({
    ...myScheduleQuery(useWorkRepository(), period),
    select: useMemo(
      () => scheduleSelect(period, responses),
      [period, responses],
    ),
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
  const responses = useRespondingWorks();
  const queries = useMemo(
    () =>
      periods.map(period => ({
        ...myScheduleQuery(repository, period),
        select: scheduleSelect(period, responses),
      })),
    [periods, repository, responses],
  );
  const { works, statuses } = useQueries({
    queries,
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
  const responses = useRespondingWorks();
  const query = useQuery({
    ...pendingWorksQuery(useWorkRepository()),
    select: useCallback(
      (pending: MySchedule) => pendingWithResponses(pending, responses),
      [responses],
    ),
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
  const responses = useRespondingWorks();
  return useQuery({
    ...workDetailQuery(useWorkRepository(), workId, organizationId),
    select: useCallback(
      (detail: WorkDetail) => detailWithResponses(detail, workId, responses),
      [workId, responses],
    ),
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

// 잇달아 보낸 응답은 마지막 응답이 끝날 때 한 번 서버 값을 받는다. 성공한 응답은 그때까지 보내는 중으로 남아
// 화면이 옛 캐시(아직 수락 대기)로 잠깐 돌아가지 않는다
const respondBatch = createMutationBatch(queryClient =>
  queryClient.invalidateQueries({ queryKey: workKeys.all }),
);

const hasData = (query: Query) => query.state.data !== undefined;

// 캐시에서 그 조회들의 값을 바꾼다. 같은 값이면 건드리지 않는다
function updateQueries<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  update: (data: T, queryKey: QueryKey) => T,
) {
  for (const query of queryClient
    .getQueryCache()
    .findAll({ queryKey, predicate: hasData })) {
    const data = query.state.data as T;
    const next = update(data, query.queryKey);
    if (next !== data) {
      queryClient.setQueryData(query.queryKey, next);
    }
  }
}

const periodOf = (queryKey: QueryKey): Period => {
  const [, , from, to] = queryKey as ReturnType<typeof workKeys.schedule>;
  return { from, to };
};

/**
 * 서버가 받은 응답을 캐시에 확정한다: 응답 필요·내 일정(모든 구간)·그 작업의 상세.
 * 무효화는 보이는 조회만 다시 받으므로(#110) 보이지 않는 화면이나, 다시 받기가 실패·중단돼도 옛 값이 남지 않는다.
 * 받던 조회(서버가 처리하기 전 값)가 늦게 와 덮지 않게 먼저 멈춘다 (확정 뒤 마지막 응답에서 다시 받는다)
 */
async function confirmResponse(
  queryClient: QueryClient,
  response: RespondingWork,
) {
  const responses = [response];
  const keys = [
    workKeys.pending,
    workKeys.schedules,
    workKeys.details(response.workId),
  ];
  await Promise.all(
    keys.map(queryKey =>
      queryClient.cancelQueries({ queryKey, predicate: hasData }),
    ),
  );
  updateQueries<MySchedule>(queryClient, workKeys.pending, pending =>
    pendingWithResponses(pending, responses),
  );
  updateQueries<MySchedule>(
    queryClient,
    workKeys.schedules,
    (schedule, queryKey) =>
      scheduleWithResponses(schedule, periodOf(queryKey), responses),
  );
  updateQueries<WorkDetail>(
    queryClient,
    workKeys.details(response.workId),
    detail => detailWithResponses(detail, response.workId, responses),
  );
}

/**
 * 서버 작업이 화면과 달라져 실패했다(-010·-002·-016). 서버 값을 모르므로 응답 필요·내 일정·그 상세는 보이지 않는 화면
 * 것까지 새로 받는다. 나머지 작업 조회는 보이는 것만 받는다 (받는 중이면 그 조회를 같이 쓴다)
 */
const refetchAfterConflict = (queryClient: QueryClient, workId: number) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: workKeys.all }),
    ...[workKeys.pending, workKeys.schedules, workKeys.details(workId)].map(
      queryKey =>
        queryClient.invalidateQueries(
          { queryKey, refetchType: 'all' },
          { cancelRefetch: false },
        ),
    ),
  ]);

/**
 * 응답(수락·거절). 보내는 즉시 조회 훅이 결과를 얹어 보이고(useRespondingWorks), 실패하면 진행 중에서 빠져 되돌아간다.
 * - 성공: 결과를 캐시에 확정하고, 마지막 응답이 끝날 때 서버 값을 다시 받는다 (그때까지 진행 중이다)
 * - 서버 작업이 달라져 실패(-010·-002·-016): 서버 값을 받을 때까지 진행 중으로 둔다. 요청이 잠깐 돌아왔다 빠지지 않는다
 */
function useRespondMutation<T extends { workId: number }>(
  kind: keyof typeof respondKeys,
  run: (repository: WorkRepository, command: T) => Promise<void>,
) {
  const repository = useWorkRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: respondKeys[kind],
    mutationFn: (command: T) => run(repository, command),
    onMutate: (command): RespondContext => {
      respondBatch.begin(queryClient);
      return {
        request: queryClient
          .getQueryData<MySchedule>(workKeys.pending)
          ?.works.find(work => work.workId === command.workId),
      };
    },
    onSuccess: (_data, command, context) =>
      confirmResponse(queryClient, {
        kind,
        workId: command.workId,
        request: context?.request,
      }),
    onSettled: async (_data, error, command) => {
      const settled = respondBatch.settle(queryClient, !error);
      if (error && shouldRefetchAfter(error)) {
        await Promise.all([
          settled,
          refetchAfterConflict(queryClient, command.workId),
        ]);
        return;
      }
      await settled;
    },
  });
}

export const useAcceptWork = () =>
  useRespondMutation('accept', (repository, command: AcceptWorkCommand) =>
    repository.acceptWork(command),
  );

export const useRejectWork = () =>
  useRespondMutation('reject', (repository, command: RejectWorkCommand) =>
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
