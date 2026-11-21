// 서버 API 토대 (#110). 화면·기능은 여기서 가져온다:
//   const api = useApiClient();
//   useQuery({ queryKey: ['memberships'], queryFn: ({ signal }) => api.get<Membership[]>('/api/v1/memberships', { signal }) })
//   로그인: await api.session.start(loginResponse) · 로그아웃: await api.session.end() · 만료: api.session.onExpired(() => …)
//   변경 결과를 먼저 보이기(낙관 반영): 화면이 진행 중인 변경(useMutationState)을 얹어 그리고, 잇달아 보낸 변경은 mutationBatch 로 마무리한다
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
export { createMutationBatch, type MutationBatch } from './mutationBatch';
export type { LoginResponse, Session } from './session';
