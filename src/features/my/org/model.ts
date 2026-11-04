// 조직 참여(#73)의 데이터 모양. Dino 백엔드 응답(/api/v1/organizations/lookup, /participation-requests)과
// 같은 이름을 쓴다. 서버의 숫자 id 는 문자열로 바꿔 둔다 (participationApi, #116)

export type ParticipationType = 'STAFF' | 'TECHNICIAN';

/**
 * 회사 참여 화면을 여는 흐름. my: 마이 › 조직 참여 (#73, 하단 탭 위),
 * onboarding: 가입 직후 회사 참여 (#85, 탭 없음). 머리 제목·아래 여백이 Figma 마다 다르다
 */
export type JoinFlow = 'my' | 'onboarding';

export type RequestChannel = 'COMPANY_CODE' | 'JOIN_LINK' | 'QR_CODE';

export type Organization = { organizationId: string; organizationName: string };

/**
 * 참여를 요청할 회사와 그 회사를 찾은 방법. 회사 확인 결과로 만들어 역할 선택·참여 요청에 넘긴다.
 * 참여 요청은 회사 id 가 아니라 회사 코드로 보낸다. QR·참여 링크(#108)도 같은 모양에 경로만 바꿔 쓴다
 */
export type JoinTarget = Organization & {
  /** 정리한 회사 코드 (normalizeCompanyCode) */
  companyCode: string;
  requestChannel: RequestChannel;
};

/** 회사 코드 조회 결과 (CompanyCheckResponse). 없는 코드는 서버가 404 라 null 로 받는다 */
export type CompanyLookup = Organization & {
  availability: 'AVAILABLE' | 'ALREADY_MEMBER' | 'PENDING_REQUEST';
  /** 승인 대기 요청이 있을 때(PENDING_REQUEST)만 */
  pendingRequestId?: string;
};

export type LookupOutcome =
  | { kind: 'found'; target: JoinTarget }
  | { kind: 'invalid' }
  | { kind: 'alreadyMember'; organization: Organization }
  | { kind: 'pending'; organization: Organization; requestId?: string };

/** PENDING 에서만 바뀌고 결정·취소 뒤에는 바뀌지 않는다 */
export type ParticipationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELED';

export type ParticipationRequest = Organization & {
  requestId: string;
  desiredType: ParticipationType;
  status: ParticipationStatus;
  /** 요청할 때 앱이 보낸 경로 (요청 완료 요약). 서버 응답에는 없어 이 앱이 방금 보낸 요청만 안다 */
  requestChannel?: RequestChannel;
  /** 요청 일시 (ISO, UTC) */
  requestedAt: string;
  /** 사유를 입력해 거절한 요청에만 있다 */
  rejectReason?: string;
  /** 승인한 요청의 확정 유형 (서버 confirmedType). 사무실이 희망 유형과 다르게 정할 수 있다 */
  approvedType?: ParticipationType;
  /** 승인·거절한 일시 (ISO, UTC) */
  decidedAt?: string;
};

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

// 회사 코드 규칙 (Dino CompanyCode, #97). 마이·온보딩 회사 찾기가 같이 쓴다.
// Crockford Base32 대문자 6자: 헷갈리는 I·L·O·U 는 쓰지 않는다
export const COMPANY_CODE_LENGTH = 6;
export const COMPANY_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const notInAlphabet = new RegExp(`[^${COMPANY_CODE_ALPHABET}]`, 'g');
const completeCode = new RegExp(
  `^[${COMPANY_CODE_ALPHABET}]{${COMPANY_CODE_LENGTH}}$`,
);

/**
 * 입력칸에 들어갈 회사 코드. 대문자로 바꾸고 공백·하이픈을 지운 뒤(서버와 같다)
 * 허용 밖 문자(한글·특수문자·I·L·O·U 등)는 빼고 6자까지만 둔다. 붙여넣기 ab-12 3c → AB123C.
 * previous(지금 칸의 값)가 이미 6자인데 그 값에 글자를 더한 입력이면 받지 않는다
 * (maxLength 처럼. 가운데 끼워 넣어도 끝 글자가 밀려나지 않게). 모두 골라 바꿔 붙여넣은 값은 받는다
 */
export function sanitizeCompanyCodeInput(input: string, previous = ''): string {
  const code = normalizeCompanyCode(input).replace(notInAlphabet, '');
  if (
    code.length > COMPANY_CODE_LENGTH &&
    previous.length >= COMPANY_CODE_LENGTH &&
    keepsInOrder(code, previous)
  ) {
    return previous;
  }
  return code.slice(0, COMPANY_CODE_LENGTH);
}

/** text 가 part 의 글자를 순서대로 모두 담고 있는지 (part 에 글자를 끼워 넣은 값인지) */
function keepsInOrder(text: string, part: string): boolean {
  let index = 0;
  for (const char of text) {
    if (char === part[index]) {
      index += 1;
    }
  }
  return index === part.length;
}

/** 서버 규칙을 채운 코드인지 (허용 문자로 정확히 6자). 그때만 회사를 찾는다 */
export function isCompanyCodeComplete(code: string): boolean {
  return completeCode.test(code);
}

/** 회사 확인 결과를 화면이 나눌 네 갈래로 바꾼다. 찾은 회사는 찾은 코드·방법과 함께 참여 대상이 된다 */
export function lookupOutcome(
  lookup: CompanyLookup | null,
  how: Pick<JoinTarget, 'companyCode' | 'requestChannel'>,
): LookupOutcome {
  if (lookup === null) {
    return { kind: 'invalid' };
  }
  const organization = {
    organizationId: lookup.organizationId,
    organizationName: lookup.organizationName,
  };
  switch (lookup.availability) {
    case 'AVAILABLE':
      return { kind: 'found', target: { ...organization, ...how } };
    case 'ALREADY_MEMBER':
      return { kind: 'alreadyMember', organization };
    case 'PENDING_REQUEST':
      return {
        kind: 'pending',
        organization,
        requestId: lookup.pendingRequestId,
      };
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

/** 승인 대기 중인 요청 (신청 현황 목록) */
export function pendingRequests(
  requests: readonly ParticipationRequest[],
): ParticipationRequest[] {
  return requests.filter(request => request.status === 'PENDING');
}

/** 승인 대기 건수 (마이페이지 신청 현황 배지) */
export function countPendingRequests(
  requests: readonly ParticipationRequest[],
): number {
  return pendingRequests(requests).length;
}

/** 그 회사의 그 상태 요청 중 가장 나중 것. 서버 목록은 요청 일시순이고 다시 보낸 요청은 별개 줄이다 */
export function latestRequestOf(
  requests: readonly ParticipationRequest[],
  organizationId: string,
  status: ParticipationStatus,
): ParticipationRequest | undefined {
  return [...requests]
    .reverse()
    .find(
      request =>
        request.organizationId === organizationId && request.status === status,
    );
}

/** 서버가 돌려준 요청(요청·취소 응답)으로 목록을 고친다. 없으면 끝(가장 최근)에 더한다 */
export function upsertRequest(
  requests: readonly ParticipationRequest[],
  request: ParticipationRequest,
): ParticipationRequest[] {
  const index = requests.findIndex(
    item => item.requestId === request.requestId,
  );
  if (index === -1) {
    return [...requests, request];
  }
  return requests.map((item, at) => (at === index ? request : item));
}

/** 앞 목록(없으면 처음 받음)에서 승인이 아니던 요청이 새로 승인됐는지. 그러면 소속 조회를 다시 불러야 한다 */
export function hasNewApproval(
  previous: readonly ParticipationRequest[] | undefined,
  next: readonly ParticipationRequest[],
): boolean {
  const approvedBefore = new Set(
    (previous ?? [])
      .filter(request => request.status === 'APPROVED')
      .map(request => request.requestId),
  );
  return next.some(
    request =>
      request.status === 'APPROVED' && !approvedBefore.has(request.requestId),
  );
}
