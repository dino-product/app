import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createMemoryTokenStore } from '../testing/session';
import { ApiProvider, useApiClient } from './ApiProvider';
import { createApiClient } from './client';

describe('ApiProvider', () => {
  it('Provider 밖에서 useApiClient 를 부르면 알려 준다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(renderHook(() => useApiClient())).rejects.toThrow(
      'ApiProvider 안에서만 쓸 수 있다',
    );
    jest.restoreAllMocks();
  });

  it('준 API 클라이언트와 QueryClient 를 화면에 준다', async () => {
    const client = createApiClient({
      baseUrl: 'http://localhost:8080',
      tokenStore: createMemoryTokenStore(),
    });
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApiProvider client={client} queryClient={queryClient}>
        {children}
      </ApiProvider>
    );

    const { result } = await renderHook(
      () => ({ api: useApiClient(), cache: useQueryClient() }),
      { wrapper },
    );

    expect(result.current.api).toBe(client);
    expect(result.current.cache).toBe(queryClient);
  });

  it('주지 않으면 Keychain 세션을 쓰는 클라이언트와 QueryClient 를 한 번 만들어 계속 쓴다', async () => {
    const { result, rerender } = await renderHook(
      () => ({ api: useApiClient(), cache: useQueryClient() }),
      { wrapper: ApiProvider },
    );
    const first = result.current;

    await rerender({});

    expect(result.current.api).toBe(first.api);
    expect(result.current.cache).toBe(first.cache);
    await expect(result.current.api.session.getSession()).resolves.toBeNull();
  });
});
