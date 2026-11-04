import type { Membership, Profile, WithdrawalEligibility } from './model';

// Figma 마이페이지 섹션의 예시 데이터. API 연동 전까지 마이 탭 상태(MyStateProvider)의 초기값이다.

export const profileMock: Profile = {
  name: '김현진',
  phoneNumber: '01012345678',
  // 한국 시간 2024.03.15 정오. 어느 시간대에서 봐도 같은 날이다
  signedUpAt: '2024-03-15T03:00:00Z',
};

export const membershipsMock: readonly Membership[] = [
  {
    organizationId: 'org-1',
    organizationName: '오빗 서비스',
    role: 'OWNER',
    status: 'ACTIVE',
  },
  {
    organizationId: 'org-2',
    organizationName: '현장 파트너스',
    role: 'TECHNICIAN',
    status: 'DEACTIVATED',
  },
  {
    organizationId: 'org-3',
    organizationName: '테크 솔루션',
    role: 'OWNER',
    status: 'ACTIVE',
  },
];

/**
 * 탈퇴 가능 여부. 서버는 기사 소속의 작업중·응답 전 작업을 센다.
 * 목에서는 앱 상태(진행 중인 작업, 내 일정의 응답 필요)로 계산해 두 갈래를 앱에서 모두 볼 수 있게 한다
 */
export function checkWithdrawalEligibilityMock({
  workInProgress,
  pendingAccept,
}: {
  workInProgress: number;
  pendingAccept: number;
}): WithdrawalEligibility {
  const blocks = [
    { reason: 'WORK_IN_PROGRESS' as const, count: workInProgress },
    { reason: 'WORK_PENDING_ACCEPT' as const, count: pendingAccept },
  ].filter(block => block.count > 0);
  return { withdrawable: blocks.length === 0, blocks };
}
