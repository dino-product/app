import {
  ApiError,
  ApiErrorMessage,
  isApiError,
  type ApiClient,
} from '../../../shared/api';
import { isRecord } from '../../../shared/isRecord';
import {
  lookupOutcome,
  normalizeCompanyCode,
  type CompanyLookup,
  type LookupOutcome,
  type ParticipationRequest,
  type ParticipationType,
  type RequestChannel,
} from './model';

// 회사 참여 API (#116, 백엔드 §2.3 Organization). 사용법: `await lookupCompany(api, code, 'COMPANY_CODE')`.
// 화면은 participationQueries 의 훅으로 부른다. 회사 확인은 가입 전에도 부를 수 있고, 참여 요청·취소·신청 현황은 가입을 마쳐야 한다.
// 서버의 숫자 id 는 String 으로 바꿔 쓴다(3 → '3'). 알림의 participationRequestId·내비게이션 파라미터도 같은 규칙이라
// 알림으로 받은 요청 id 로 신청 현황의 요청을 바로 찾는다

/** 회사 참여 오류 코드 (백엔드 OrganizationErrorCode 중 앱이 받는 것) */
export const OrganizationErrorCode = {
  /** 409 발주사 잠금 대기 초과. 잠시 후 다시 보내면 된다 */
  lockTimeout: 'ORGANIZATION-010',
  /** 404 없는 코드·형식 오류 */
  unknownCode: 'ORGANIZATION-011',
  /** 404 회사가 코드를 바꿔 폐기된 이전 코드 */
  retiredCode: 'ORGANIZATION-012',
  /** 409 이미 참여 중인 회사 */
  alreadyMember: 'ORGANIZATION-013',
  /** 409 같은 회사에 승인 대기 요청이 있다 (새로 만들지 않는다) */
  pendingRequest: 'ORGANIZATION-014',
  /** 403 없는 요청·다른 계정의 요청 (둘을 구분하지 않는다) */
  notOwnRequest: 'ORGANIZATION-016',
  /** 409 이미 승인·거절·취소된 요청 */
  alreadyDecided: 'ORGANIZATION-017',
  /** 429 10분 안에 없는 코드로 10번 실패. 그 10분이 끝날 때까지 코드와 무관하게 막힌다 */
  tooManyFailures: 'ORGANIZATION-018',
} as const;

export const COMPANY_LOOKUP_PATH = '/api/v1/organizations/lookup';
export const PARTICIPATION_REQUESTS_PATH = '/api/v1/participation-requests';
export const cancelRequestPath = (requestId: string) =>
  `${PARTICIPATION_REQUESTS_PATH}/${encodeURIComponent(requestId)}/cancel`;

const AVAILABILITIES: readonly CompanyLookup['availability'][] = [
  'AVAILABLE',
  'ALREADY_MEMBER',
  'PENDING_REQUEST',
];
const TYPES: readonly ParticipationType[] = ['STAFF', 'TECHNICIAN'];
const STATUSES: readonly ParticipationRequest['status'][] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELED',
];

const isOneOf = <T extends string>(
  values: readonly T[],
  value: unknown,
): value is T => values.includes(value as T);
// 값이 없는 필드는 null 로 온다(Jackson 기본). 키가 빠져 와도 같은 뜻으로 받는다
const isAbsent = (value: unknown): value is null | undefined =>
  value === null || value === undefined;
const isId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);
const toId = (id: number) => String(id);

const invalidResponse = () =>
  new ApiError({
    kind: 'http',
    status: 200,
    message: ApiErrorMessage.invalidResponse,
  });

/** CompanyCheckResponse 를 확인해 옮긴다. 모양이 다르면 서버 응답 오류로 던진다 */
export function parseCompanyCheck(value: unknown): CompanyLookup {
  if (
    !isRecord(value) ||
    !isId(value.organizationId) ||
    typeof value.organizationName !== 'string' ||
    !isOneOf(AVAILABILITIES, value.availability) ||
    !(isAbsent(value.pendingRequestId) || isId(value.pendingRequestId))
  ) {
    throw invalidResponse();
  }
  return {
    organizationId: toId(value.organizationId),
    organizationName: value.organizationName,
    availability: value.availability,
    ...(isId(value.pendingRequestId)
      ? { pendingRequestId: toId(value.pendingRequestId) }
      : {}),
  };
}

/**
 * 참여 요청 한 건을 옮긴다. 요청·취소 응답(ParticipationRequestResponse)에는 결정 필드가 없고,
 * 신청 현황의 한 줄(MyParticipationRequestsResponse.Request)에는 있다. 없는 값은 키를 두지 않는다
 */
export function parseParticipationRequest(
  value: unknown,
): ParticipationRequest {
  if (
    !isRecord(value) ||
    !isId(value.requestId) ||
    !isId(value.organizationId) ||
    typeof value.organizationName !== 'string' ||
    !isOneOf(TYPES, value.desiredType) ||
    !isOneOf(STATUSES, value.status) ||
    typeof value.requestedAt !== 'string' ||
    !(isAbsent(value.confirmedType) || isOneOf(TYPES, value.confirmedType)) ||
    !(isAbsent(value.rejectReason) || typeof value.rejectReason === 'string') ||
    !(isAbsent(value.decidedAt) || typeof value.decidedAt === 'string')
  ) {
    throw invalidResponse();
  }
  return {
    requestId: toId(value.requestId),
    organizationId: toId(value.organizationId),
    organizationName: value.organizationName,
    desiredType: value.desiredType,
    status: value.status,
    requestedAt: value.requestedAt,
    ...(isOneOf(TYPES, value.confirmedType)
      ? { approvedType: value.confirmedType }
      : {}),
    ...(typeof value.rejectReason === 'string'
      ? { rejectReason: value.rejectReason }
      : {}),
    ...(typeof value.decidedAt === 'string'
      ? { decidedAt: value.decidedAt }
      : {}),
  };
}

/**
 * 회사 확인 (GET /api/v1/organizations/lookup). 화면이 나눌 네 갈래로 돌려준다.
 * 없는 코드(ORGANIZATION-011)와 바뀐 이전 코드(-012)는 유효하지 않은 코드다. 그 밖의 실패(429 -018, 네트워크 등)는 던진다.
 * requestChannel 은 서버에 보내지 않고, 찾은 회사(참여 대상)에 담아 참여 요청까지 넘긴다
 */
export async function lookupCompany(
  api: ApiClient,
  companyCode: string,
  requestChannel: RequestChannel,
  { signal }: { signal?: AbortSignal } = {},
): Promise<LookupOutcome> {
  const code = normalizeCompanyCode(companyCode);
  try {
    const lookup = parseCompanyCheck(
      await api.get(COMPANY_LOOKUP_PATH, {
        query: { companyCode: code },
        signal,
      }),
    );
    return lookupOutcome(lookup, { companyCode: code, requestChannel });
  } catch (error) {
    if (
      isApiError(error, OrganizationErrorCode.unknownCode) ||
      isApiError(error, OrganizationErrorCode.retiredCode)
    ) {
      return lookupOutcome(null, { companyCode: code, requestChannel });
    }
    throw error;
  }
}

/** 참여 요청 (POST /api/v1/participation-requests). 서버는 경로를 돌려주지 않아 보낸 경로를 붙인다 */
export async function requestParticipation(
  api: ApiClient,
  {
    companyCode,
    desiredType,
    requestChannel,
  }: {
    companyCode: string;
    desiredType: ParticipationType;
    requestChannel: RequestChannel;
  },
): Promise<ParticipationRequest> {
  const created = parseParticipationRequest(
    await api.post(PARTICIPATION_REQUESTS_PATH, {
      companyCode: normalizeCompanyCode(companyCode),
      desiredType,
      requestChannel,
    }),
  );
  return { ...created, requestChannel };
}

/** 참여 요청 취소 (POST /api/v1/participation-requests/{requestId}/cancel, 본문 없음). 취소된 요청을 돌려준다 */
export async function cancelParticipationRequest(
  api: ApiClient,
  requestId: string,
): Promise<ParticipationRequest> {
  return parseParticipationRequest(
    await api.post(cancelRequestPath(requestId)),
  );
}

/** 내 신청 현황 (GET /api/v1/participation-requests). 요청 일시순 전체, 다시 보낸 요청은 별개 줄이다 */
export async function fetchParticipationRequests(
  api: ApiClient,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ParticipationRequest[]> {
  const result = await api.get(PARTICIPATION_REQUESTS_PATH, { signal });
  if (!isRecord(result) || !Array.isArray(result.requests)) {
    throw invalidResponse();
  }
  return result.requests.map(parseParticipationRequest);
}
