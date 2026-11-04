import { focusManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { REFRESH_PATH } from '../../shared/api/session';
import {
  fail,
  noContent,
  ok,
  type FakeResponse,
} from '../../shared/testing/fakeServer';
import { createTestApi } from '../../shared/testing/renderWithApi';
import { testSession } from '../../shared/testing/session';
import {
  NOTIFICATION_SETTINGS_PATH,
  NOTIFICATIONS_PATH,
  notificationReadPath,
  type NotificationResponse,
} from './notificationApi';
import {
  useMarkNotificationRead,
  useNotificationList,
  useNotificationSettings,
} from './notificationQueries';
import {
  notificationResponsesMock,
  notificationServer,
  notificationSettingsMock,
  notificationsPage,
} from './notificationTesting';

const now = new Date('2026-11-02T06:00:00Z');

function setup(options: Parameters<typeof notificationServer>[0] = {}) {
  return createTestApi({
    server: notificationServer(options),
    session: testSession(),
  });
}

const manyNotifications = (count: number): NotificationResponse[] =>
  Array.from({ length: count }, (_, index) => ({
    ...notificationResponsesMock(now)[2],
    id: count - index,
  }));

describe('useNotificationList', () => {
  it('첫 쪽을 최신순 20개로 받는다', async () => {
    const api = setup();
    const { result } = await renderHook(() => useNotificationList(true), {
      wrapper: api.wrapper,
    });

    await waitFor(() => expect(result.current.data).toHaveLength(7));
    expect(api.server.callsTo('GET', NOTIFICATIONS_PATH)[0].query).toEqual({
      unreadOnly: 'false',
      page: '0',
      size: '20',
    });
    expect(result.current.data?.[0]).toEqual(
      expect.objectContaining({ id: '1', participationRequestId: '3' }),
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it('다음 쪽을 이어 붙이고, 마지막 쪽이면 더 없다', async () => {
    const api = setup({ notifications: manyNotifications(25) });
    const { result } = await renderHook(() => useNotificationList(true), {
      wrapper: api.wrapper,
    });
    await waitFor(() => expect(result.current.data).toHaveLength(20));
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.data).toHaveLength(25));
    expect(result.current.hasNextPage).toBe(false);
    expect(
      api.server
        .callsTo('GET', NOTIFICATIONS_PATH)
        .map(call => call.query.page),
    ).toEqual(['0', '1']);
  });

  // 만료·폐기된 access token 은 COMMON-404 로 온다. 토대(#110)가 재발급해 한 번 다시 보낸다
  it('토큰이 만료됐으면 재발급한 토큰으로 다시 받는다', async () => {
    const api = setup();
    api.server
      .on(
        'GET',
        NOTIFICATIONS_PATH,
        fail(404, 'COMMON-404'),
        ok(notificationsPage(notificationResponsesMock(now))),
      )
      .on('POST', REFRESH_PATH, ok(testSession({ accessToken: 'access-2' })));
    const { result } = await renderHook(() => useNotificationList(true), {
      wrapper: api.wrapper,
    });

    await waitFor(() => expect(result.current.data).toHaveLength(7));
    expect(
      api.server.callsTo('GET', NOTIFICATIONS_PATH)[1].headers.Authorization,
    ).toBe('Bearer access-2');
  });

  // 화면이 가려진 동안(위에 작업 상세 등)은 받지 않고, 다시 보이면 새로 받는다
  it('구독을 껐다 켜면 목록을 다시 받는다', async () => {
    const api = setup();
    const { result, rerender } = await renderHook(
      ({ subscribed }: { subscribed: boolean }) =>
        useNotificationList(subscribed),
      { wrapper: api.wrapper, initialProps: { subscribed: true } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await rerender({ subscribed: false });
    await rerender({ subscribed: true });

    await waitFor(() =>
      expect(api.server.callsTo('GET', NOTIFICATIONS_PATH)).toHaveLength(2),
    );
  });

  it('앱이 앞으로 돌아오면 목록을 다시 받는다', async () => {
    const api = setup();
    const { result } = await renderHook(() => useNotificationList(true), {
      wrapper: api.wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await act(() => focusManager.setFocused(false));
    await act(() => focusManager.setFocused(true));

    await waitFor(() =>
      expect(api.server.callsTo('GET', NOTIFICATIONS_PATH)).toHaveLength(2),
    );
  });
});

describe('useMarkNotificationRead', () => {
  function renderRead(api: ReturnType<typeof setup>) {
    return renderHook(
      () => ({
        list: useNotificationList(true),
        markRead: useMarkNotificationRead(),
      }),
      { wrapper: api.wrapper },
    );
  }
  const readOf = (
    result: { current: { list: ReturnType<typeof useNotificationList> } },
    id: string,
  ) => result.current.list.data?.find(item => item.id === id)?.read;

  // 받은 시각은 상대 시간의 기준이다. 읽음만 바꿨으면 그대로 두어 다른 행이 다시 그려지지 않는다
  it('읽음을 보내고 그 알림을 바로 읽음으로 바꾸며, 받은 시각은 그대로 둔다', async () => {
    const api = setup();
    const { result } = await renderRead(api);
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    const fetchedAt = result.current.list.dataUpdatedAt;
    const realNow = Date.now.bind(Date);
    jest.spyOn(Date, 'now').mockImplementation(() => realNow() + 60_000);

    await act(() => result.current.markRead('2'));

    await waitFor(() => expect(readOf(result, '2')).toBe(true));
    expect(api.server.callsTo('PUT', notificationReadPath('2'))).toHaveLength(
      1,
    );
    expect(result.current.list.dataUpdatedAt).toBe(fetchedAt);
    jest.restoreAllMocks();
  });

  it('읽음이 실패하면 읽지 않음으로 되돌린다', async () => {
    let release: (response: FakeResponse) => void = () => {};
    const api = setup();
    api.server.on(
      'PUT',
      notificationReadPath('2'),
      () => new Promise<FakeResponse>(resolve => (release = resolve)),
    );
    const { result } = await renderRead(api);
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(() => result.current.markRead('2'));
    // 답을 기다리는 동안은 읽음으로 보인다
    await waitFor(() => expect(readOf(result, '2')).toBe(true));

    await act(() => release(fail(500, 'COMMON-500')));

    await waitFor(() => expect(readOf(result, '2')).toBe(false));
  });

  // 작업을 거절하면 그 작업의 알림이 숨겨진다. 목록을 다시 받아 지운다
  it('없는 알림(NOTIFICATION-002)이면 목록을 다시 받는다', async () => {
    const api = setup();
    api.server.on(
      'PUT',
      notificationReadPath('2'),
      fail(404, 'NOTIFICATION-002'),
    );
    const { result } = await renderRead(api);
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(() => result.current.markRead('2'));

    await waitFor(() =>
      expect(api.server.callsTo('GET', NOTIFICATIONS_PATH)).toHaveLength(2),
    );
  });

  // 읽음을 보내는 사이 다시 받은 목록이 읽기 전 값이어도 읽음으로 둔다
  it('받는 사이 목록을 다시 받아도 읽음이 성공하면 읽음이다', async () => {
    let release: (response: FakeResponse) => void = () => {};
    const api = setup();
    api.server.on(
      'PUT',
      notificationReadPath('2'),
      () => new Promise<FakeResponse>(resolve => (release = resolve)),
    );
    const { result } = await renderRead(api);
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(() => result.current.markRead('2'));
    await waitFor(() => expect(readOf(result, '2')).toBe(true));
    await act(() => result.current.list.refetch());
    await waitFor(() => expect(readOf(result, '2')).toBe(false));

    await act(() => release(noContent()));

    await waitFor(() => expect(readOf(result, '2')).toBe(true));
  });
});

describe('useNotificationSettings', () => {
  function renderSettings(api: ReturnType<typeof setup>) {
    const onSaveFailed = jest.fn();
    return renderHook(() => useNotificationSettings(onSaveFailed), {
      wrapper: api.wrapper,
    }).then(view => ({ ...view, onSaveFailed }));
  }

  it('서버 값을 주고, 바꾸면 바로 보이며 세 값 모두 저장한다', async () => {
    const api = setup({
      settings: { ...notificationSettingsMock, workCancellationEnabled: false },
    });
    const { result } = await renderSettings(api);
    await waitFor(() =>
      expect(result.current.settings?.workCancellationEnabled).toBe(false),
    );

    await act(() => result.current.change('scheduleChangeEnabled', false));

    expect(result.current.settings).toEqual({
      workAssignmentEnabled: true,
      scheduleChangeEnabled: false,
      workCancellationEnabled: false,
    });
    await waitFor(() =>
      expect(
        api.server.callsTo('PUT', NOTIFICATION_SETTINGS_PATH),
      ).toHaveLength(1),
    );
    expect(
      api.server.callsTo('PUT', NOTIFICATION_SETTINGS_PATH)[0].body,
    ).toEqual({
      workAssignmentEnabled: true,
      scheduleChangeEnabled: false,
      workCancellationEnabled: false,
    });
  });

  it('저장이 실패하면 이전 값으로 돌리고 알린다', async () => {
    const api = setup({ settingsSaves: [fail(500, 'COMMON-500')] });
    const { result, onSaveFailed } = await renderSettings(api);
    await waitFor(() => expect(result.current.settings).toBeDefined());

    await act(() => result.current.change('workAssignmentEnabled', false));

    await waitFor(() => expect(onSaveFailed).toHaveBeenCalledTimes(1));
    expect(result.current.settings).toEqual(notificationSettingsMock);
  });

  // 같은 계정의 첫 저장이 겹치면 409 NOTIFICATION-004. 다시 보내면 저장된다
  it('NOTIFICATION-004 는 한 번 다시 보낸다', async () => {
    const api = setup({
      settingsSaves: [fail(409, 'NOTIFICATION-004'), noContent()],
    });
    const { result, onSaveFailed } = await renderSettings(api);
    await waitFor(() => expect(result.current.settings).toBeDefined());

    await act(() => result.current.change('workAssignmentEnabled', false));

    await waitFor(() =>
      expect(
        api.server.callsTo('PUT', NOTIFICATION_SETTINGS_PATH),
      ).toHaveLength(2),
    );
    expect(onSaveFailed).not.toHaveBeenCalled();
    expect(result.current.settings?.workAssignmentEnabled).toBe(false);
  });

  it('NOTIFICATION-004 가 두 번이면 더 보내지 않고 되돌린다', async () => {
    const api = setup({ settingsSaves: [fail(409, 'NOTIFICATION-004')] });
    const { result, onSaveFailed } = await renderSettings(api);
    await waitFor(() => expect(result.current.settings).toBeDefined());

    await act(() => result.current.change('workAssignmentEnabled', false));

    await waitFor(() => expect(onSaveFailed).toHaveBeenCalledTimes(1));
    expect(api.server.callsTo('PUT', NOTIFICATION_SETTINGS_PATH)).toHaveLength(
      2,
    );
    expect(result.current.settings?.workAssignmentEnabled).toBe(true);
  });

  // 빠르게 연달아 바꾸면 저장을 차례로 보내 마지막 값이 서버에 남는다 (먼저 보낸 저장이 늦게 도착해 덮지 않는다)
  it('연달아 바꾸면 앞 저장이 끝난 뒤 마지막 값을 보낸다', async () => {
    let release: (response: FakeResponse) => void = () => {};
    const api = setup({
      settingsSaves: [
        () => new Promise<FakeResponse>(resolve => (release = resolve)),
        noContent(),
      ],
    });
    const { result } = await renderSettings(api);
    await waitFor(() => expect(result.current.settings).toBeDefined());

    await act(() => result.current.change('workAssignmentEnabled', false));
    await act(() => result.current.change('scheduleChangeEnabled', false));
    await act(() => result.current.change('workAssignmentEnabled', true));

    expect(result.current.settings).toEqual({
      ...notificationSettingsMock,
      scheduleChangeEnabled: false,
    });
    expect(api.server.callsTo('PUT', NOTIFICATION_SETTINGS_PATH)).toHaveLength(
      1,
    );

    await act(() => release(noContent()));

    await waitFor(() =>
      expect(
        api.server.callsTo('PUT', NOTIFICATION_SETTINGS_PATH),
      ).toHaveLength(3),
    );
    expect(
      api.server.callsTo('PUT', NOTIFICATION_SETTINGS_PATH).at(-1)?.body,
    ).toEqual({ ...notificationSettingsMock, scheduleChangeEnabled: false });
    expect(result.current.settings).toEqual({
      ...notificationSettingsMock,
      scheduleChangeEnabled: false,
    });
  });

  // 앞 저장이 실패해도 마지막 저장이 성공하면 마지막 값이 맞다
  it('앞 저장만 실패하면 마지막 값을 두고 알리지 않는다', async () => {
    const api = setup({
      settingsSaves: [fail(500, 'COMMON-500'), noContent()],
    });
    const { result, onSaveFailed } = await renderSettings(api);
    await waitFor(() => expect(result.current.settings).toBeDefined());

    await act(() => {
      result.current.change('workAssignmentEnabled', false);
      result.current.change('scheduleChangeEnabled', false);
    });

    await waitFor(() =>
      expect(
        api.server.callsTo('PUT', NOTIFICATION_SETTINGS_PATH),
      ).toHaveLength(2),
    );
    await waitFor(() =>
      expect(result.current.settings).toEqual({
        ...notificationSettingsMock,
        workAssignmentEnabled: false,
        scheduleChangeEnabled: false,
      }),
    );
    expect(onSaveFailed).not.toHaveBeenCalled();
  });

  // 둘 다 실패하면 서버가 마지막으로 저장한 값(처음 값)으로 돌린다
  it('연달아 바꾼 저장이 모두 실패하면 처음 값으로 돌린다', async () => {
    const api = setup({ settingsSaves: [fail(500, 'COMMON-500')] });
    const { result, onSaveFailed } = await renderSettings(api);
    await waitFor(() => expect(result.current.settings).toBeDefined());

    await act(() => {
      result.current.change('workAssignmentEnabled', false);
      result.current.change('scheduleChangeEnabled', false);
    });

    await waitFor(() => expect(onSaveFailed).toHaveBeenCalledTimes(1));
    expect(result.current.settings).toEqual(notificationSettingsMock);
  });

  // 앱 복귀 등으로 다시 받던 설정이 저장보다 늦게 와도(저장 전 값) 저장한 값을 덮지 않는다
  it('저장하는 사이 받던 옛 설정이 늦게 와도 저장한 값이 남는다', async () => {
    let releaseStale: (response: FakeResponse) => void = () => {};
    const saved = { ...notificationSettingsMock, workAssignmentEnabled: false };
    const api = setup();
    api.server.on(
      'GET',
      NOTIFICATION_SETTINGS_PATH,
      ok(notificationSettingsMock),
      () => new Promise<FakeResponse>(resolve => (releaseStale = resolve)),
      ok(saved),
    );
    const { result } = await renderSettings(api);
    await waitFor(() => expect(result.current.settings).toBeDefined());

    await act(() => {
      result.current.refetch();
    });
    await act(() => result.current.change('workAssignmentEnabled', false));
    await waitFor(() =>
      expect(
        api.server.callsTo('PUT', NOTIFICATION_SETTINGS_PATH),
      ).toHaveLength(1),
    );
    await act(() => releaseStale(ok(notificationSettingsMock)));

    await waitFor(() =>
      expect(
        api.server.callsTo('GET', NOTIFICATION_SETTINGS_PATH),
      ).toHaveLength(3),
    );
    await waitFor(() => expect(result.current.settings).toEqual(saved));
  });
});
