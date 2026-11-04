import {
  createFakeServer,
  fail,
  ok,
  type FakeServer,
} from '../../../shared/testing/fakeServer';
import { normalizeCompanyCode, type ParticipationType } from './model';
import {
  cancelRequestPath,
  COMPANY_LOOKUP_PATH,
  OrganizationErrorCode,
  PARTICIPATION_REQUESTS_PATH,
} from './participationApi';

// 회사 참여 가짜 서버 (#116). 서버처럼 회사 확인·참여 요청·취소·내 신청 현황이 이어진다. 사용법:
//   const participation = createParticipationServer({ requests: EXISTING_REQUESTS });  // participation.server 를 쓴다
//   participationOf(app.server).decide({ status: 'APPROVED' })                         // 사무실이 마지막 요청을 승인
// 응답을 바꾸려면 server.on 으로 그 경로를 덮어쓴다 (예: 429). 정하지 않은 경로는 FAKE-NO-ROUTE 로 테스트가 실패한다

type ServerStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

/** 서버가 들고 있는 참여 요청 (MyParticipationRequestsResponse.Request 와 같은 모양) */
export type ServerParticipationRequest = {
  requestId: number;
  organizationId: number;
  organizationName: string;
  desiredType: ParticipationType;
  confirmedType: ParticipationType | null;
  status: ServerStatus;
  rejectReason: string | null;
  requestedAt: string;
  decidedAt: string | null;
};

export type FakeOrganization = {
  organizationId: number;
  organizationName: string;
  /** 지금 쓰는 회사 코드 */
  codes: readonly string[];
  /** 회사가 바꿔 폐기된 이전 코드 (ORGANIZATION-012) */
  retiredCodes?: readonly string[];
  /** 이미 소속된 회사 (요청과 상관없이 ALREADY_MEMBER) */
  member?: boolean;
};

/** 사무실의 결정. 승인은 확정 유형을 따로 정하지 않으면 희망 유형이다 */
export type FakeDecision =
  | { status: 'APPROVED'; confirmedType?: ParticipationType }
  | { status: 'REJECTED'; rejectReason?: string };

// 코드는 서버 규칙(Crockford Base32 6자, I·L·O·U 없음)을 따른다. 123456 은 온보딩 Figma 예시다
export const FAKE_ORGANIZATIONS: readonly FakeOrganization[] = [
  { organizationId: 9, organizationName: 'Orbit', codes: ['RBT124', '123456'] },
  { organizationId: 13, organizationName: '한결 설비', codes: ['234567'] },
  { organizationId: 12, organizationName: '스마트 홈케어', codes: ['345678'] },
  {
    organizationId: 1,
    organizationName: '오빗 서비스',
    codes: ['BS0001'],
    member: true,
  },
  { organizationId: 10, organizationName: '한빛 설비', codes: ['HB0010'] },
  { organizationId: 11, organizationName: '그린 테크', codes: ['GR0011'] },
  {
    organizationId: 14,
    organizationName: '새봄 설비',
    codes: ['SB0014'],
    retiredCodes: ['PRV014'],
  },
];

export const REJECT_REASON = '현재 기사 인원이 충분해 요청을 받지 않고 있어요.';

/** 가입을 마친 계정의 신청 현황 (요청 일시순): 거절 1(알림센터의 거절 알림이 여는 요청 3), 승인 대기 2 */
export const EXISTING_REQUESTS: readonly ServerParticipationRequest[] = [
  {
    requestId: 3,
    organizationId: 12,
    organizationName: '스마트 홈케어',
    desiredType: 'STAFF',
    confirmedType: null,
    status: 'REJECTED',
    rejectReason: REJECT_REASON,
    requestedAt: '2026-09-20T01:00:00Z',
    decidedAt: '2026-09-21T01:00:00Z',
  },
  {
    requestId: 1,
    organizationId: 10,
    organizationName: '한빛 설비',
    desiredType: 'TECHNICIAN',
    confirmedType: null,
    status: 'PENDING',
    rejectReason: null,
    requestedAt: '2026-09-23T01:24:00Z',
    decidedAt: null,
  },
  {
    requestId: 2,
    organizationId: 11,
    organizationName: '그린 테크',
    desiredType: 'TECHNICIAN',
    confirmedType: null,
    status: 'PENDING',
    rejectReason: null,
    requestedAt: '2026-09-23T03:10:00Z',
    decidedAt: null,
  },
];

/** 요청·취소 응답 (ParticipationRequestResponse). 결정 필드가 없다 */
const toResponse = ({
  requestId,
  organizationId,
  organizationName,
  desiredType,
  status,
  requestedAt,
}: ServerParticipationRequest) => ({
  requestId,
  organizationId,
  organizationName,
  desiredType,
  status,
  requestedAt,
});

const at = () => new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();

const fakes = new WeakMap<FakeServer, ParticipationFake>();

export function createParticipationServer({
  server = createFakeServer(),
  requests: seed = [],
  organizations = FAKE_ORGANIZATIONS,
}: {
  server?: FakeServer;
  /** 처음 신청 현황 */
  requests?: readonly ServerParticipationRequest[];
  organizations?: readonly FakeOrganization[];
} = {}) {
  const requests = seed.map(request => ({ ...request }));
  let nextId = Math.max(100, ...requests.map(item => item.requestId)) + 1;
  const byCode = (code: string) =>
    organizations.find(item => item.codes.includes(code));
  const isRetired = (code: string) =>
    organizations.some(item => item.retiredCodes?.includes(code));
  const latest = (organizationId: number, status: ServerStatus) =>
    [...requests]
      .reverse()
      .find(
        item =>
          item.organizationId === organizationId && item.status === status,
      );
  const isMember = (organization: FakeOrganization) =>
    organization.member === true ||
    latest(organization.organizationId, 'APPROVED') !== undefined;
  const unknownCode = (code: string) =>
    fail(
      404,
      isRetired(code)
        ? OrganizationErrorCode.retiredCode
        : OrganizationErrorCode.unknownCode,
    );

  const cancel = (request: ServerParticipationRequest) => () => {
    if (request.status !== 'PENDING') {
      return fail(409, OrganizationErrorCode.alreadyDecided);
    }
    request.status = 'CANCELED';
    return ok(toResponse(request));
  };
  const add = (request: ServerParticipationRequest) => {
    requests.push(request);
    server.on(
      'POST',
      cancelRequestPath(String(request.requestId)),
      cancel(request),
    );
  };
  requests.forEach(request =>
    server.on(
      'POST',
      cancelRequestPath(String(request.requestId)),
      cancel(request),
    ),
  );

  server
    .on('GET', COMPANY_LOOKUP_PATH, call => {
      const code = normalizeCompanyCode(call.query.companyCode ?? '');
      const organization = byCode(code);
      if (!organization) {
        return unknownCode(code);
      }
      const pending = latest(organization.organizationId, 'PENDING');
      return ok({
        organizationId: organization.organizationId,
        organizationName: organization.organizationName,
        availability: isMember(organization)
          ? 'ALREADY_MEMBER'
          : pending
          ? 'PENDING_REQUEST'
          : 'AVAILABLE',
        pendingRequestId: pending?.requestId ?? null,
      });
    })
    .on('POST', PARTICIPATION_REQUESTS_PATH, call => {
      const body = call.body as {
        companyCode?: string;
        desiredType?: ParticipationType;
        requestChannel?: string;
      };
      if (!body.companyCode || !body.desiredType || !body.requestChannel) {
        return fail(400, 'COMMON-400');
      }
      const code = normalizeCompanyCode(body.companyCode);
      const organization = byCode(code);
      if (!organization) {
        return unknownCode(code);
      }
      if (isMember(organization)) {
        return fail(409, OrganizationErrorCode.alreadyMember);
      }
      if (latest(organization.organizationId, 'PENDING')) {
        return fail(409, OrganizationErrorCode.pendingRequest);
      }
      const request: ServerParticipationRequest = {
        requestId: nextId++,
        organizationId: organization.organizationId,
        organizationName: organization.organizationName,
        desiredType: body.desiredType,
        confirmedType: null,
        status: 'PENDING',
        rejectReason: null,
        requestedAt: at(),
        decidedAt: null,
      };
      add(request);
      return ok(toResponse(request));
    })
    .on('GET', PARTICIPATION_REQUESTS_PATH, () =>
      ok({ requests: requests.map(item => ({ ...item })) }),
    );

  const fake = {
    server,
    /** 지금 서버가 들고 있는 요청 (요청 일시순) */
    get requests(): readonly ServerParticipationRequest[] {
      return requests;
    },
    /** 사무실이 승인 대기 요청을 결정한다. requestId 를 주지 않으면 가장 최근 요청이다 */
    decide(decision: FakeDecision, requestId?: number) {
      const request =
        requestId === undefined
          ? requests.at(-1)
          : requests.find(item => item.requestId === requestId);
      if (!request || request.status !== 'PENDING') {
        throw new Error(`결정할 승인 대기 요청이 없다: ${requestId}`);
      }
      request.status = decision.status;
      request.decidedAt = at();
      if (decision.status === 'APPROVED') {
        request.confirmedType = decision.confirmedType ?? request.desiredType;
      } else {
        request.rejectReason = decision.rejectReason ?? null;
      }
      return request;
    },
  };
  fakes.set(server, fake);
  return fake;
}

export type ParticipationFake = ReturnType<typeof createParticipationServer>;

/** 그 가짜 서버에 붙인 회사 참여 서버 (src/app/testing 의 accountServer 가 붙여 둔다) */
export function participationOf(server: FakeServer): ParticipationFake {
  const fake = fakes.get(server);
  if (!fake) {
    throw new Error('회사 참여 가짜 서버를 붙이지 않았다');
  }
  return fake;
}
