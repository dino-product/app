import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { ApiProvider } from '../api/ApiProvider';
import { createApiClient } from '../api/client';
import type { Session } from '../api/session';
import { createFakeServer, type FakeServer } from './fakeServer';
import { createMemoryTokenStore } from './session';

// 서버를 부르는 화면·훅의 테스트 도구. 사용법:
//   const server = createFakeServer().on('GET', '/api/v1/memberships', ok([...]));
//   await renderWithApi(<MembershipScreen />, { server, session: testSession() });
//   훅은 const api = createTestApi(); await renderHook(() => useX(), { wrapper: api.wrapper })
// 재시도를 끈 QueryClient 를 테스트마다 새로 만들어 앞 테스트의 캐시가 남지 않는다

type TestApiOptions = {
  /** 응답을 정한 가짜 서버. 없으면 빈 서버 */
  server?: FakeServer;
  /** 로그인한 상태로 시작할 세션 (testSession()). 없으면 로그아웃 상태 */
  session?: Session | null;
};

/** 재시도를 끄고(오류가 바로 보임), 캐시 정리 타이머를 두지 않는다(jest 가 끝나지 않는 일을 막음) */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

export function createTestApi({
  server = createFakeServer(),
  session = null,
}: TestApiOptions = {}) {
  const tokenStore = createMemoryTokenStore(session);
  const client = createApiClient({
    baseUrl: server.baseUrl,
    fetch: server.fetch,
    tokenStore,
  });
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider client={client} queryClient={queryClient}>
      {children}
    </ApiProvider>
  );
  return { server, client, tokenStore, queryClient, wrapper };
}

export async function renderWithApi(
  ui: ReactElement,
  options?: TestApiOptions,
) {
  const api = createTestApi(options);
  const result = await render(ui, { wrapper: api.wrapper });
  return { ...result, ...api };
}
