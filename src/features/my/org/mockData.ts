import type { Membership } from '../model';
import {
  normalizeCompanyCode,
  type CompanyLookup,
  type Organization,
  type ParticipationDecision,
  type ParticipationRequest,
} from './model';

// 조직 참여 목 데이터 (#73). API 연동 전까지 회사 코드 조회와 참여 신청을 흉내 낸다.

// 회사 코드 → 회사. 소속 발주사(membershipsMock)와 같은 id 를 써서 '이미 참여' 를 앱에서 볼 수 있다.
// 코드는 서버 규칙(Crockford Base32 6자, I·L·O·U 없음)을 따른다 (#97). Figma 예시 Orbit1245 는 규칙 밖이라
// 마이 › 조직 참여의 Orbit 은 RBT124 다. 123456(온보딩 Figma 예시)도 처음 참여하는 Orbit 이다.
// 온보딩(#85)은 승인 대기에서 '확인' 을 누르면 결정된 것으로 친다. 234567 은 유형 변경 승인, 345678 은 거절이다
const organizationsByCode: Record<string, Organization> = {
  RBT124: { organizationId: 'org-9', organizationName: 'Orbit' },
  '123456': { organizationId: 'org-9', organizationName: 'Orbit' },
  '234567': { organizationId: 'org-13', organizationName: '한결 설비' },
  '345678': { organizationId: 'org-12', organizationName: '스마트 홈케어' },
  BS0001: { organizationId: 'org-1', organizationName: '오빗 서비스' },
  FD0002: { organizationId: 'org-2', organizationName: '현장 파트너스' },
  TC0003: { organizationId: 'org-3', organizationName: '테크 솔루션' },
  HB0010: { organizationId: 'org-10', organizationName: '한빛 설비' },
  GR0011: { organizationId: 'org-11', organizationName: '그린 테크' },
};

/** 목에 있는 회사 코드 (규칙 검사용) */
export const mockCompanyCodes: readonly string[] =
  Object.keys(organizationsByCode);

/**
 * 회사 코드 조회 (GET /api/v1/organizations/lookup). 없는 코드는 서버가 404 라 null 이다.
 * 비활성 소속만 있는 회사는 다시 요청할 수 있다 (승인되면 그 소속이 다시 활성). 거절·취소된 요청도 다시 요청할 수 있다
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
  // 승인된 요청도 소속이다 (온보딩에서 승인된 회사)
  if (
    memberships.some(
      item =>
        item.organizationId === organizationId && item.status === 'ACTIVE',
    ) ||
    requests.some(
      item =>
        item.organizationId === organizationId && item.status === 'APPROVED',
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

const TYPE_CHANGED_ORGANIZATION = 'org-13';
const REJECTING_ORGANIZATION = 'org-12';

/** 사무실의 결정 (목). 회사마다 정해 둔 결과를 돌려준다. 그 밖의 회사는 요청한 유형으로 승인한다 */
export function decideParticipationMock(
  request: ParticipationRequest,
): ParticipationDecision {
  if (request.organizationId === REJECTING_ORGANIZATION) {
    return {
      status: 'REJECTED',
      rejectReason: '현재 기사 인원이 충분해 요청을 받지 않고 있어요.',
    };
  }
  if (request.organizationId === TYPE_CHANGED_ORGANIZATION) {
    return {
      status: 'APPROVED',
      approvedType: request.desiredType === 'STAFF' ? 'TECHNICIAN' : 'STAFF',
    };
  }
  return { status: 'APPROVED', approvedType: request.desiredType };
}
