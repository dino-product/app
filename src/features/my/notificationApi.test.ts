import { formatRelativeTime } from './model';
import {
  flattenNotificationPages,
  nextNotificationPage,
  toAppNotification,
  type NotificationResponse,
  type NotificationsResponse,
} from './notificationApi';

const response = (
  patch: Partial<NotificationResponse> = {},
): NotificationResponse => ({
  id: 31,
  type: 'WORK_ASSIGNED',
  organizationId: 1,
  workId: 10,
  participationRequestId: null,
  message: '10월 21일 09:00 [보일러 점검] 작업이 배정되었습니다.',
  read: false,
  createdAt: '2026-10-19T03:00:00Z',
  ...patch,
});

const page = (
  notifications: NotificationResponse[],
  patch: Partial<NotificationsResponse> = {},
): NotificationsResponse => ({
  notifications,
  totalCount: notifications.length,
  page: 0,
  size: 20,
  ...patch,
});

describe('toAppNotification', () => {
  it('작업 알림의 id·발주사·작업을 문자열로 바꾸고 문구·읽음·시각은 그대로 둔다', () => {
    expect(toAppNotification(response())).toEqual({
      id: '31',
      type: 'WORK_ASSIGNED',
      message: '10월 21일 09:00 [보일러 점검] 작업이 배정되었습니다.',
      read: false,
      createdAt: '2026-10-19T03:00:00Z',
      organizationId: '1',
      workId: '10',
    });
  });

  it('참여 요청 결과 알림은 참여 요청 id 를 담고 작업은 없다', () => {
    expect(
      toAppNotification(
        response({
          id: 7,
          type: 'PARTICIPATION_REQUEST_REJECTED',
          workId: null,
          participationRequestId: 3,
          read: true,
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        id: '7',
        read: true,
        participationRequestId: '3',
        workId: undefined,
      }),
    );
  });

  it('발주사가 없으면 비워 둔다', () => {
    expect(
      toAppNotification(response({ organizationId: null }))?.organizationId,
    ).toBeUndefined();
  });

  // 사무실 알림(수락·거절·완료보고 제출)은 기사 앱에 오지 않는다. 와도 그릴 종류가 없어 뺀다
  it.each(['WORK_ACCEPTED', 'COMPLETION_REPORT_SUBMITTED', 'UNKNOWN'])(
    '앱이 모르는 종류(%s)는 null 이다',
    type => {
      expect(toAppNotification(response({ type }))).toBeNull();
    },
  );

  // 서버 시각은 UTC 다. 화면은 기기 시각과의 차이로 '3시간 전' 처럼 쓴다
  it('UTC 알림 시각을 상대 시간으로 보여 줄 수 있다', () => {
    const notification = toAppNotification(
      response({ createdAt: '2026-10-19T03:00:00Z' }),
    );

    expect(
      formatRelativeTime(
        notification!.createdAt,
        new Date('2026-10-19T06:30:00Z'),
      ),
    ).toBe('3시간 전');
  });
});

describe('nextNotificationPage', () => {
  it('아직 받지 않은 알림이 있으면 다음 쪽 번호다', () => {
    expect(
      nextNotificationPage(
        page(
          Array.from({ length: 20 }, (_, i) => response({ id: i })),
          {
            totalCount: 45,
          },
        ),
      ),
    ).toBe(1);
  });

  it.each<[string, NotificationsResponse]>([
    [
      '마지막 쪽이면',
      page([response()], { page: 2, size: 20, totalCount: 41 }),
    ],
    [
      '받은 수가 전체와 딱 맞으면',
      page(
        Array.from({ length: 20 }, (_, i) => response({ id: i })),
        { totalCount: 20 },
      ),
    ],
    // 그사이 알림이 숨겨져(작업 거절) 전체가 줄면 끝을 넘은 쪽은 빈 배열이다
    ['빈 쪽이면', page([], { page: 3, totalCount: 100 })],
    // 서버는 page×size 가 10,000 을 넘는 쪽을 NOTIFICATION-001 로 거절한다
    [
      '다음 쪽이 서버의 조회 한도(10,000)를 넘으면',
      page([response()], { page: 500, size: 20, totalCount: 20000 }),
    ],
  ])('%s 더 받지 않는다', (_, last) => {
    expect(nextNotificationPage(last)).toBeUndefined();
  });

  it('한도에 딱 닿는 쪽까지는 받는다', () => {
    expect(
      nextNotificationPage(
        page([response()], { page: 499, size: 20, totalCount: 20000 }),
      ),
    ).toBe(500);
  });
});

describe('flattenNotificationPages', () => {
  it('쪽을 차례로 이어 붙인다', () => {
    const items = flattenNotificationPages([
      page([response({ id: 3 }), response({ id: 2 })]),
      page([response({ id: 1 })], { page: 1 }),
    ]);

    expect(items.map(item => item.id)).toEqual(['3', '2', '1']);
  });

  // 오프셋 쪽이라 받는 사이 새 알림이 오면 앞 쪽 끝 알림이 다음 쪽 앞에 또 온다
  it('새 알림으로 밀려 두 쪽에 같이 온 알림은 한 번만 둔다', () => {
    const items = flattenNotificationPages([
      page([response({ id: 3 }), response({ id: 2 })]),
      page([response({ id: 2 }), response({ id: 1 })], { page: 1 }),
    ]);

    expect(items.map(item => item.id)).toEqual(['3', '2', '1']);
  });

  it('앱이 모르는 종류는 뺀다', () => {
    const items = flattenNotificationPages([
      page([
        response({
          id: 2,
          type: 'WORK_ACCEPTED',
        }),
        response({ id: 1 }),
      ]),
    ]);

    expect(items.map(item => item.id)).toEqual(['1']);
  });

  // 한 줄만 읽음이 되면 나머지 줄은 같은 객체라 목록 행(memo)이 다시 그려지지 않는다
  it('바뀌지 않은 서버 알림은 같은 화면 알림 객체로 바꾼다', () => {
    const unchanged = response({ id: 2 });
    const before = flattenNotificationPages([
      page([response({ id: 3 }), unchanged]),
    ]);
    const after = flattenNotificationPages([
      page([response({ id: 3, read: true }), unchanged]),
    ]);

    expect(after[1]).toBe(before[1]);
    expect(after[0]).not.toBe(before[0]);
    expect(after[0].read).toBe(true);
  });
});
