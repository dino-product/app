import type {
  Query,
  QueryClient,
  QueryFilters,
  QueryKey,
} from '@tanstack/react-query';

// 변경(POST·PUT) 결과를 서버 답보다 먼저 화면에 반영한다 (#197). 스켈레톤은 불러오기(GET)에만 쓴다. 사용법:
//   useMutation({
//     onMutate: command => applyOptimistic(queryClient, [optimisticChange<List>({ queryKey }, data => 바꾼 값)]),
//     onError: (_error, _command, rollback) => rollback?.(),   실패하면 남긴 값으로 되돌린다
//     onSettled: () => queryClient.invalidateQueries({ queryKey }),   서버 값으로 바로잡는다
//   })

/** 낙관 반영 하나: filters 에 맞는 조회의 값을 update 로 바꾼다 */
export type OptimisticChange = {
  filters: QueryFilters;
  update: (data: unknown) => unknown;
};

/** 되돌리기. 부르면 바꾸기 전 값으로 돌린다 */
export type Rollback = () => void;

/** 조회 값의 타입을 정해 쓰는 낙관 반영. update 가 같은 값을 돌려주면 그 조회는 건드리지 않는다 */
export function optimisticChange<TData>(
  filters: QueryFilters,
  update: (data: TData) => TData,
): OptimisticChange {
  return { filters, update: update as (data: unknown) => unknown };
}

// 받은 값이 있는 조회만 다룬다. 처음 받는 중인 조회는 취소하면 다시 받을 계기가 없고, 바꿀 값도 없다
const withData = (filters: QueryFilters): QueryFilters => ({
  ...filters,
  predicate: (query: Query) =>
    query.state.data !== undefined && (filters.predicate?.(query) ?? true),
});

/**
 * 맞는 조회의 진행 중인 요청을 취소하고(늦게 온 옛 값이 낙관 값을 덮지 않게), 지금 값을 남긴 뒤 바꾼다.
 * 받은 시각은 그대로 둔다(낙관 값은 서버 값이 아니다). 돌려주는 함수를 부르면 남긴 값으로 되돌린다
 */
export async function applyOptimistic(
  queryClient: QueryClient,
  changes: readonly OptimisticChange[],
): Promise<Rollback> {
  const targets = changes.map(change => ({
    ...change,
    filters: withData(change.filters),
  }));
  await Promise.all(
    targets.map(({ filters }) => queryClient.cancelQueries(filters)),
  );

  const snapshots: {
    queryKey: QueryKey;
    data: unknown;
    dataUpdatedAt: number;
  }[] = [];
  const cache = queryClient.getQueryCache();
  for (const { filters, update } of targets) {
    for (const query of cache.findAll(filters)) {
      const { data, dataUpdatedAt } = query.state;
      const next = update(data);
      if (next !== data) {
        snapshots.push({ queryKey: query.queryKey, data, dataUpdatedAt });
        queryClient.setQueryData(query.queryKey, next, {
          updatedAt: dataUpdatedAt,
        });
      }
    }
  }

  return () => {
    // 같은 조회를 여러 번 바꿨으면 처음 남긴 값이 마지막에 오도록 거꾸로 되돌린다
    for (const { queryKey, data, dataUpdatedAt } of [...snapshots].reverse()) {
      queryClient.setQueryData(queryKey, data, { updatedAt: dataUpdatedAt });
    }
  };
}
