import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import { colors, pressedBackground } from '../../../shared/design-system';
import {
  fail,
  hang,
  networkError,
  noContent as noContentResponse,
  ok,
  type FakeResponse,
  type FakeServer,
} from '../../../shared/testing/fakeServer';
import { pressIn } from '../../../shared/testing/press';
import { expectOnlySkeletons } from '../../../shared/testing/skeleton';
import { expectPressedBackground } from '../../../shared/testing/pressFeedback';
import { renderWithApi } from '../../../shared/testing/renderWithApi';
import { testSession } from '../../../shared/testing/session';
import type { QueryClient } from '@tanstack/react-query';
import { membershipsQueryKey } from '../memberships';
import {
  NOTIFICATIONS_PATH,
  notificationReadPath,
  type NotificationResponse,
  type NotificationsResponse,
} from '../notificationApi';
import { notificationKeys } from '../notificationQueries';
import { participationRequestsKey } from '../org/participationQueries';
import {
  notificationResponsesMock,
  notificationServer,
  notificationsPage,
} from '../notificationTesting';
import { NotificationCenterScreen } from './NotificationCenterScreen';

const HOUR = 60 * 60_000;
const now = new Date(2026, 10, 2, 15, 0);
const notifications = notificationResponsesMock(now);

// 상대 시간은 목록을 받은 시각 기준이다. 시계를 now 에서 시작해 흐르게 하고, 테스트가 앞으로 돌린다
const realNow = Date.now.bind(Date);
let clockOffset = 0;
const advanceClock = (ms: number) => {
  clockOffset += ms;
};
beforeEach(() => {
  clockOffset = now.getTime() - realNow();
  jest.spyOn(Date, 'now').mockImplementation(() => realNow() + clockOffset);
});
afterEach(() => {
  jest.restoreAllMocks();
});

type Options = {
  server?: FakeServer;
  focused?: boolean;
};

async function renderCenter({
  server = notificationServer({ notifications }),
  focused,
}: Options = {}) {
  const onOpen = jest.fn();
  const ui = (isFocused?: boolean) => (
    <NotificationCenterScreen
      focused={isFocused}
      onOpen={onOpen}
      onBack={jest.fn()}
    />
  );
  const view = await renderWithApi(ui(focused), {
    server,
    session: testSession(),
    // 시계를 앞으로 돌려도 로그인 토큰은 만료되지 않게 둔다
    now: () => now.getTime(),
  });
  return {
    ...view,
    onOpen,
    setFocused: (isFocused: boolean) => view.rerender(ui(isFocused)),
  };
}

const row = (id: string) => screen.getByTestId(`notification-${id}`);
const list = () => screen.getByTestId('notification-list');
const listCalls = (server: FakeServer) =>
  server.callsTo('GET', NOTIFICATIONS_PATH);

const manyNotifications = (count: number): NotificationResponse[] =>
  Array.from({ length: count }, (_, index) => ({
    ...notifications[2],
    id: count - index,
    workId: 1000 + index,
  }));

// 캐시(서버 쪽 모양)에 남은 그 알림의 읽음
const readInCache = (queryClient: QueryClient, id: number) =>
  queryClient
    .getQueryData<{ pages: NotificationsResponse[] }>(notificationKeys.list)
    ?.pages.flatMap(page => page.notifications)
    .find(item => item.id === id)?.read;

// 테스트 렌더러에는 레이아웃이 없어 스크롤 대신 끝에 닿은 이벤트를 바로 보낸다
const scrollToEnd = () => fireEvent(list(), 'endReached');

describe('NotificationCenterScreen', () => {
  it('서버 알림을 받아 종류, 내용, 상대 시간을 보여준다', async () => {
    await renderCenter();

    expect(screen.getByRole('header', { name: '알림센터' })).toBeOnTheScreen();
    expect(await screen.findByText('작업 취소')).toBeOnTheScreen();
    expect(
      screen.getByText('[정수기 필터 교체] 작업이 취소되었습니다.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('1시간 전')).toBeOnTheScreen();
    expect(screen.getAllByText('3시간 전')).toHaveLength(3);
    expect(screen.getByText('7시간 전')).toBeOnTheScreen();
    expect(screen.getByText('21시간 전')).toBeOnTheScreen();
    expect(screen.getByText('2일 전')).toBeOnTheScreen();
  });

  it('받는 동안 알림 행을 닮은 스켈레톤을 보인다 (스피너 없음)', async () => {
    const server = notificationServer().on('GET', NOTIFICATIONS_PATH, hang());
    await renderCenter({ server });

    expectOnlySkeletons('notification-list-skeleton');
    expect(screen.queryByText('새 알림이 없어요')).not.toBeOnTheScreen();
  });

  it('받지 못하면 오류와 다시 시도를 보이고, 누르면 다시 받는다', async () => {
    const server = notificationServer().on(
      'GET',
      NOTIFICATIONS_PATH,
      networkError(),
      ok(notificationsPage(notifications)),
    );
    await renderCenter({ server });

    expect(
      await screen.findByText('알림을 불러오지 못했어요'),
    ).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('작업 취소')).toBeOnTheScreen();
    expect(listCalls(server)).toHaveLength(2);
  });

  it('알림이 없으면 빈 상태 문구를 보여준다', async () => {
    await renderCenter({ server: notificationServer({ notifications: [] }) });

    expect(await screen.findByText('새 알림이 없어요')).toBeOnTheScreen();
  });

  it('끝까지 내리면 다음 쪽을 이어 불러오고, 마지막 쪽이면 더 부르지 않는다', async () => {
    const server = notificationServer({ notifications: manyNotifications(25) });
    await renderCenter({ server });
    await screen.findByTestId('notification-25');

    await scrollToEnd();
    await waitFor(() => expect(listCalls(server)).toHaveLength(2));
    expect(listCalls(server)[1].query).toMatchObject({ page: '1', size: '20' });

    await scrollToEnd();
    expect(listCalls(server)).toHaveLength(2);
  });

  it('다음 쪽을 받지 못하면 목록 끝에 다시 시도를 보이고, 누르면 그 쪽을 다시 받는다', async () => {
    const all = manyNotifications(25);
    const pageOf = (page: number) =>
      ok(
        notificationsPage(all.slice(page * 20, (page + 1) * 20), {
          page,
          totalCount: 25,
        }),
      );
    const server = notificationServer().on(
      'GET',
      NOTIFICATIONS_PATH,
      pageOf(0),
      fail(500, 'COMMON-500'),
      pageOf(1),
    );
    await renderCenter({ server });
    await screen.findByTestId('notification-25');

    await scrollToEnd();
    await userEvent.press(
      await screen.findByRole('button', { name: '다시 시도' }),
    );

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull(),
    );
    expect(listCalls(server).map(call => call.query.page)).toEqual([
      '0',
      '1',
      '1',
    ]);
    // 앞 쪽은 그대로 보인다
    expect(row('25')).toBeOnTheScreen();
  });

  it('당겨서 새로고침하면 목록을 다시 받는다', async () => {
    const server = notificationServer({ notifications });
    await renderCenter({ server });
    await screen.findByText('작업 취소');

    await fireEvent(list(), 'refresh');

    expect(listCalls(server)).toHaveLength(2);
  });

  // 알림 화면에 다시 들어오면(위에 연 작업 상세를 닫음 등) 목록을 새로 받는다
  it('다시 보이면 목록을 다시 받는다', async () => {
    const server = notificationServer({ notifications });
    const { setFocused } = await renderCenter({ server });
    await screen.findByText('작업 취소');

    await setFocused(false);
    await setFocused(true);

    await waitFor(() => expect(listCalls(server)).toHaveLength(2));
  });

  // 열어 둔 동안 다시 받으면(새로고침·앱 복귀) 새 알림은 '방금 전', 옛 알림은 흐른 시간만큼 늘어난다
  it('다시 받으면 상대 시간을 받은 시각으로 다시 센다', async () => {
    const arrived: NotificationResponse = {
      ...notifications[2],
      id: 9,
      message: '[누수 점검] 작업이 배정되었습니다.',
      createdAt: new Date(now.getTime() + 2 * HOUR).toISOString(),
    };
    const server = notificationServer().on(
      'GET',
      NOTIFICATIONS_PATH,
      ok(notificationsPage(notifications)),
      ok(notificationsPage([arrived, ...notifications])),
    );
    await renderCenter({ server });
    expect(await screen.findByText('7시간 전')).toBeOnTheScreen();

    advanceClock(2 * HOUR);
    await fireEvent(list(), 'refresh');

    expect(await screen.findByText('9시간 전')).toBeOnTheScreen();
    expect(screen.queryByText('7시간 전')).not.toBeOnTheScreen();
    expect(
      within(row('9')).getByText('방금 전', { exact: true }),
    ).toBeOnTheScreen();
  });

  // 전체를 다시 받는 중에 다음 쪽을 부르면 React Query 가 다시 받기를 조용히 취소해 새 알림이 빠지고 밀린 쪽이 붙는다
  // 미룬 끝 닿음은 다시 받기가 끝나면 한 번 이어 부른다 (그대로 두면 다시 스크롤할 때까지 다음 쪽이 오지 않는다)
  it('전체를 다시 받는 동안 끝에 닿으면 다음 쪽을 미뤘다가, 다시 받은 목록을 보인 뒤 부른다', async () => {
    const before = manyNotifications(25);
    const after: NotificationResponse[] = [
      { ...before[0], id: 26, workId: 9999 },
      ...before,
    ];
    let releaseRefetch: () => void = () => {};
    let served = 0;
    const server = notificationServer().on(
      'GET',
      NOTIFICATIONS_PATH,
      async ({ query }) => {
        served += 1;
        const page = Number(query.page);
        const source = served === 1 ? before : after;
        if (served === 2) {
          await new Promise<void>(resolve => (releaseRefetch = resolve));
        }
        return ok(
          notificationsPage(source.slice(page * 20, (page + 1) * 20), {
            page,
            totalCount: source.length,
          }),
        );
      },
    );
    await renderCenter({ server });
    await screen.findByTestId('notification-25');

    // 새로고침은 다시 받기가 끝날 때까지 기다리므로 기다리지 않고 당긴다
    fireEvent(list(), 'refresh');
    await waitFor(() => expect(listCalls(server)).toHaveLength(2));
    await scrollToEnd();
    expect(listCalls(server).map(call => call.query.page)).toEqual(['0', '0']);

    await act(() => releaseRefetch());

    expect(await screen.findByTestId('notification-26')).toBeOnTheScreen();
    await waitFor(() =>
      expect(listCalls(server).map(call => call.query.page)).toEqual([
        '0',
        '0',
        '1',
      ]),
    );
  });

  it('다음 쪽을 받는 동안 목록 끝에 진행 표시를 보인다', async () => {
    const all = manyNotifications(25);
    let releaseNext: () => void = () => {};
    const server = notificationServer().on(
      'GET',
      NOTIFICATIONS_PATH,
      ok(notificationsPage(all.slice(0, 20), { totalCount: 25 })),
      async () => {
        await new Promise<void>(resolve => (releaseNext = resolve));
        return ok(
          notificationsPage(all.slice(20), { page: 1, totalCount: 25 }),
        );
      },
    );
    await renderCenter({ server });
    await screen.findByTestId('notification-25');
    expect(screen.queryByLabelText('불러오는 중')).not.toBeOnTheScreen();

    await scrollToEnd();

    // 다음 쪽은 목록 끝에 알림 행을 닮은 스켈레톤으로 보인다 (#139)
    await screen.findByTestId('notification-more-skeleton');
    expectOnlySkeletons('notification-more-skeleton');
    await act(() => releaseNext());
    await waitFor(() =>
      expect(screen.queryByLabelText('불러오는 중')).not.toBeOnTheScreen(),
    );
  });

  it('새로고침이 실패하면 목록 위에 알리고, 다시 시도하면 다시 받는다', async () => {
    const server = notificationServer().on(
      'GET',
      NOTIFICATIONS_PATH,
      ok(notificationsPage(notifications)),
      fail(500, 'COMMON-500'),
      ok(notificationsPage(notifications)),
    );
    await renderCenter({ server });
    await screen.findByText('작업 취소');

    await fireEvent(list(), 'refresh');

    const notice = await screen.findByTestId('notification-refresh-error');
    expect(
      within(notice).getByText('알림을 불러오지 못했어요'),
    ).toBeOnTheScreen();
    // 이미 받은 목록은 그대로 둔다
    expect(row('2')).toBeOnTheScreen();
    await userEvent.press(
      within(notice).getByRole('button', { name: '다시 시도' }),
    );

    await waitFor(() =>
      expect(screen.queryByTestId('notification-refresh-error')).toBeNull(),
    );
    expect(listCalls(server)).toHaveLength(3);
  });

  // 기사 앱에 오지 않는 종류만 있는 쪽은 걸러져 비지만, 다음 쪽에 보일 알림이 있다
  it('한 쪽이 모두 앱이 모르는 종류면 빈 상태에서 멈추지 않고 다음 쪽을 받는다', async () => {
    const unknown = Array.from(
      { length: 20 },
      (_, index): NotificationResponse => ({
        ...notifications[2],
        id: 100 + index,
        type: 'WORK_ACCEPTED',
      }),
    );
    const server = notificationServer({
      notifications: [...unknown, notifications[1]],
    });
    await renderCenter({ server });

    expect(await screen.findByText('작업 취소')).toBeOnTheScreen();
    expect(screen.queryByText('새 알림이 없어요')).not.toBeOnTheScreen();
    expect(listCalls(server).map(call => call.query.page)).toEqual(['0', '1']);
  });

  it('가려진 동안에는 목록을 받지 않는다', async () => {
    const server = notificationServer({ notifications });
    await renderCenter({ server, focused: false });

    expect(listCalls(server)).toHaveLength(0);
  });

  it('작업 취소는 빨강, 신규 배정은 남색 글씨다', async () => {
    await renderCenter();

    expect(await screen.findByText('작업 취소')).toHaveStyle({
      color: colors.warning[1],
    });
    expect(screen.getAllByText('신규 배정')[0]).toHaveStyle({
      color: '#4A4193',
    });
  });

  it('읽지 않은 알림은 회색 배경, 읽은 알림은 흰 배경이다', async () => {
    await renderCenter();

    expect(await screen.findByTestId('notification-2')).toHaveStyle({
      backgroundColor: colors.background[3],
    });
    expect(row('5')).toHaveStyle({ backgroundColor: colors.white[100] });
  });

  // #102: 누르는 동안 회색 배경. 읽지 않은 알림은 이미 회색이라 한 단계 진한 회색이다 (떼면 읽음이 되어 흰 배경)
  it('읽지 않은 알림을 누르고 있는 동안 배경이 Gray100 이 된다', async () => {
    await renderCenter();

    const item = await screen.findByTestId('notification-2');
    await pressIn(item);

    expect(item).toHaveStyle({ backgroundColor: pressedBackground.onGray });
  });

  it('스크린리더는 읽지 않은 알림을 먼저 알린다', async () => {
    await renderCenter();

    expect(await screen.findByTestId('notification-2')).toHaveAccessibleName(
      '읽지 않음, 작업 취소, [정수기 필터 교체] 작업이 취소되었습니다., 3시간 전',
    );
    expect(row('5')).toHaveAccessibleName(
      '신규 배정, [세탁기 설치] 작업이 배정되었습니다., 7시간 전',
    );
  });

  it('읽지 않은 작업 알림을 누르면 읽음을 보내 흰 배경이 되고 작업 상세를 연다', async () => {
    const server = notificationServer({ notifications });
    const { onOpen } = await renderCenter({ server });

    await userEvent.press(await screen.findByTestId('notification-2'));

    await waitFor(() =>
      expect(row('2')).toHaveStyle({ backgroundColor: colors.white[100] }),
    );
    expect(server.callsTo('PUT', notificationReadPath('2'))).toHaveLength(1);
    expect(onOpen).toHaveBeenCalledWith({
      kind: 'work',
      organizationId: '1',
      workId: '102',
    });
  });

  it('읽음이 실패해도 작업 상세는 열고, 행은 읽지 않음으로 돌아온다', async () => {
    const server = notificationServer({ notifications }).on(
      'PUT',
      notificationReadPath('2'),
      fail(500, 'COMMON-500'),
    );
    const { onOpen } = await renderCenter({ server });

    await userEvent.press(await screen.findByTestId('notification-2'));

    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'work', workId: '102' }),
    );
    await waitFor(() =>
      expect(row('2')).toHaveStyle({ backgroundColor: colors.background[3] }),
    );
  });

  it('읽은 작업 알림도 누르면 작업 상세를 열고 읽음은 다시 보내지 않는다', async () => {
    const server = notificationServer({ notifications });
    const { onOpen } = await renderCenter({ server });

    const item = await screen.findByTestId('notification-5');
    expect(item).toHaveProp('accessibilityRole', 'button');
    expect(item).toHaveProp('accessibilityHint', '작업 상세를 엽니다');
    await userEvent.press(item);

    expect(onOpen).toHaveBeenCalledWith({
      kind: 'work',
      organizationId: '1',
      workId: '105',
    });
    expect(server.callsTo('PUT', notificationReadPath('5'))).toHaveLength(0);
  });

  it('읽은 작업 알림은 누르고 있는 동안 배경이 Gray50 이 된다', async () => {
    await renderCenter();

    await expectPressedBackground(
      await screen.findByTestId('notification-5'),
      pressedBackground.onWhite,
    );
  });
});

// 열 곳이 없는 알림: 참여 승인(승인 결과 화면이 아직 없다)
describe('NotificationCenterScreen — 열 곳이 없는 알림', () => {
  const approved: NotificationResponse = {
    id: 8,
    type: 'PARTICIPATION_REQUEST_APPROVED',
    organizationId: 2,
    workId: null,
    participationRequestId: 4,
    message: '[스마트 홈케어] 참여 요청이 승인되었습니다.',
    read: false,
    createdAt: new Date(now.getTime() - 60 * 60_000).toISOString(),
  };

  it('읽지 않았으면 눌러 읽음으로 바꾸고 아무것도 열지 않는다', async () => {
    const server = notificationServer({ notifications: [approved] });
    const { onOpen } = await renderCenter({ server });

    const item = await screen.findByTestId('notification-8');
    expect(item).toHaveProp('accessibilityHint', '읽음으로 표시합니다');
    await userEvent.press(item);

    await waitFor(() =>
      expect(server.callsTo('PUT', notificationReadPath('8'))).toHaveLength(1),
    );
    expect(onOpen).not.toHaveBeenCalled();
  });

  // 다른 컴포넌트로 바꿔 그리면 행이 새로 만들어져 방금 누른 스크린리더 포커스가 사라진다
  it('읽음이 되어도 같은 행을 그대로 두고 버튼 역할만 뺀다', async () => {
    await renderCenter({
      server: notificationServer({ notifications: [approved] }),
    });
    const before = await screen.findByTestId('notification-8');
    expect(before).toHaveProp('accessibilityRole', 'button');

    await userEvent.press(before);

    await waitFor(() =>
      expect(row('8')).not.toHaveProp('accessibilityRole', 'button'),
    );
    expect(row('8')).toBe(before);
  });

  it('읽었으면 누를 수 없어 눌림 배경이 없다', async () => {
    await renderCenter({
      server: notificationServer({
        notifications: [{ ...approved, read: true }],
      }),
    });

    const item = await screen.findByTestId('notification-8');
    await pressIn(item);
    expect(item).toHaveStyle({ backgroundColor: colors.white[100] });
  });
});

// 참여 거절 알림은 거절 화면을 연다 (#73). 읽은 뒤에도 다시 열 수 있다
describe('NotificationCenterScreen — 참여 거절 알림', () => {
  it('누르면 읽음을 보내고 그 참여 요청을 연다', async () => {
    const server = notificationServer({ notifications });
    const { onOpen } = await renderCenter({ server });

    const item = await screen.findByTestId('notification-1');
    expect(item).toHaveProp('accessibilityHint', '참여 요청 결과를 엽니다');
    await userEvent.press(item);

    await waitFor(() =>
      expect(server.callsTo('PUT', notificationReadPath('1'))).toHaveLength(1),
    );
    expect(onOpen).toHaveBeenCalledWith({
      kind: 'participationRejected',
      requestId: '3',
    });
  });

  it('읽은 알림이어도 버튼이고 누르면 다시 연다', async () => {
    const server = notificationServer({
      notifications: [{ ...notifications[0], read: true }],
    });
    const { onOpen } = await renderCenter({ server });

    const item = await screen.findByTestId('notification-1');
    expect(item).toHaveProp('accessibilityRole', 'button');
    await userEvent.press(item);

    expect(onOpen).toHaveBeenCalledWith({
      kind: 'participationRejected',
      requestId: '3',
    });
    expect(server.callsTo('PUT', notificationReadPath('1'))).toHaveLength(0);
  });
});

// 참여 요청 결과(승인·거절)는 신청 현황과 소속을 바꾼다. 알림을 열면 그 둘을 다시 받게 한다 (#116)
describe('NotificationCenterScreen — 참여 요청 결과 알림', () => {
  const approved: NotificationResponse = {
    ...notifications[0],
    id: 8,
    type: 'PARTICIPATION_REQUEST_APPROVED',
    participationRequestId: 4,
    message: '[스마트 홈케어] 참여 요청이 승인되었습니다.',
  };

  async function renderWithCachedParticipation(items: NotificationResponse[]) {
    const view = await renderCenter({
      server: notificationServer({ notifications: items }),
    });
    view.queryClient.setQueryData(participationRequestsKey, []);
    view.queryClient.setQueryData(membershipsQueryKey, []);
    const invalidated = () => ({
      requests: view.queryClient.getQueryState(participationRequestsKey)
        ?.isInvalidated,
      memberships:
        view.queryClient.getQueryState(membershipsQueryKey)?.isInvalidated,
    });
    return { ...view, invalidated };
  }

  it.each([
    ['승인', approved],
    ['거절', notifications[0]],
  ])(
    '참여 %s 알림을 누르면 신청 현황과 소속을 다시 받게 한다',
    async (_, item) => {
      const { invalidated } = await renderWithCachedParticipation([item]);

      await userEvent.press(
        await screen.findByTestId(`notification-${item.id}`),
      );

      expect(invalidated()).toEqual({ requests: true, memberships: true });
    },
  );

  it('작업 알림은 신청 현황과 소속을 건드리지 않는다', async () => {
    const { invalidated } = await renderWithCachedParticipation([
      notifications[1],
    ]);

    await userEvent.press(await screen.findByTestId('notification-2'));

    expect(invalidated()).toEqual({ requests: false, memberships: false });
  });
});

// TanStack v5 는 mutate(…, { onSuccess }) 처럼 부를 때 준 콜백을 화면이 사라지면 부르지 않는다.
// 캐시 반영·되돌리기는 useMutation 옵션에 있어 화면을 떠나도 끝난다
describe('NotificationCenterScreen — 읽음을 보내는 중 화면을 떠나면', () => {
  it.each([
    ['성공하면 읽음으로 남는다', noContentResponse(), true],
    ['실패하면 읽지 않음으로 돌린다', fail(500, 'COMMON-500'), false],
  ] as const)('%s', async (_, response, read) => {
    let release: (value: FakeResponse) => void = () => {};
    const server = notificationServer({ notifications }).on(
      'PUT',
      notificationReadPath('2'),
      () => new Promise<FakeResponse>(resolve => (release = resolve)),
    );
    const view = await renderCenter({ server });
    await userEvent.press(await screen.findByTestId('notification-2'));
    await waitFor(() =>
      expect(server.callsTo('PUT', notificationReadPath('2'))).toHaveLength(1),
    );

    await view.unmount();
    await act(() => release(response));

    await waitFor(() => expect(readInCache(view.queryClient, 2)).toBe(read));
  });
});
