import {
  createFakeServer,
  noContent,
  ok,
  type FakeResponse,
  type FakeServer,
} from '../../shared/testing/fakeServer';
import { createTestApi } from '../../shared/testing/renderWithApi';
import { testSession } from '../../shared/testing/session';
import type { NotificationSettings } from './model';
import { notificationKeys } from './notificationQueries';
import {
  NOTIFICATION_SETTINGS_PATH,
  NOTIFICATIONS_PATH,
  notificationReadPath,
  type NotificationResponse,
  type NotificationsResponse,
} from './notificationApi';

// 알림센터·알림 설정 테스트 도구 (#117). 사용법:
//   await renderWithApi(<NotificationCenterScreen … />, { server: notificationServer(), session: testSession() })
//   App 흐름은 app/testing 의 accountServer 가 이 가짜 서버를 붙인다 (renderSignedInApp({ notifications }))
// 가짜 서버는 백엔드처럼 쪽을 나눠 주고, 읽음·설정 저장을 기억한다

const HOUR = 60 * 60_000;

/**
 * 알림센터 예시 (Figma 마이페이지-알림센터). 상대 시간이 Figma 처럼 보이도록 지금을 기준으로 만든다.
 * 작업 알림의 workId(102~107)는 로컬 작업 저장소 시드(features/work/data/localSeed: 101~106)와 일부러 겹친다.
 * 앱 흐름 테스트에서 알림으로 연 작업 상세가 로컬 저장소의 작업을 그리게 하려는 것이다(102 작업전, 104 수락 대기).
 * 운영에서는 서버 알림의 workId 를 로컬 시드에서 찾는 한계가 있다(기사 작업 API 가 생기면 HTTP 저장소로 맞는다, #112)
 */
export function notificationResponsesMock(now: Date): NotificationResponse[] {
  const hoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * HOUR).toISOString();
  const work = (
    id: number,
    type: NotificationResponse['type'],
    message: string,
    read: boolean,
    hours: number,
  ): NotificationResponse => ({
    id,
    type,
    organizationId: 1,
    workId: 100 + id,
    participationRequestId: null,
    message,
    read,
    createdAt: hoursAgo(hours),
  });
  return [
    // 참여 신청 현황의 거절된 요청. 누르면 거절 화면을 연다 (#73)
    {
      id: 1,
      type: 'PARTICIPATION_REQUEST_REJECTED',
      organizationId: 2,
      workId: null,
      participationRequestId: 3,
      message: '[스마트 홈케어] 참여 요청이 거절되었습니다.',
      read: false,
      createdAt: hoursAgo(1),
    },
    work(
      2,
      'WORK_CANCELED',
      '[정수기 필터 교체] 작업이 취소되었습니다.',
      false,
      3,
    ),
    work(
      3,
      'WORK_ASSIGNED',
      '[에어컨 필터 교체] 작업이 배정되었습니다.',
      false,
      3,
    ),
    work(4, 'WORK_ASSIGNED', '[보일러 점검] 작업이 배정되었습니다.', false, 3),
    work(5, 'WORK_ASSIGNED', '[세탁기 설치] 작업이 배정되었습니다.', true, 7),
    work(
      6,
      'WORK_ASSIGNED',
      '[식기세척기 수리] 작업이 배정되었습니다.',
      true,
      21,
    ),
    work(
      7,
      'WORK_ASSIGNED',
      '[정수기 필터 교체] 작업이 배정되었습니다.',
      true,
      49,
    ),
  ];
}

/** 바꾼 적 없는 계정의 알림 설정 (서버 기본값: 모두 켬) */
export const notificationSettingsMock: NotificationSettings = {
  workAssignmentEnabled: true,
  scheduleChangeEnabled: true,
  workCancellationEnabled: true,
};

/** 알림 목록 한 쪽. 캐시에 미리 넣거나 응답을 직접 정할 때 쓴다 */
export function notificationsPage(
  notifications: NotificationResponse[],
  { page = 0, size = 20, totalCount = notifications.length } = {},
): NotificationsResponse {
  return { notifications, totalCount, page, size };
}

/** 설정 저장(PUT) 한 번의 응답. 함수면 그 답을 기다린다 (보내는 사이를 시험할 때) */
type SaveResponse = FakeResponse | (() => Promise<FakeResponse>);

/**
 * 알림 API 를 정한 가짜 서버. 목록은 page·size 로 잘라 주고, 읽음(PUT)은 그 알림을 읽음으로 바꾼다.
 * 설정은 저장(PUT)에 성공한 값을 다음 조회가 준다.
 * settingsSaves 로 저장 응답을 차례로 정한다(마지막 것을 되풀이, 기본은 204).
 * server 를 주면 그 서버에 더한다. 응답을 바꾸려면 돌려받은 서버에 다시 on 으로 정한다
 */
export function notificationServer({
  server = createFakeServer(),
  notifications = notificationResponsesMock(new Date()),
  settings = notificationSettingsMock,
  settingsSaves = [noContent()],
}: {
  server?: FakeServer;
  notifications?: NotificationResponse[];
  settings?: NotificationSettings;
  settingsSaves?: SaveResponse[];
} = {}) {
  let items = notifications;
  let saved = settings;
  let saves = 0;
  server
    .on('GET', NOTIFICATIONS_PATH, ({ query }) => {
      const page = Number(query.page ?? 0);
      const size = Number(query.size ?? 20);
      return ok(
        notificationsPage(items.slice(page * size, (page + 1) * size), {
          page,
          size,
          totalCount: items.length,
        }),
      );
    })
    .on('GET', NOTIFICATION_SETTINGS_PATH, () => ok(saved))
    .on('PUT', NOTIFICATION_SETTINGS_PATH, async ({ body }) => {
      const next = settingsSaves[Math.min(saves, settingsSaves.length - 1)];
      saves += 1;
      const response = typeof next === 'function' ? await next() : next;
      if (response.type === 'response' && response.status < 300) {
        saved = body as NotificationSettings;
      }
      return response;
    });
  for (const { id } of items) {
    server.on('PUT', notificationReadPath(String(id)), () => {
      items = items.map(item =>
        item.id === id ? { ...item, read: true } : item,
      );
      return noContent();
    });
  }
  return server;
}

/**
 * 알림 목록(예시 7개)·설정을 캐시에 미리 넣은 테스트 클라이언트. 신선한 값으로 두어 마운트 때 서버에 묻지 않는다.
 * 렌더 예산(perf-test)·레이아웃 테스트처럼 그린 모양만 볼 때 쓴다
 */
export function cachedNotificationTestApi(now: Date) {
  const api = createTestApi({ session: testSession() });
  for (const key of [notificationKeys.list, notificationKeys.settings]) {
    api.queryClient.setQueryDefaults(key, { staleTime: Infinity });
  }
  // 상대 시간은 받은 시각 기준이라 now 에 받은 것으로 둔다
  api.queryClient.setQueryData(
    notificationKeys.list,
    {
      pages: [notificationsPage(notificationResponsesMock(now))],
      pageParams: [0],
    },
    { updatedAt: now.getTime() },
  );
  api.queryClient.setQueryData(
    notificationKeys.settings,
    notificationSettingsMock,
  );
  return api;
}
