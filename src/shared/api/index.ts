// 서버 API 토대 (#110). 화면·기능은 여기서 가져온다:
//   const api = useApiClient();
//   useQuery({ queryKey: ['memberships'], queryFn: ({ signal }) => api.get<Membership[]>('/api/v1/memberships', { signal }) })
//   로그인: await api.session.start(loginResponse) · 로그아웃: await api.session.end() · 만료: api.session.onExpired(() => …)
//   변경 결과를 먼저 보이기(낙관 반영): onMutate 에서 applyOptimistic, 실패하면 돌려받은 rollback (optimistic.ts)
// 테스트는 src/shared/testing 의 renderWithApi·createFakeServer 를 쓴다
export {
  ApiError,
  ApiErrorCode,
  ApiErrorMessage,
  isApiError,
  type ApiErrorKind,
} from './ApiError';
export { ApiProvider, useApiClient } from './ApiProvider';
export type {
  ApiClient,
  HttpMethod,
  QueryParams,
  RequestOptions,
} from './client';
export {
  applyOptimistic,
  optimisticChange,
  type OptimisticChange,
  type Rollback,
} from './optimistic';
export type { LoginResponse, Session } from './session';
