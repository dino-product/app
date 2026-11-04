import { act, renderHook } from '@testing-library/react-native';
import { useQueryState } from './queryState';

const query = <T>(data: T | undefined, isError = false) => ({
  data,
  isError,
  refetch: jest.fn(async () => undefined),
});

describe('useQueryState', () => {
  it('받은 값이 있으면 ready 다 (다시 받다 실패해도 보이던 값을 둔다)', async () => {
    const { result } = await renderHook(() =>
      useQueryState(query('값', true), '실패'),
    );

    expect(result.current).toEqual({ status: 'ready', data: '값' });
  });

  it('값 없이 실패하면 문구와 다시 시도, 다시 시도는 refetch 를 부른다', async () => {
    const failed = query(undefined, true);
    const { result } = await renderHook(() => useQueryState(failed, '실패'));

    expect(result.current).toMatchObject({ status: 'error', message: '실패' });
    await act(() => {
      if (result.current.status === 'error') {
        result.current.onRetry();
      }
    });
    expect(failed.refetch).toHaveBeenCalledTimes(1);
  });

  it('값 없이 실패하지 않았으면 받는 중이다', async () => {
    const { result } = await renderHook(() =>
      useQueryState(query(undefined), '실패'),
    );

    expect(result.current).toEqual({ status: 'loading' });
  });

  // memo 화면(마이페이지)이 탭 전환 때 다시 그리지 않도록
  it('값·상태가 같으면 다시 그려도 같은 객체다', async () => {
    const ready = query('값');
    const { result, rerender } = await renderHook(
      ({ q }: { q: typeof ready }) => useQueryState(q, '실패'),
      { initialProps: { q: ready } },
    );
    const first = result.current;

    await rerender({ q: { ...ready } });

    expect(result.current).toBe(first);
  });
});
