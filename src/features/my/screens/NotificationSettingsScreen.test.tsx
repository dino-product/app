import { render, screen, userEvent } from '@testing-library/react-native';
import { notificationSettingsMock } from '../mockData';
import type { NotificationSettings } from '../model';
import { NotificationSettingsScreen } from './NotificationSettingsScreen';

const renderSettings = (
  settings: NotificationSettings = notificationSettingsMock,
  onChange = jest.fn(),
) =>
  render(
    <NotificationSettingsScreen
      settings={settings}
      onChange={onChange}
      onBack={jest.fn()}
    />,
  );

describe('NotificationSettingsScreen', () => {
  it('제목과 알림 종류 세 개를 설명과 함께 보여준다', async () => {
    await renderSettings();

    expect(screen.getByRole('header', { name: '알림 설정' })).toBeOnTheScreen();
    expect(screen.getAllByRole('switch')).toHaveLength(3);
    expect(
      screen.getByText('새로운 작업이 배정되었을 때 알려드려요'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('작업 일정이 변경되었을 때 알려드려요'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('배정된 작업이 취소되었을 때 알려드려요'),
    ).toBeOnTheScreen();
  });

  // 스크린리더는 "작업 배정 알림, 스위치, 켬" 처럼 읽는다 (이름·역할·상태)
  it('토글은 알림 이름의 스위치이고 켜짐 상태를 알린다', async () => {
    await renderSettings({
      workAssignmentEnabled: true,
      scheduleChangeEnabled: false,
      workCancellationEnabled: true,
    });

    expect(
      screen.getByRole('switch', { name: '작업 배정 알림' }),
    ).toBeChecked();
    expect(
      screen.getByRole('switch', { name: '일정 변경 알림' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('switch', { name: '작업 취소 알림' }),
    ).toBeChecked();
  });

  it.each([
    ['작업 배정 알림', 'workAssignmentEnabled'],
    ['일정 변경 알림', 'scheduleChangeEnabled'],
    ['작업 취소 알림', 'workCancellationEnabled'],
  ] as const)('%s 를 누르면 그 설정만 바로 바꾼다', async (name, key) => {
    const onChange = jest.fn();
    await renderSettings(notificationSettingsMock, onChange);

    await userEvent.press(screen.getByRole('switch', { name }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(key, false);
  });
});
