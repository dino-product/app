import { focusManager, QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { isApiError } from './ApiError';

// 서버 상태 캐시(React Query). 사용법: 화면에서 `useQuery({ queryKey, queryFn: ({ signal }) => api.get(path, { signal }) })`
// ApiProvider 가 앱에 하나 만들어 둔다. 포커스가 없는 화면의 쿼리는 `subscribed: isFocused` 로 멈춘다

/** 처음 요청 뒤 더 시도하는 횟수 */
export const MAX_QUERY_RETRIES = 2;

/**
 * 조회 재시도: 서버에 닿지 못했거나(network) 5xx 일 때만 최대 2번.
 * 4xx 는 다시 보내도 같고, 타임아웃은 이미 15초를 기다렸으니 화면의 다시 시도에 맡긴다.
 * 503 Retry-After 는 HTTP 클라이언트가 먼저 한 번 다시 보낸다
 */
export function shouldRetryQuery(failureCount: number, error: unknown) {
  if (failureCount >= MAX_QUERY_RETRIES || !isApiError(error)) {
    return false;
  }
  return (
    error.kind === 'network' ||
    (error.kind === 'http' && error.status !== undefined && error.status >= 500)
  );
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetryQuery },
      // 변경 요청은 서버가 처리했는지 모를 수 있어 다시 보내지 않는다
      mutations: { retry: false },
    },
  });
}

/**
 * 앱이 background 로 가면 React Query 포커스를 끄고, 다시 active 가 되면 켠다 (React Native 에는 창 포커스 이벤트가 없다).
 * 켜질 때 오래된(stale) 쿼리를 다시 받고, 꺼진 동안은 refetchInterval 이 돌지 않는다
 */
export function useAppStateFocus() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', status =>
      focusManager.setFocused(status === 'active'),
    );
    return () => subscription.remove();
  }, []);
}
