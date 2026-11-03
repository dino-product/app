import { useCallback, useRef, useState } from 'react';
import type { Membership } from '../model';
import { lookupCompanyMock } from './mockData';
import {
  lookupOutcome,
  type LookupOutcome,
  type Organization,
  type ParticipationDecision,
  type ParticipationRequest,
  type ParticipationType,
} from './model';

// 목 데이터 단계의 참여 요청 상태. 마이 › 조직 참여(#73)와 온보딩 회사 참여(#85)가 함께 쓴다.
// API 연동 시 서버 상태(회사 조회·참여 요청·취소)로 바꾼다
export function useParticipationStore(
  initial: readonly ParticipationRequest[],
  memberships: readonly Membership[],
) {
  const [requests, setRequests] = useState(initial);
  const nextRequestNumber = useRef(initial.length + 1);

  /** 회사 코드로 회사를 찾는다 (GET /api/v1/organizations/lookup). 목: 서버 대신 지금 소속·요청으로 판정한다 */
  const lookupCompany = useCallback(
    async (code: string): Promise<LookupOutcome> =>
      lookupOutcome(lookupCompanyMock(code, memberships, requests)),
    [memberships, requests],
  );

  /** 참여를 요청하고 만든 요청을 돌려준다 (POST /api/v1/organizations/{organizationId}/participation-requests) */
  const requestParticipation = useCallback(
    (organization: Organization, desiredType: ParticipationType) => {
      const request: ParticipationRequest = {
        ...organization,
        requestId: `request-${nextRequestNumber.current++}`,
        desiredType,
        status: 'PENDING',
        // QR·참여 링크는 별도 티켓이라 지금은 회사 코드뿐이다
        requestChannel: 'COMPANY_CODE',
        requestedAt: new Date().toISOString(),
      };
      setRequests(current => [...current, request]);
      return request;
    },
    [],
  );

  /** 승인 대기 중인 요청을 취소한다 (POST /{requestId}/cancel) */
  const cancelRequest = useCallback(
    (requestId: string) =>
      setRequests(current =>
        current.map(item =>
          item.requestId === requestId
            ? { ...item, status: 'CANCELED' as const }
            : item,
        ),
      ),
    [],
  );

  /** 사무실의 결정(승인·거절)을 반영한다. 서버는 알림으로 알려 주고, 목은 온보딩 승인 대기의 '확인' 이 부른다 */
  const decideRequest = useCallback(
    (requestId: string, decision: ParticipationDecision, at = new Date()) =>
      setRequests(current =>
        current.map(item =>
          item.requestId === requestId
            ? { ...item, ...decision, decidedAt: at.toISOString() }
            : item,
        ),
      ),
    [],
  );

  return {
    requests,
    lookupCompany,
    requestParticipation,
    cancelRequest,
    decideRequest,
  };
}

export type ParticipationStore = ReturnType<typeof useParticipationStore>;
