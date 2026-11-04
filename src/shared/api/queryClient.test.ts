import { focusManager, type QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { ApiError, ApiErrorMessage } from './ApiError';
import {
  createQueryClient,
  MAX_QUERY_RETRIES,
  shouldRetryQuery,
  useAppStateFocus,
} from './queryClient';

const network = new ApiError({
  kind: 'network',
  message: ApiErrorMessage.network,
});
const http = (status: number) =>
  new ApiError({ kind: 'http', status, code: 'X', message: '실패' });

describe('기본 재시도 규칙', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
  });

  // 실패한 테스트가 남긴 캐시 정리 타이머(gcTime)로 jest 가 끝나지 않는 일을 막는다
  afterEach(() => {
    queryClient.clear();
  });

  it('네트워크 오류·5xx 는 최대 2번 다시 시도한다', () => {
    expect(MAX_QUERY_RETRIES).toBe(2);
    for (const error of [network, http(500), http(502), http(503)]) {
      expect(shouldRetryQuery(0, error)).toBe(true);
      expect(shouldRetryQuery(1, error)).toBe(true);
      expect(shouldRetryQuery(2, error)).toBe(false);
    }
  });

  it('4xx 는 다시 시도하지 않는다', () => {
    for (const status of [400, 401, 403, 404, 409]) {
      expect(shouldRetryQuery(0, http(status))).toBe(false);
    }
  });

  it('타임아웃·설정 오류·ApiError 가 아닌 오류는 다시 시도하지 않는다', () => {
    expect(
      shouldRetryQuery(
        0,
        new ApiError({ kind: 'timeout', message: ApiErrorMessage.timeout }),
      ),
    ).toBe(false);
    expect(
      shouldRetryQuery(
        0,
        new ApiError({ kind: 'config', message: ApiErrorMessage.config }),
      ),
    ).toBe(false);
    expect(shouldRetryQuery(0, new TypeError('버그'))).toBe(false);
  });

  it('조회는 네트워크 오류면 처음 + 2번, 4xx 면 한 번만 부른다', async () => {
    const flaky = jest.fn().mockRejectedValue(network);
    const missing = jest.fn().mockRejectedValue(http(404));

    await expect(
      queryClient.fetchQuery({
        queryKey: ['flaky'],
        queryFn: flaky,
        retryDelay: 0,
      }),
    ).rejects.toBe(network);
    await expect(
      queryClient.fetchQuery({
        queryKey: ['missing'],
        queryFn: missing,
        retryDelay: 0,
      }),
    ).rejects.toMatchObject({ status: 404 });

    expect(flaky).toHaveBeenCalledTimes(3);
    expect(missing).toHaveBeenCalledTimes(1);
  });

  it('변경 요청(mutation)은 네트워크 오류여도 다시 시도하지 않는다', async () => {
    const mutationFn = jest.fn().mockRejectedValue(network);
    // retry 는 기본값을 쓴다. gcTime 0: 캐시를 비워도 변경 요청의 정리 타이머는 남아 jest 가 끝나지 않는다
    const mutation = queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn, gcTime: 0 });

    await expect(mutation.execute(undefined)).rejects.toBe(network);

    expect(mutationFn).toHaveBeenCalledTimes(1);
  });
});

describe('useAppStateFocus', () => {
  let changeListener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();

  beforeEach(() => {
    remove.mockClear();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, handler) => {
        changeListener = handler as (state: AppStateStatus) => void;
        return { remove };
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    changeListener = undefined;
  });

  it('앱이 background 로 가면 포커스를 잃고, 다시 active 가 되면 React Query 에 포커스를 알린다', async () => {
    const onFocus = jest.fn();
    const unsubscribe = focusManager.subscribe(onFocus);
    await renderHook(() => useAppStateFocus());

    await act(() => changeListener?.('background'));
    expect(focusManager.isFocused()).toBe(false);

    await act(() => changeListener?.('active'));
    expect(focusManager.isFocused()).toBe(true);
    expect(onFocus).toHaveBeenLastCalledWith(true);
    unsubscribe();
  });

  it('언마운트하면 AppState 구독을 푼다', async () => {
    const { unmount } = await renderHook(() => useAppStateFocus());

    await unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});

// jest/setupAfterEnv.js 가 테스트마다 되돌린다. 순서대로 도는 두 테스트로 확인한다
describe('테스트 사이 focusManager', () => {
  it('앞 테스트가 포커스를 끈 채 끝나도', () => {
    focusManager.setFocused(false);

    expect(focusManager.isFocused()).toBe(false);
  });

  it('다음 테스트는 포커스된 상태로 시작한다', () => {
    expect(focusManager.isFocused()).toBe(true);
  });
});
