import type { QueryClient } from '@tanstack/react-query';

// 변경(POST) 결과를 먼저 보이는 낙관 반영(#197)에서, 잇달아 보낸 변경을 한 묶음으로 마무리한다.
// 화면은 캐시를 고치지 않고 진행 중인 변경(useMutationState)을 서버 값 위에 얹어 그린다. 그래서 어떤 조회가 와도
// 흔들리지 않고, 실패한 변경은 진행 중에서 빠져 저절로 되돌아간다. 사용법:
//   const batch = createMutationBatch(queryClient => queryClient.invalidateQueries({ queryKey }));
//   useMutation({
//     onMutate: () => batch.begin(queryClient),          첫 줄에서 (동기로 센다)
//     onSettled: (_data, error) => batch.settle(queryClient, !error),
//   })
// - 마지막 변경이 끝날 때 묶음에 성공이 있었으면 refresh 로 서버 값을 한 번 받는다
// - 성공한 변경은 그 서버 값을 다 받을 때까지 진행 중으로 남는다(onSettled 가 기다린다). 옛 캐시로 잠깐 돌아가지 않는다
// - 실패한 변경은 기다리지 않고 바로 끝난다
// - begin·settle 을 부르는 즉시 세므로 같은 틱에 끝난 둘 중 하나만 마지막이다. 묶음은 QueryClient 마다 따로다

export type MutationBatch = {
  /** 변경을 보낸다 (onMutate 첫 줄) */
  begin(queryClient: QueryClient): void;
  /** 변경이 끝났다 (onSettled). 돌려주는 약속을 onSettled 가 돌려주면 그만큼 진행 중으로 남는다 */
  settle(
    queryClient: QueryClient,
    succeeded: boolean,
  ): Promise<void> | undefined;
};

type Batch = {
  inFlight: number;
  succeeded: boolean;
  /** 마지막 변경이 서버 값을 다 받았다 */
  refreshed: Promise<void>;
  finish: () => void;
};

export function createMutationBatch(
  refresh: (queryClient: QueryClient) => Promise<unknown>,
): MutationBatch {
  const batches = new WeakMap<QueryClient, Batch>();

  const open = (queryClient: QueryClient) => {
    const current = batches.get(queryClient);
    if (current) {
      return current;
    }
    let finish = () => {};
    const refreshed = new Promise<void>(resolve => {
      finish = resolve;
    });
    const batch = { inFlight: 0, succeeded: false, refreshed, finish };
    batches.set(queryClient, batch);
    return batch;
  };

  return {
    begin(queryClient) {
      open(queryClient).inFlight += 1;
    },
    settle(queryClient, succeeded) {
      const batch = open(queryClient);
      batch.inFlight -= 1;
      batch.succeeded ||= succeeded;
      if (batch.inFlight > 0) {
        return succeeded ? batch.refreshed : undefined;
      }
      batches.delete(queryClient);
      const refreshed = batch.succeeded
        ? refresh(queryClient).then(
            () => undefined,
            () => undefined,
          )
        : Promise.resolve();
      refreshed.then(batch.finish);
      return succeeded ? refreshed : undefined;
    },
  };
}
