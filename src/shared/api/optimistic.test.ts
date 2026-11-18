import { QueryObserver, type QueryClient } from '@tanstack/react-query';
import { createTestQueryClient } from '../testing/renderWithApi';
import { applyOptimistic, optimisticChange } from './optimistic';

type List = { items: string[] };

const removeItem = (item: string) =>
  optimisticChange<List>({ queryKey: ['list'] }, data =>
    data.items.includes(item)
      ? { items: data.items.filter(value => value !== item) }
      : data,
  );

describe('applyOptimistic', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('맞는 조회(접두어)를 모두 바꾸고, 되돌리면 이전 값으로 돌아간다', async () => {
    queryClient.setQueryData<List>(['list', 1], { items: ['a', 'b'] });
    queryClient.setQueryData<List>(['list', 2], { items: ['b', 'c'] });
    queryClient.setQueryData<List>(['other'], { items: ['b'] });

    const rollback = await applyOptimistic(queryClient, [removeItem('b')]);

    expect(queryClient.getQueryData(['list', 1])).toEqual({ items: ['a'] });
    expect(queryClient.getQueryData(['list', 2])).toEqual({ items: ['c'] });
    expect(queryClient.getQueryData(['other'])).toEqual({ items: ['b'] });

    rollback();

    expect(queryClient.getQueryData(['list', 1])).toEqual({
      items: ['a', 'b'],
    });
    expect(queryClient.getQueryData(['list', 2])).toEqual({
      items: ['b', 'c'],
    });
  });

  // 낙관 값은 서버 값이 아니다. 받은 시각을 그대로 두어 그 조회가 새로 받은 것처럼 보이지 않게 한다
  it('바꾸거나 되돌려도 조회의 받은 시각은 그대로다', async () => {
    queryClient.setQueryData<List>(
      ['list'],
      { items: ['a', 'b'] },
      {
        updatedAt: 1000,
      },
    );

    const rollback = await applyOptimistic(queryClient, [removeItem('b')]);
    expect(queryClient.getQueryState(['list'])?.dataUpdatedAt).toBe(1000);

    rollback();
    expect(queryClient.getQueryState(['list'])?.dataUpdatedAt).toBe(1000);
  });

  it('진행 중인 조회는 취소해 늦게 온 옛 값이 낙관 값을 덮지 않는다', async () => {
    queryClient.setQueryData<List>(['list'], { items: ['a', 'b'] });
    let respond: (value: List) => void = () => {};
    const refetch = queryClient.fetchQuery({
      queryKey: ['list'],
      queryFn: () =>
        new Promise<List>(resolve => {
          respond = resolve;
        }),
      staleTime: 0,
    });

    await applyOptimistic(queryClient, [removeItem('b')]);
    respond({ items: ['a', 'b'] });
    await refetch.catch(() => undefined);

    expect(queryClient.getQueryData(['list'])).toEqual({ items: ['a'] });
  });

  // 처음 받는 조회를 취소하면 다시 받을 계기가 없어 빈 채로 남는다. 받기 전이라 바꿀 값도 없다
  it('값이 없는(처음 받는 중) 조회는 취소하지도 바꾸지도 않는다', async () => {
    let respond: (value: List) => void = () => {};
    const observer = new QueryObserver<List>(queryClient, {
      queryKey: ['list'],
      queryFn: () =>
        new Promise<List>(resolve => {
          respond = resolve;
        }),
    });
    const unsubscribe = observer.subscribe(() => {});

    const rollback = await applyOptimistic(queryClient, [removeItem('b')]);
    respond({ items: ['a', 'b'] });
    await Promise.resolve();
    await Promise.resolve();

    expect(queryClient.getQueryData(['list'])).toEqual({ items: ['a', 'b'] });
    rollback();
    expect(queryClient.getQueryData(['list'])).toEqual({ items: ['a', 'b'] });
    unsubscribe();
  });

  it('바꿀 것이 없으면(같은 값) 그 조회를 건드리지 않는다', async () => {
    const before = { items: ['a'] };
    queryClient.setQueryData<List>(['list'], before);
    const listener = jest.fn();
    const unsubscribe = queryClient.getQueryCache().subscribe(listener);

    const rollback = await applyOptimistic(queryClient, [removeItem('b')]);
    rollback();

    expect(queryClient.getQueryData(['list'])).toBe(before);
    expect(listener).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'updated' }),
    );
    unsubscribe();
  });

  it('여러 변경이 같은 조회에 맞으면 차례로 바꾸고, 되돌리면 처음 값이다', async () => {
    queryClient.setQueryData<List>(['list'], { items: ['a', 'b', 'c'] });

    const rollback = await applyOptimistic(queryClient, [
      removeItem('a'),
      removeItem('b'),
    ]);
    expect(queryClient.getQueryData(['list'])).toEqual({ items: ['c'] });

    rollback();
    expect(queryClient.getQueryData(['list'])).toEqual({
      items: ['a', 'b', 'c'],
    });
  });
});
