// 조직 참여(#73)의 데이터 모양. Dino 백엔드 응답(/api/v1/organizations/lookup, /participation-requests)과
// 같은 이름을 써서 연동 때 그대로 옮긴다.

export type ParticipationType = 'STAFF' | 'TECHNICIAN';

/**
 * 회사 참여 화면을 여는 흐름. my: 마이 › 조직 참여 (#73, 하단 탭 위),
 * onboarding: 가입 직후 회사 참여 (#85, 탭 없음). 머리 제목·아래 여백이 Figma 마다 다르다
 */
export type JoinFlow = 'my' | 'onboarding';

export type RequestChannel = 'COMPANY_CODE' | 'JOIN_LINK' | 'QR_CODE';

export type Organization = { organizationId: string; organizationName: string };

/** 회사 코드 조회 결과 (CompanyCheckResponse). 없는 코드는 서버가 404 라 null 로 받는다 */
export type CompanyLookup = Organization & {
  availability: 'AVAILABLE' | 'ALREADY_MEMBER' | 'PENDING_REQUEST';
  pendingRequestId?: string;
};

export type LookupOutcome =
  | { kind: 'found'; organization: Organization }
  | { kind: 'invalid' }
  | { kind: 'alreadyMember'; organization: Organization }
  | { kind: 'pending'; organization: Organization };

export type ParticipationRequest = Organization & {
  requestId: string;
  desiredType: ParticipationType;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
  /** 요청할 때 앱이 보낸 경로 (요청 완료 요약) */
  requestChannel: RequestChannel;
  /** 요청 일시 (ISO, UTC) */
  requestedAt: string;
  /** 사유를 입력해 거절한 요청에만 있다 */
  rejectReason?: string;
  /** 승인한 요청의 확정 유형. 사무실이 희망 유형과 다르게 정할 수 있다 */
  approvedType?: ParticipationType;
  /** 승인·거절한 일시 (ISO, UTC) */
  decidedAt?: string;
};

/** 사무실의 결정 (승인 대기 → 승인·거절) */
export type ParticipationDecision =
  | { status: 'APPROVED'; approvedType: ParticipationType }
  | { status: 'REJECTED'; rejectReason: string };

export const participationTypeLabels: Record<ParticipationType, string> = {
  STAFF: '직원',
  TECHNICIAN: '기사',
};

export const requestChannelLabels: Record<RequestChannel, string> = {
  COMPANY_CODE: '회사 코드',
  JOIN_LINK: '참여 링크',
  QR_CODE: 'QR 코드',
};

/** 서버(RequestParticipationRequest)와 같은 규칙: 대소문자·공백·하이픈은 무시한다 */
export function normalizeCompanyCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

/** 회사 확인 결과를 화면이 나눌 네 갈래로 바꾼다 */
export function lookupOutcome(lookup: CompanyLookup | null): LookupOutcome {
  if (lookup === null) {
    return { kind: 'invalid' };
  }
  const organization = {
    organizationId: lookup.organizationId,
    organizationName: lookup.organizationName,
  };
  switch (lookup.availability) {
    case 'AVAILABLE':
      return { kind: 'found', organization };
    case 'ALREADY_MEMBER':
      return { kind: 'alreadyMember', organization };
    case 'PENDING_REQUEST':
      return { kind: 'pending', organization };
  }
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/** 신청 현황 카드의 날짜 2026-09-23 (기기 시간대 기준) */
export function formatRequestDate(at: string): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

/** 요청 완료 요약의 일시 2026-09-23 · 10:24 */
export function formatRequestedAt(at: string): string {
  const date = new Date(at);
  return `${formatRequestDate(at)} · ${pad2(date.getHours())}:${pad2(
    date.getMinutes(),
  )}`;
}

/** 승인 대기 중인 요청 (신청 현황 목록, 마이페이지 배지 숫자) */
export function pendingRequests(
  requests: readonly ParticipationRequest[],
): ParticipationRequest[] {
  return requests.filter(request => request.status === 'PENDING');
}
