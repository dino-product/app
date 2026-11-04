import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createApiClient, type ApiClient } from './client';
import { apiBaseUrl } from './config';
import { createQueryClient, useAppStateFocus } from './queryClient';
import { createKeychainTokenStore } from './tokenStore';

// 서버 API 와 서버 상태 캐시(React Query)를 앱에 연결한다 (App.tsx). 화면에서는 `const api = useApiClient()` 와 useQuery 를 쓴다.
// 클라이언트·캐시는 처음 그릴 때 한 번 만들고 바꾸지 않아, 이 Provider 때문에 아래가 다시 그려지지 않는다

const ApiClientContext = createContext<ApiClient | null>(null);

export function ApiProvider({
  client,
  queryClient,
  children,
}: {
  /** 테스트가 가짜 서버에 붙인 클라이언트를 준다. 없으면 config 의 주소와 Keychain 세션 */
  client?: ApiClient;
  /** 테스트가 재시도를 끈 QueryClient 를 준다 */
  queryClient?: QueryClient;
  children?: ReactNode;
}) {
  const [api] = useState(
    () =>
      client ??
      createApiClient({
        baseUrl: apiBaseUrl,
        tokenStore: createKeychainTokenStore(),
      }),
  );
  const [cache] = useState(() => queryClient ?? createQueryClient());
  useAppStateFocus();

  return (
    <ApiClientContext.Provider value={api}>
      <QueryClientProvider client={cache}>{children}</QueryClientProvider>
    </ApiClientContext.Provider>
  );
}

export function useApiClient(): ApiClient {
  const api = useContext(ApiClientContext);
  if (api === null) {
    throw new Error('ApiProvider 안에서만 쓸 수 있다');
  }
  return api;
}
