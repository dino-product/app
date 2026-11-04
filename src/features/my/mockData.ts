import type {
  AppNotification,
  Membership,
  NotificationSettings,
  Profile,
  WithdrawalEligibility,
} from './model';

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

export const notificationSettingsMock: NotificationSettings = {
  workAssignmentEnabled: true,
  scheduleChangeEnabled: true,
  workCancellationEnabled: true,
};

const HOUR = 60 * 60_000;

/** 알림센터 예시. 상대 시간이 Figma 처럼 보이도록 지금을 기준으로 만든다 */
export function makeNotificationsMock(now: Date): AppNotification[] {
  const hoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * HOUR).toISOString();
  return [
    // 거절된 참여 요청. 누르면 거절 화면을 열고 사유는 서버 신청 현황에서 받는다 (#73, #116).
    // 요청 id 는 서버 숫자 id 를 문자열로 바꾼 값이다 (org/participationApi)
    {
      id: 'notification-0',
      type: 'PARTICIPATION_REQUEST_REJECTED',
      message: '[스마트 홈케어] 참여 요청이 거절되었습니다.',
      read: false,
      createdAt: hoursAgo(1),
      participationRequestId: '3',
    },
    {
      id: 'notification-1',
      type: 'WORK_CANCELED',
      message: '[정수기 필터 교체] 작업이 취소되었습니다.',
      read: false,
      createdAt: hoursAgo(3),
    },
    {
      id: 'notification-2',
      type: 'WORK_ASSIGNED',
      message: '[에어컨 필터 교체] 작업이 배정되었습니다.',
      read: false,
      createdAt: hoursAgo(3),
    },
    {
      id: 'notification-3',
      type: 'WORK_ASSIGNED',
      message: '[보일러 점검] 작업이 배정되었습니다.',
      read: false,
      createdAt: hoursAgo(3),
    },
    {
      id: 'notification-4',
      type: 'WORK_ASSIGNED',
      message: '[세탁기 설치] 작업이 배정되었습니다.',
      read: true,
      createdAt: hoursAgo(7),
    },
    {
      id: 'notification-5',
      type: 'WORK_ASSIGNED',
      message: '[식기세척기 수리] 작업이 배정되었습니다.',
      read: true,
      createdAt: hoursAgo(21),
    },
    {
      id: 'notification-6',
      type: 'WORK_ASSIGNED',
      message: '[정수기 필터 교체] 작업이 배정되었습니다.',
      read: true,
      createdAt: hoursAgo(49),
    },
  ];
}

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
