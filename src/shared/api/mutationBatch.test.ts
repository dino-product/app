import type { QueryClient } from '@tanstack/react-query';
import { createTestQueryClient } from '../testing/renderWithApi';
import { createMutationBatch } from './mutationBatch';

describe('createMutationBatch', () => {
  let queryClient: QueryClient;
  let refresh: jest.Mock<Promise<void>, [QueryClient]>;
  let finishRefresh: () => void;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    refresh = jest.fn(
      (_queryClient: QueryClient) =>
        new Promise<void>(resolve => {
          finishRefresh = resolve;
        }),
    );
  });

  afterEach(() => {
    queryClient.clear();
  });

  const state = (promise: Promise<void> | undefined) => {
    let done = false;
    promise?.then(() => {
      done = true;
    });
    return () => done;
  };
  const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

  it('하나만 보내 성공하면 서버 값을 받고, 다 받을 때까지 끝나지 않는다', async () => {
    const batch = createMutationBatch(refresh);
    batch.begin(queryClient);

    const settled = batch.settle(queryClient, true);
    const done = state(settled);
    await flush();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith(queryClient);
    expect(done()).toBe(false);
    finishRefresh();
    await flush();
    expect(done()).toBe(true);
  });

  it('실패만 했으면 다시 받지 않고 바로 끝난다', () => {
    const batch = createMutationBatch(refresh);
    batch.begin(queryClient);

    expect(batch.settle(queryClient, false)).toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  // 먼저 성공한 변경은 마지막 변경이 서버 값을 받을 때까지 진행 중으로 남는다 (화면이 옛 캐시로 돌아가지 않게)
  it('잇달아 보낸 변경은 마지막이 끝날 때 한 번 받고, 먼저 성공한 변경은 그때까지 기다린다', async () => {
    const batch = createMutationBatch(refresh);
    batch.begin(queryClient);
    batch.begin(queryClient);

    const first = state(batch.settle(queryClient, true));
    await flush();
    expect(refresh).not.toHaveBeenCalled();
    expect(first()).toBe(false);

    const last = state(batch.settle(queryClient, true));
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(first()).toBe(false);

    finishRefresh();
    await flush();
    expect(first()).toBe(true);
    expect(last()).toBe(true);
  });

  it('먼저 성공한 변경이 있으면 마지막이 실패해도 한 번 받고, 실패한 마지막은 기다리지 않는다', async () => {
    const batch = createMutationBatch(refresh);
    batch.begin(queryClient);
    batch.begin(queryClient);
    const first = state(batch.settle(queryClient, true));

    expect(batch.settle(queryClient, false)).toBeUndefined();
    expect(refresh).toHaveBeenCalledTimes(1);
    finishRefresh();
    await flush();
    expect(first()).toBe(true);
  });

  // 세는 것은 begin·settle 을 부르는 즉시(동기)라 같은 틱에 끝난 둘 중 하나가 마지막이다
  it('같은 틱에 끝난 두 변경도 한 번 받는다', async () => {
    const batch = createMutationBatch(refresh);
    batch.begin(queryClient);
    batch.begin(queryClient);

    batch.settle(queryClient, true);
    batch.settle(queryClient, true);
    await flush();

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('묶음이 끝난 뒤 보낸 변경은 새 묶음이다 (앞 묶음의 성공이 새지 않는다)', async () => {
    const batch = createMutationBatch(refresh);
    batch.begin(queryClient);
    batch.settle(queryClient, true);
    finishRefresh();
    await flush();
    refresh.mockClear();

    batch.begin(queryClient);
    expect(batch.settle(queryClient, false)).toBeUndefined();

    expect(refresh).not.toHaveBeenCalled();
  });

  it('QueryClient 마다 따로 센다', async () => {
    const other = createTestQueryClient();
    const batch = createMutationBatch(refresh);
    batch.begin(queryClient);
    batch.begin(other);

    batch.settle(other, true);
    await flush();

    expect(refresh).toHaveBeenCalledWith(other);
    expect(refresh).toHaveBeenCalledTimes(1);
    other.clear();
  });
});
