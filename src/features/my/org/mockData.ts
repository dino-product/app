import type { Membership } from '../model';
import {
  normalizeCompanyCode,
  type CompanyLookup,
  type Organization,
  type ParticipationRequest,
} from './model';

// 조직 참여 목 데이터 (#73). API 연동 전까지 회사 코드 조회와 참여 신청을 흉내 낸다.

// 회사 코드 → 회사. 소속 발주사(membershipsMock)와 같은 id 를 써서 '이미 참여' 를 앱에서 볼 수 있다.
// Figma 예시 코드 Orbit1245 는 처음 참여하는 회사다
const organizationsByCode: Record<string, Organization> = {
  ORBIT1245: { organizationId: 'org-9', organizationName: 'Orbit' },
  OBS0001: { organizationId: 'org-1', organizationName: '오빗 서비스' },
  FIELD0002: { organizationId: 'org-2', organizationName: '현장 파트너스' },
  TECH0003: { organizationId: 'org-3', organizationName: '테크 솔루션' },
  HANBIT10: { organizationId: 'org-10', organizationName: '한빛 설비' },
  GREEN11: { organizationId: 'org-11', organizationName: '그린 테크' },
};

/**
 * 회사 코드 조회 (GET /api/v1/organizations/lookup). 없는 코드는 서버가 404 라 null 이다.
 * 비활성 소속만 있는 회사는 다시 요청할 수 있다 (승인되면 그 소속이 다시 활성)
 */
export function lookupCompanyMock(
  code: string,
  memberships: readonly Membership[],
  requests: readonly ParticipationRequest[],
): CompanyLookup | null {
  const organization = organizationsByCode[normalizeCompanyCode(code)];
  if (!organization) {
    return null;
  }
  const { organizationId } = organization;
  if (
    memberships.some(
      item =>
        item.organizationId === organizationId && item.status === 'ACTIVE',
    )
  ) {
    return { ...organization, availability: 'ALREADY_MEMBER' };
  }
  const pending = requests.find(
    item => item.organizationId === organizationId && item.status === 'PENDING',
  );
  if (pending) {
    return {
      ...organization,
      availability: 'PENDING_REQUEST',
      pendingRequestId: pending.requestId,
    };
  }
  return { ...organization, availability: 'AVAILABLE' };
}

/** 내 참여 신청 (GET /api/v1/participation-requests). 승인 대기 2건(Figma 신청 현황)과 알림센터에서 여는 거절 1건 */
export const participationRequestsMock: readonly ParticipationRequest[] = [
  {
    requestId: 'request-1',
    organizationId: 'org-10',
    organizationName: '한빛 설비',
    desiredType: 'TECHNICIAN',
    status: 'PENDING',
    requestChannel: 'COMPANY_CODE',
    requestedAt: '2026-09-23T01:24:00Z',
  },
  {
    requestId: 'request-2',
    organizationId: 'org-11',
    organizationName: '그린 테크',
    desiredType: 'TECHNICIAN',
    status: 'PENDING',
    requestChannel: 'COMPANY_CODE',
    requestedAt: '2026-09-23T03:10:00Z',
  },
  {
    requestId: 'request-3',
    organizationId: 'org-12',
    organizationName: '스마트 홈케어',
    desiredType: 'STAFF',
    status: 'REJECTED',
    requestChannel: 'COMPANY_CODE',
    requestedAt: '2026-09-20T01:00:00Z',
    rejectReason: '현재 기사 인원이 충분해 요청을 받지 않고 있어요.',
  },
];
