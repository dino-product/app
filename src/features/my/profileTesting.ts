import type { QueryClient } from '@tanstack/react-query';
import {
  createFakeServer,
  ok,
  type FakeServer,
} from '../../shared/testing/fakeServer';
import {
  parseProfile,
  profilePath,
  profileQueryKey,
} from '../onboarding/profileApi';
import {
  MEMBERSHIPS_PATH,
  membershipsQueryKey,
  type MembershipResponse,
} from './memberships';
import type { WithdrawalEligibility } from './model';
import {
  withdrawalEligibilityPath,
  withdrawalEligibilityQueryKey,
} from './withdrawalApi';

// 마이 탭 화면 테스트 도구 (#115). 서버 응답 모양(ProfileResponse·MyMembershipsResponse)으로 만든다. 사용법:
//   await renderWithApi(<MyPageScreen … />, { server: myServer(), session: testSession() })
//   처음부터 받아 둔 값으로 그리려면 const api = createTestApi(); seedMyCache(api.queryClient)

/** testSession() 의 계정 */
export const MY_ACCOUNT_ID = 1;
export const MY_PROFILE_PATH = profilePath(MY_ACCOUNT_ID);
export const MY_ELIGIBILITY_PATH = withdrawalEligibilityPath(MY_ACCOUNT_ID);

/** 가입을 마친 계정의 ProfileResponse. 한국 시간 2024.03.15 정오에 가입했다 (어느 시간대에서 봐도 같은 날) */
export function myProfileResponse(
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    accountId: MY_ACCOUNT_ID,
    status: 'ACTIVE',
    nextStep: 'COMPLETED',
    name: '김현진',
    phoneNumber: '01012345678',
    signedUpAt: '2024-03-15T03:00:00Z',
    marketingAgreed: false,
    ...overrides,
  };
}

/** 소속 발주사 셋 (총관리자 활성, 기사 비활성, 총관리자 활성) */
export const myMemberships: readonly MembershipResponse[] = [
  {
    organizationId: 1,
    organizationName: '오빗 서비스',
    role: 'OWNER',
    status: 'ACTIVE',
  },
  {
    organizationId: 2,
    organizationName: '현장 파트너스',
    role: 'TECHNICIAN',
    status: 'DEACTIVATED',
  },
  {
    organizationId: 3,
    organizationName: '테크 솔루션',
    role: 'OWNER',
    status: 'ACTIVE',
  },
];

/** 프로필·소속 조회에 답하는 가짜 서버 */
export function myServer({
  profile = myProfileResponse(),
  memberships = myMemberships,
  server = createFakeServer(),
}: {
  profile?: unknown;
  memberships?: readonly MembershipResponse[];
  server?: FakeServer;
} = {}) {
  return server
    .on('GET', MY_PROFILE_PATH, ok(profile))
    .on('GET', MEMBERSHIPS_PATH, ok({ memberships }));
}

/** 이미 받아 둔 프로필·소속·탈퇴 가능 여부. 화면이 처음 그릴 때부터 값이 있다 */
export function seedMyCache(
  queryClient: QueryClient,
  {
    profile = myProfileResponse(),
    memberships = myMemberships,
    eligibility,
  }: {
    profile?: unknown;
    memberships?: readonly MembershipResponse[];
    eligibility?: WithdrawalEligibility;
  } = {},
) {
  queryClient.setQueryData(profileQueryKey, parseProfile(profile));
  queryClient.setQueryData(membershipsQueryKey, [...memberships]);
  if (eligibility) {
    queryClient.setQueryData(withdrawalEligibilityQueryKey, eligibility);
  }
}
