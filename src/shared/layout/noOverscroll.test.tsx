import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { makeHistoryMock } from '../../features/history/mockData';
import { WorkHistoryScreen } from '../../features/history/screens/WorkHistoryScreen';
import { cachedNotificationTestApi } from '../../features/my/notificationTesting';
import type { ParticipationRequest } from '../../features/my/org/model';
import { createParticipationServer } from '../../features/my/org/testing';
import { JoinRejectedScreen } from '../../features/my/org/screens/JoinRejectedScreen';
import { JoinRequestedScreen } from '../../features/my/org/screens/JoinRequestedScreen';
import { JoinRequestsScreen } from '../../features/my/org/screens/JoinRequestsScreen';
import { OrgJoinScreen } from '../../features/my/org/screens/OrgJoinScreen';
import { RoleSelectScreen } from '../../features/my/org/screens/RoleSelectScreen';
import { AccountScreen } from '../../features/my/screens/AccountScreen';
import { MyPageScreen } from '../../features/my/screens/MyPageScreen';
import { NotificationCenterScreen } from '../../features/my/screens/NotificationCenterScreen';
import { NotificationSettingsScreen } from '../../features/my/screens/NotificationSettingsScreen';
import { ProfileEditScreen } from '../../features/my/screens/ProfileEditScreen';
import { TermsScreen } from '../../features/my/screens/TermsScreen';
import { WithdrawalBlockedScreen } from '../../features/my/screens/WithdrawalBlockedScreen';
import { WithdrawalScreen } from '../../features/my/screens/WithdrawalScreen';
import {
  myMemberships,
  myProfile,
  myServer,
  seedMyCache,
} from '../../features/my/profileTesting';
import { JoinApprovedScreen } from '../../features/onboarding/screens/JoinApprovedScreen';
import { ProfileRegisterScreen } from '../../features/onboarding/screens/ProfileRegisterScreen';
import { TermsAgreementScreen } from '../../features/onboarding/screens/TermsAgreementScreen';
import { makeScheduleMock } from '../../features/schedule/mockData';
import { RejectReasonScreen } from '../../features/schedule/screens/RejectReasonScreen';
import { RequestDetailScreen } from '../../features/schedule/screens/RequestDetailScreen';
import { ScheduleScreen } from '../../features/schedule/screens/ScheduleScreen';
import {
  currentWork,
  weeklySchedule,
  workDetail,
} from '../../features/work/mockData';
import { WorkDetailScreen } from '../../features/work/screens/WorkDetailScreen';
import { WorkHomeScreen } from '../../features/work/screens/WorkHomeScreen';
import { createTestApi } from '../testing/renderWithApi';
import { testSession } from '../testing/session';

// 새로고침이 없는 화면은 맨 위에서 아래로 끌어도 내용이 내려오지 않는다 (#103).
// 시트·모달 안의 스크롤(약관 시트 등)은 범위 밖이라 화면 본문의 첫 스크롤 뷰만 본다

const noop = () => {};
const today = new Date(2026, 8, 19);
const schedule = makeScheduleMock(today);

// 서버에서 받는 화면(알림센터·알림 설정, #117)은 캐시에 넣어 둔 값으로 바로 그린다
const notificationApi = cachedNotificationTestApi(today);
const withNotificationApi = (element: ReactElement) => (
  <notificationApi.wrapper>{element}</notificationApi.wrapper>
);

const request: ParticipationRequest = {
  requestId: 'request-1',
  organizationId: 'org-9',
  organizationName: 'Orbit',
  desiredType: 'TECHNICIAN',
  status: 'PENDING',
  requestChannel: 'COMPANY_CODE',
  requestedAt: new Date(2026, 8, 23, 10, 24).toISOString(),
};

const blocked: [string, ReactElement][] = [
  [
    '마이페이지',
    <MyPageScreen
      profile={{ status: 'ready', data: myProfile }}
      memberships={{ status: 'ready', data: myMemberships }}
      pendingRequestCount={0}
      onOpenNotifications={noop}
      onEditProfile={noop}
      onOpenRequestStatus={noop}
      onJoinOrganization={noop}
      onOpenNotificationSettings={noop}
      onOpenTerms={noop}
      onOpenAccount={noop}
    />,
  ],
  ['프로필 수정', <ProfileEditScreen onBack={noop} onSaved={noop} />],
  [
    '알림 설정',
    withNotificationApi(<NotificationSettingsScreen onBack={noop} />),
  ],
  [
    '약관 및 앱 정보',
    <TermsScreen
      links={{ terms: '', privacy: '', openSource: '' }}
      appVersion="1.0"
      onOpenLink={noop}
      onBack={noop}
    />,
  ],
  [
    '계정 관리',
    <AccountScreen
      onBack={noop}
      onLogout={noop}
      checkWithdrawal={async () => ({ withdrawable: true, blocks: [] })}
      onOpenWithdrawal={noop}
      onOpenWithdrawalBlocked={noop}
    />,
  ],
  [
    '계정 탈퇴',
    <WithdrawalScreen onBack={noop} onWithdrawn={noop} onBlocked={noop} />,
  ],
  ['탈퇴 불가', <WithdrawalBlockedScreen onOpenBlock={noop} onBack={noop} />],
  [
    '작업 상세',
    <WorkDetailScreen
      work={workDetail}
      onBack={noop}
      onSubmitReport={() => ({ kind: 'submitted', at: '' })}
      onDone={noop}
      onCall={noop}
      onNavigate={noop}
      onOpenMap={noop}
      onPickPhoto={async () => []}
    />,
  ],
  [
    '응답 필요 작업 상세',
    <RequestDetailScreen
      work={workDetail}
      onBack={noop}
      onAccept={async () => true}
      onReject={noop}
      onCall={noop}
      onNavigate={noop}
      onOpenMap={noop}
    />,
  ],
  ['거절 사유', <RejectReasonScreen onBack={noop} onSubmit={noop} />],
  [
    '조직 참여하기',
    <OrgJoinScreen onBack={noop} onFound={noop} onScanQr={noop} />,
  ],
  [
    '참여 유형 선택',
    <RoleSelectScreen
      target={{
        organizationId: '9',
        organizationName: 'Orbit',
        companyCode: 'RBT124',
        requestChannel: 'COMPANY_CODE',
      }}
      onBack={noop}
      onRequested={noop}
      onAlreadyMember={noop}
      onPendingExists={noop}
    />,
  ],
  [
    '참여 요청을 보냈어요',
    <JoinRequestedScreen
      request={request}
      onConfirm={noop}
      onCanceled={noop}
      onAlreadyDecided={noop}
      onBack={noop}
    />,
  ],
  [
    '참여 요청 거절',
    <JoinRejectedScreen
      request={{ ...request, status: 'REJECTED', rejectReason: '사유' }}
      onConfirm={noop}
      onBack={noop}
    />,
  ],
  [
    '온보딩 프로필 등록',
    <ProfileRegisterScreen onBack={noop} onSubmit={noop} />,
  ],
  ['온보딩 약관 동의', <TermsAgreementScreen onBack={noop} onSignUp={noop} />],
  [
    '온보딩 참여 완료',
    <JoinApprovedScreen
      request={{ ...request, status: 'APPROVED', approvedType: 'TECHNICIAN' }}
      onStart={noop}
      onBack={noop}
    />,
  ],
];

// 서버 목록이라 이후 당겨서 새로고침을 붙일 자리 (기본안)
const refreshable: [string, ReactElement][] = [
  [
    '내 작업 홈',
    <WorkHomeScreen
      currentWork={currentWork}
      schedule={weeklySchedule}
      today={today}
      weekLabel="9. 14. – 9. 20."
      started={false}
      onStartWork={noop}
      onOpenWork={noop}
      onOpenNotifications={noop}
    />,
  ],
  [
    '내 일정',
    <ScheduleScreen
      today={today}
      confirmed={schedule.confirmed}
      pending={schedule.pending}
      onAccept={async () => true}
      onReject={noop}
      onOpenRequest={noop}
    />,
  ],
  [
    '작업 이력',
    <WorkHistoryScreen
      today={today}
      works={makeHistoryMock(today)}
      onOpenWork={noop}
    />,
  ],
  ['알림센터', withNotificationApi(<NotificationCenterScreen onBack={noop} />)],
  ['신청 현황', <JoinRequestsScreen onJoin={noop} onBack={noop} />],
];

// 서버 상태를 읽는 화면은 API 를 붙여 그린다. 조직 참여(#116)는 빈 신청 현황, 마이페이지·프로필 수정·탈퇴 불가(#115)는
// 받아 둔 프로필·소속·탈퇴 가능 여부로 그린다
async function firstScrollView(element: ReactElement) {
  const api = createTestApi({
    server: myServer({ server: createParticipationServer().server }),
    session: testSession(),
  });
  seedMyCache(api.queryClient, {
    eligibility: {
      withdrawable: false,
      blocks: [{ reason: 'WORK_IN_PROGRESS', count: 1 }],
    },
  });
  const { container } = await render(element, { wrapper: api.wrapper });
  const [scroll] = container.queryAll(node => node.type === 'RCTScrollView');
  expect(scroll).toBeDefined();
  return scroll;
}

describe('위로 끌리는 스크롤 (iOS 바운스 · Android 오버스크롤)', () => {
  it.each(blocked)('%s: 막는다', async (_, element) => {
    const scroll = await firstScrollView(element);

    expect(scroll.props.bounces).toBe(false);
    expect(scroll.props.overScrollMode).toBe('never');
  });

  it.each(refreshable)(
    '%s: 새로고침 자리라 그대로 둔다',
    async (_, element) => {
      const scroll = await firstScrollView(element);

      expect(scroll.props.bounces).not.toBe(false);
      expect(scroll.props.overScrollMode).not.toBe('never');
    },
  );
});
