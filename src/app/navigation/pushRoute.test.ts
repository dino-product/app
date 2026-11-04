import { parsePushData, pushRouteOf } from './pushRoute';

// 푸시를 눌렀을 때 열 화면 (#118). FCM data(백엔드 FcmPushSender)는 notificationId·type 과 있을 때만 workId·participationRequestId 를
// 문자열로 준다. organizationId 는 없다(#112 G8) — 작업 상세는 발주사 없이 열고, 상세가 활성 기사 소속으로 정한다(#114)

describe('parsePushData', () => {
  it('FCM data 의 문자열 값만 꺼낸다', () => {
    expect(
      parsePushData({
        notificationId: '31',
        type: 'WORK_ASSIGNED',
        workId: '10',
        extra: 'ignored',
      }),
    ).toEqual({ notificationId: '31', type: 'WORK_ASSIGNED', workId: '10' });
  });

  it('참여 결과 알림의 요청 id 를 꺼낸다', () => {
    expect(
      parsePushData({
        notificationId: '32',
        type: 'PARTICIPATION_REQUEST_REJECTED',
        participationRequestId: '3',
      }),
    ).toEqual({
      notificationId: '32',
      type: 'PARTICIPATION_REQUEST_REJECTED',
      participationRequestId: '3',
    });
  });

  it.each([
    ['data 없음', undefined],
    ['객체가 아님', 'WORK_ASSIGNED'],
    ['문자열이 아닌 값', { notificationId: 31, type: {}, workId: 10 }],
  ])('%s → 빈 값', (_, data) => {
    expect(parsePushData(data)).toEqual({});
  });
});

const homeScreen = (screen: string, params?: object) => ({
  screen: 'home',
  params: { screen, params, initial: false },
});

describe('pushRouteOf', () => {
  it.each([
    'WORK_ASSIGNED',
    'WORK_RESCHEDULED',
    'WORK_REASSIGNED_AWAY',
    'WORK_CANCELED',
    'COMPLETION_REPORT_REQUESTED',
  ])('작업 알림 %s → 홈 탭의 그 작업 상세 (발주사는 넘기지 않는다)', type => {
    expect(pushRouteOf({ notificationId: '31', type, workId: '10' })).toEqual(
      homeScreen('WorkDetail', { id: '10' }),
    );
  });

  it('참여 거절 → 마이 탭의 그 요청 거절 화면', () => {
    expect(
      pushRouteOf({
        notificationId: '32',
        type: 'PARTICIPATION_REQUEST_REJECTED',
        participationRequestId: '3',
      }),
    ).toEqual({
      screen: 'my',
      params: {
        screen: 'OrgJoinRejected',
        params: { requestId: '3' },
        initial: false,
      },
    });
  });

  it('참여 승인 → 마이 탭의 신청 현황', () => {
    expect(
      pushRouteOf({
        notificationId: '33',
        type: 'PARTICIPATION_REQUEST_APPROVED',
        participationRequestId: '3',
      }),
    ).toEqual({
      screen: 'my',
      params: { screen: 'OrgJoinRequests', initial: false },
    });
  });

  it.each([
    ['작업 id 가 없는 작업 알림', { type: 'WORK_ASSIGNED' }],
    ['요청 id 가 없는 참여 거절', { type: 'PARTICIPATION_REQUEST_REJECTED' }],
    ['앱이 모르는 종류', { type: 'ROLE_CHANGED', workId: '10' }],
    ['종류 없음', {}],
  ])('%s → 홈 탭의 알림센터', (_, data) => {
    expect(pushRouteOf(data)).toEqual(homeScreen('NotificationCenter'));
  });
});
