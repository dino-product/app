import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { isApiError, useApiClient, type ApiClient } from '../../../shared/api';
import {
  hasNewApproval,
  upsertRequest,
  type ParticipationRequest,
  type ParticipationType,
  type RequestChannel,
} from './model';
import {
  cancelParticipationRequest,
  fetchParticipationRequests,
  lookupCompany,
  OrganizationErrorCode,
  requestParticipation,
} from './participationApi';

// 회사 참여의 서버 상태 (#116). 화면은 이 훅으로 신청 현황을 읽고 회사 확인·참여 요청·취소를 보낸다.
// 신청 현황은 화면을 열 때 받아 오고(마이페이지 배지·신청 현황·요청 완료·거절 화면이 같은 캐시를 본다), 요청·취소에 성공하면
// 받아 둔 목록을 응답으로 바로 고친 뒤 다시 받는다

export const participationRequestsKey = ['participationRequests'] as const;
/** 내 소속 목록 (GET /api/v1/memberships). 기사 작업 화면이 쓰는 소속 조회(#114)와 같은 키다 */
export const membershipsKey = ['memberships'] as const;

/** 신청 현황 쿼리. 다시 받은 목록에 새로 승인된 요청이 있으면 소속 조회를 다시 부르게 무효로 만든다 */
function participationRequestsQuery(api: ApiClient, queryClient: QueryClient) {
  return {
    queryKey: participationRequestsKey,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const previous = queryClient.getQueryData<ParticipationRequest[]>(
        participationRequestsKey,
      );
      const requests = await fetchParticipationRequests(api, { signal });
      if (hasNewApproval(previous, requests)) {
        queryClient.invalidateQueries({ queryKey: membershipsKey });
      }
      return requests;
    },
  };
}

/** 내 신청 현황. select 로 화면이 쓰는 값만 고른다 (렌더 수를 줄이려면 모듈 수준 함수를 넘긴다) */
export function useParticipationRequests<T = ParticipationRequest[]>(
  select?: (requests: ParticipationRequest[]) => T,
) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useQuery({
    ...participationRequestsQuery(api, queryClient),
    select,
  });
}

/** 신청 현황의 요청 하나. 받기 전이면 data 가 undefined, 목록에 없으면 null 이다 */
export function useParticipationRequest(requestId: string) {
  const select = useCallback(
    (requests: ParticipationRequest[]) =>
      requests.find(item => item.requestId === requestId) ?? null,
    [requestId],
  );
  return useParticipationRequests(select);
}

/** 신청 현황을 지금 서버에서 새로 받는다 (캐시도 바꾼다). 온보딩이 사무실의 결정을 확인할 때 쓴다 */
export function useFetchParticipationRequests() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      queryClient.fetchQuery({
        ...participationRequestsQuery(api, queryClient),
        staleTime: 0,
      }),
    [api, queryClient],
  );
}

/** 회사 확인. 찾은 회사는 찾은 방법(requestChannel)과 함께 참여 대상이 된다 */
export function useLookupCompany() {
  const api = useApiClient();
  return useCallback(
    (
      companyCode: string,
      requestChannel: RequestChannel,
      options?: { signal?: AbortSignal },
    ) => lookupCompany(api, companyCode, requestChannel, options),
    [api],
  );
}

// 받아 둔 목록이 있을 때만 응답으로 바로 고친다. 없으면 화면이 열 때 서버 목록을 받는다
function applyToList(queryClient: QueryClient, request: ParticipationRequest) {
  queryClient.setQueryData<ParticipationRequest[]>(
    participationRequestsKey,
    current => current && upsertRequest(current, request),
  );
  queryClient.invalidateQueries({ queryKey: participationRequestsKey });
}

/** 참여 요청 (POST /participation-requests). 실패하면 신청 현황을 바꾸지 않는다 */
export function useRequestParticipation() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      companyCode: string;
      desiredType: ParticipationType;
      requestChannel: RequestChannel;
    }) => requestParticipation(api, input),
    onSuccess: created => applyToList(queryClient, created),
  });
}

/**
 * 참여 요청 취소. 이미 처리된 요청(ORGANIZATION-017)이면 받아 둔 목록이 옛 상태라 다시 받는다.
 * 그 밖의 실패는 신청 현황을 바꾸지 않는다
 */
export function useCancelParticipationRequest() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      cancelParticipationRequest(api, requestId),
    onSuccess: canceled => applyToList(queryClient, canceled),
    onError: error => {
      if (isApiError(error, OrganizationErrorCode.alreadyDecided)) {
        queryClient.invalidateQueries({ queryKey: participationRequestsKey });
      }
    },
  });
}
