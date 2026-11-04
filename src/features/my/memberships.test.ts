import { ApiErrorMessage, isApiError } from '../../shared/api';
import { createFakeServer, ok } from '../../shared/testing/fakeServer';
import { createTestApi } from '../../shared/testing/renderWithApi';
import { testSession } from '../../shared/testing/session';
import {
  MEMBERSHIPS_PATH,
  membershipsQuery,
  membershipsQueryKey,
  parseMemberships,
  technicianOrganizationId,
  type MembershipResponse,
} from './memberships';

// 백엔드 MyMembershipsResponse 그대로 (api-spec §2.3 O5)
const response = {
  memberships: [
    {
      organizationId: 1,
      organizationName: '오르빗 설비',
      role: 'TECHNICIAN',
      status: 'ACTIVE',
    },
    {
      organizationId: 2,
      organizationName: '현장 파트너스',
      role: 'OWNER',
      status: 'DEACTIVATED',
    },
  ],
};

const thrownBy = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('parseMemberships', () => {
  it('소속 목록을 처음 참여한 순서 그대로 옮긴다', () => {
    expect(parseMemberships(response)).toEqual(response.memberships);
  });

  it('소속이 없으면 빈 목록이다', () => {
    expect(parseMemberships({ memberships: [] })).toEqual([]);
  });

  // 서버에 역할이 늘어도 나머지 소속은 보인다 (라벨을 붙일 수 없는 줄만 뺀다)
  it('앱이 모르는 역할의 소속은 뺀다', () => {
    expect(
      parseMemberships({
        memberships: [
          { ...response.memberships[0], role: 'ADMIN' },
          response.memberships[1],
        ],
      }),
    ).toEqual([response.memberships[1]]);
  });

  it.each([
    ['목록이 없음', {}],
    [
      '상태가 모르는 값',
      { memberships: [{ ...response.memberships[0], status: 'LEFT' }] },
    ],
    [
      '발주사 id 가 숫자가 아님',
      { memberships: [{ ...response.memberships[0], organizationId: '1' }] },
    ],
    [
      '발주사명이 없음',
      { memberships: [{ ...response.memberships[0], organizationName: null }] },
    ],
    ['객체가 아님', null],
  ])('%s 이면 서버 응답 오류로 던진다', (_, value) => {
    const thrown = thrownBy(() => parseMemberships(value));

    expect(isApiError(thrown)).toBe(true);
    expect((thrown as Error).message).toBe(ApiErrorMessage.invalidResponse);
  });
});

describe('membershipsQuery', () => {
  // #114(작업 발주사)·#116(참여 승인 뒤 무효화)과 같은 키를 쓴다
  it('[memberships] 키로 GET /api/v1/memberships 를 불러 소속 목록을 준다', async () => {
    const server = createFakeServer().on('GET', MEMBERSHIPS_PATH, ok(response));
    const { client, queryClient } = createTestApi({
      server,
      session: testSession(),
    });

    await expect(
      queryClient.fetchQuery(membershipsQuery(client)),
    ).resolves.toEqual(response.memberships);
    expect(membershipsQueryKey).toEqual(['memberships']);
    expect(
      server.callsTo('GET', MEMBERSHIPS_PATH)[0].headers.Authorization,
    ).toBe('Bearer access-1');
  });
});

const membership = (
  overrides: Partial<MembershipResponse>,
): MembershipResponse => ({
  organizationId: 1,
  organizationName: '오르빗 설비',
  role: 'TECHNICIAN',
  status: 'ACTIVE',
  ...overrides,
});

describe('technicianOrganizationId', () => {
  it('활성 기사 소속의 발주사를 고른다', () => {
    expect(
      technicianOrganizationId([
        membership({ organizationId: 1, role: 'STAFF' }),
        membership({ organizationId: 2, status: 'DEACTIVATED' }),
        membership({ organizationId: 3 }),
      ]),
    ).toBe(3);
  });

  // 여러 발주사 일정 합산은 백엔드에 없다 (#112 G18). 응답은 처음 참여한 순서라 먼저 참여한 발주사를 쓴다
  it('활성 기사 소속이 여럿이면 처음 참여한(목록의 첫) 발주사를 쓴다', () => {
    expect(
      technicianOrganizationId([
        membership({ organizationId: 5 }),
        membership({ organizationId: 3 }),
      ]),
    ).toBe(5);
  });

  it('활성 기사 소속이 없으면 undefined', () => {
    expect(
      technicianOrganizationId([
        membership({ role: 'OWNER' }),
        membership({ status: 'DEACTIVATED' }),
      ]),
    ).toBeUndefined();
  });
});
