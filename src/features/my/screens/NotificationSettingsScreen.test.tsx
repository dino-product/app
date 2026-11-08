import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import {
  fail,
  hang,
  networkError,
  noContent,
  ok,
  type FakeResponse,
  type FakeServer,
} from '../../../shared/testing/fakeServer';
import { renderWithApi } from '../../../shared/testing/renderWithApi';
import { expectOnlySkeletons } from '../../../shared/testing/skeleton';
import { testSession } from '../../../shared/testing/session';
import type { NotificationSettings } from '../model';
import { NOTIFICATION_SETTINGS_PATH } from '../notificationApi';
import { notificationKeys } from '../notificationQueries';
import {
  notificationServer,
  notificationSettingsMock,
} from '../notificationTesting';
import { NotificationSettingsScreen } from './NotificationSettingsScreen';

async function renderSettings({
  settings = notificationSettingsMock,
  server = notificationServer({ settings }),
}: { settings?: NotificationSettings; server?: FakeServer } = {}) {
  const view = await renderWithApi(
    <NotificationSettingsScreen onBack={jest.fn()} />,
    { server, session: testSession() },
  );
  return view;
}

const toggle = (name: string) => screen.getByRole('switch', { name });
const saves = (server: FakeServer) =>
  server.callsTo('PUT', NOTIFICATION_SETTINGS_PATH);
const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});

describe('NotificationSettingsScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('제목과 알림 종류 세 개를 설명과 함께 보여준다', async () => {
    await renderSettings();

    expect(screen.getByRole('header', { name: '알림 설정' })).toBeOnTheScreen();
    expect(await screen.findAllByRole('switch')).toHaveLength(3);
    const hidden = { includeHiddenElements: true };
    for (const text of [
      '새로운 작업이 배정되었을 때 알려드려요',
      '작업 일정이 변경되었을 때 알려드려요',
      '배정된 작업이 취소되었을 때 알려드려요',
    ]) {
      expect(screen.getByText(text, hidden)).toBeOnTheScreen();
    }
  });

  // 같은 이름을 글자로 한 번, 스위치로 한 번 읽지 않는다. 설명은 스위치 힌트로 읽는다
  it('스크린리더는 카드마다 스위치 하나만 읽고 설명을 힌트로 붙인다', async () => {
    await renderSettings();

    expect(
      await screen.findByRole('switch', { name: '작업 배정 알림' }),
    ).toHaveProp('accessibilityHint', '새로운 작업이 배정되었을 때 알려드려요');
    expect(screen.queryByText('작업 배정 알림')).toBeNull();
    expect(
      screen.queryByText('새로운 작업이 배정되었을 때 알려드려요'),
    ).toBeNull();
  });

  // 스크린리더는 "작업 배정 알림, 스위치, 켬" 처럼 읽는다 (이름·역할·상태)
  it('토글은 서버 값이고 켜짐 상태를 알린다', async () => {
    await renderSettings({
      settings: {
        workAssignmentEnabled: true,
        scheduleChangeEnabled: false,
        workCancellationEnabled: true,
      },
    });

    expect(
      await screen.findByRole('switch', { name: '작업 배정 알림' }),
    ).toBeChecked();
    expect(toggle('일정 변경 알림')).not.toBeChecked();
    expect(toggle('작업 취소 알림')).toBeChecked();
  });

  it('받는 동안 진행 표시를 보이고 토글은 아직 없다', async () => {
    await renderSettings({
      server: notificationServer().on(
        'GET',
        NOTIFICATION_SETTINGS_PATH,
        hang(),
      ),
    });

    expectOnlySkeletons('notification-settings-skeleton');
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });

  it('받지 못하면 오류와 다시 시도를 보이고, 누르면 다시 받는다', async () => {
    const server = notificationServer().on(
      'GET',
      NOTIFICATION_SETTINGS_PATH,
      networkError(),
      ok(notificationSettingsMock),
    );
    await renderSettings({ server });

    expect(
      await screen.findByText('알림 설정을 불러오지 못했어요'),
    ).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findAllByRole('switch')).toHaveLength(3);
  });

  it.each([
    ['작업 배정 알림', 'workAssignmentEnabled'],
    ['일정 변경 알림', 'scheduleChangeEnabled'],
    ['작업 취소 알림', 'workCancellationEnabled'],
  ] as const)(
    '%s 를 누르면 바로 바뀌고 세 값 모두 저장한다',
    async (name, key) => {
      const server = notificationServer();
      await renderSettings({ server });

      await userEvent.press(await screen.findByRole('switch', { name }));

      expect(toggle(name)).not.toBeChecked();
      await waitFor(() => expect(saves(server)).toHaveLength(1));
      expect(saves(server)[0].body).toEqual({
        ...notificationSettingsMock,
        [key]: false,
      });
    },
  );

  it('저장이 실패하면 이전 값으로 돌리고 알린다', async () => {
    const alert = spyAlert();
    const server = notificationServer({
      settingsSaves: [fail(500, 'COMMON-500')],
    });
    await renderSettings({ server });

    await userEvent.press(
      await screen.findByRole('switch', { name: '작업 배정 알림' }),
    );

    await waitFor(() => expect(toggle('작업 배정 알림')).toBeChecked());
    expect(alert).toHaveBeenCalledWith(
      '알림 설정을 저장하지 못했어요',
      '잠시 후 다시 시도해 주세요.',
    );
  });

  it('NOTIFICATION-004 는 한 번 다시 보내 저장한다', async () => {
    const alert = spyAlert();
    const server = notificationServer({
      settingsSaves: [fail(409, 'NOTIFICATION-004'), noContent()],
    });
    await renderSettings({ server });

    await userEvent.press(
      await screen.findByRole('switch', { name: '작업 배정 알림' }),
    );

    await waitFor(() => expect(saves(server)).toHaveLength(2));
    expect(toggle('작업 배정 알림')).not.toBeChecked();
    expect(alert).not.toHaveBeenCalled();
  });

  it('연달아 바꾸면 마지막 값이 서버에 남는다', async () => {
    const server = notificationServer();
    await renderSettings({ server });

    await userEvent.press(
      await screen.findByRole('switch', { name: '작업 배정 알림' }),
    );
    await userEvent.press(toggle('일정 변경 알림'));
    await userEvent.press(toggle('작업 배정 알림'));

    await waitFor(() => expect(saves(server)).toHaveLength(3));
    expect(saves(server).at(-1)?.body).toEqual({
      ...notificationSettingsMock,
      scheduleChangeEnabled: false,
    });
    expect(toggle('작업 배정 알림')).toBeChecked();
    expect(toggle('일정 변경 알림')).not.toBeChecked();
  });

  // TanStack v5 는 mutate(…, { onSuccess }) 처럼 부를 때 준 콜백을 화면이 사라지면 부르지 않는다.
  // 서버가 받은 값은 useMutation 옵션이 캐시에 남기므로 다시 열면 그 값이다
  it.each([
    ['성공하면 다시 열 때 저장한 값이다', noContent(), false],
    ['실패하면 다시 열 때 서버 값(처음 값)이다', fail(500, 'COMMON-500'), true],
  ] as const)(
    '저장하는 중 화면을 떠났다가 %s',
    async (_, response, checked) => {
      let release: (value: FakeResponse) => void = () => {};
      const server = notificationServer({
        settingsSaves: [
          () => new Promise<FakeResponse>(resolve => (release = resolve)),
        ],
      });
      const view = await renderSettings({ server });
      await userEvent.press(
        await screen.findByRole('switch', { name: '작업 배정 알림' }),
      );
      await waitFor(() => expect(saves(server)).toHaveLength(1));

      await view.unmount();
      await act(() => release(response));

      await waitFor(() =>
        expect(
          view.queryClient.getQueryData<NotificationSettings>(
            notificationKeys.settings,
          )?.workAssignmentEnabled,
        ).toBe(checked),
      );
      await render(<NotificationSettingsScreen onBack={jest.fn()} />, {
        wrapper: view.wrapper,
      });
      expect(
        await screen.findByRole('switch', { name: '작업 배정 알림' }),
      ).toHaveProp('accessibilityState', { checked, disabled: false });
    },
  );
});
