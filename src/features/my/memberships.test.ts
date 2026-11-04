import {
  technicianOrganizationId,
  type MembershipResponse,
} from './memberships';

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
