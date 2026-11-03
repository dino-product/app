import { render, screen, userEvent } from '@testing-library/react-native';
import { colors, pressedBackground } from '../../../shared/design-system';
import { pressIn } from '../../../shared/testing/press';
import { expectPressedBackground } from '../../../shared/testing/pressFeedback';
import { makeNotificationsMock } from '../mockData';
import type { AppNotification } from '../model';
import { NotificationCenterScreen } from './NotificationCenterScreen';

const now = new Date(2026, 10, 2, 15, 0);
const notifications = makeNotificationsMock(now);

const renderCenter = (
  items: readonly AppNotification[] = notifications,
  onRead = jest.fn(),
) =>
  render(
    <NotificationCenterScreen
      notifications={items}
      now={now}
      onRead={onRead}
      onBack={jest.fn()}
    />,
  );

const row = (id: string) => screen.getByTestId(`notification-${id}`);

describe('NotificationCenterScreen', () => {
  it('제목과 알림마다 종류, 내용, 상대 시간을 보여준다', async () => {
    await renderCenter();

    expect(screen.getByRole('header', { name: '알림센터' })).toBeOnTheScreen();
    expect(screen.getByText('작업 취소')).toBeOnTheScreen();
    expect(
      screen.getByText('[정수기 필터 교체] 작업이 취소되었습니다.'),
    ).toBeOnTheScreen();
    expect(screen.getAllByText('3시간 전')).toHaveLength(3);
    expect(screen.getByText('7시간 전')).toBeOnTheScreen();
    expect(screen.getByText('21시간 전')).toBeOnTheScreen();
    expect(screen.getByText('2일 전')).toBeOnTheScreen();
  });

  it('작업 취소는 빨강, 신규 배정은 남색 글씨다', async () => {
    await renderCenter();

    expect(screen.getByText('작업 취소')).toHaveStyle({
      color: colors.warning[1],
    });
    expect(screen.getAllByText('신규 배정')[0]).toHaveStyle({
      color: '#4A4193',
    });
  });

  it('읽지 않은 알림은 회색 배경, 읽은 알림은 흰 배경이다', async () => {
    await renderCenter();

    expect(row('notification-1')).toHaveStyle({
      backgroundColor: colors.background[3],
    });
    expect(row('notification-4')).toHaveStyle({
      backgroundColor: colors.white[100],
    });
  });

  // #102: 누르는 동안 회색 배경. 읽지 않은 알림은 이미 회색이라 한 단계 진한 회색이다
  it('읽지 않은 알림을 누르고 있는 동안 배경이 Gray100 이 되고 떼면 돌아온다', async () => {
    await renderCenter();

    await expectPressedBackground(
      row('notification-1'),
      pressedBackground.onGray,
    );
  });

  it('읽었고 열 곳도 없는 알림은 누를 수 없어 눌림 배경이 없다', async () => {
    await renderCenter();

    const item = row('notification-4');
    await pressIn(item);
    expect(item).toHaveStyle({ backgroundColor: colors.white[100] });
  });

  it('스크린리더는 읽지 않은 알림을 먼저 알린다', async () => {
    await renderCenter();

    expect(row('notification-1')).toHaveAccessibleName(
      '읽지 않음, 작업 취소, [정수기 필터 교체] 작업이 취소되었습니다., 3시간 전',
    );
    expect(row('notification-4')).toHaveAccessibleName(
      '신규 배정, [세탁기 설치] 작업이 배정되었습니다., 7시간 전',
    );
  });

  it('읽지 않은 알림을 누르면 읽음으로 바꾸고, 다시 그리면 흰 배경이다', async () => {
    const onRead = jest.fn();
    await renderCenter(notifications, onRead);

    await userEvent.press(row('notification-1'));
    expect(onRead).toHaveBeenCalledWith('notification-1');

    await renderCenter(
      notifications.map(item =>
        item.id === 'notification-1' ? { ...item, read: true } : item,
      ),
    );
    expect(row('notification-1')).toHaveStyle({
      backgroundColor: colors.white[100],
    });
  });

  // 다른 컴포넌트로 바꿔 그리면 행이 새로 만들어져 방금 누른 스크린리더 포커스가 사라진다
  it('읽음이 되어도 같은 행을 그대로 두고 버튼 역할만 뺀다', async () => {
    const { rerender } = await renderCenter();
    const before = row('notification-1');
    expect(before).toHaveProp('accessibilityRole', 'button');

    await rerender(
      <NotificationCenterScreen
        notifications={notifications.map(item =>
          item.id === 'notification-1' ? { ...item, read: true } : item,
        )}
        now={now}
        onRead={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    expect(row('notification-1')).toBe(before);
    expect(row('notification-1')).not.toHaveProp('accessibilityRole', 'button');
  });

  it('이미 읽은 알림은 눌러도 다시 읽음 처리하지 않는다', async () => {
    const onRead = jest.fn();
    await renderCenter(notifications, onRead);

    await userEvent.press(row('notification-4'));

    expect(onRead).not.toHaveBeenCalled();
  });

  it('알림이 없으면 빈 상태 문구를 보여준다', async () => {
    await renderCenter([]);

    expect(screen.getByText('새 알림이 없어요')).toBeOnTheScreen();
  });
});

// 참여 거절 알림은 거절 화면을 연다 (#73). 읽은 뒤에도 다시 열 수 있다
describe('NotificationCenterScreen — 열 곳이 있는 알림', () => {
  const rejected: AppNotification = {
    id: 'notification-9',
    type: 'PARTICIPATION_REQUEST_REJECTED',
    message: '[스마트 홈케어] 참여 요청이 거절되었습니다.',
    read: true,
    createdAt: new Date(now.getTime() - 60 * 60_000).toISOString(),
    participationRequestId: 'request-3',
  };

  const renderWith = (items: AppNotification[]) => {
    const props = { onRead: jest.fn(), onOpen: jest.fn() };
    return render(
      <NotificationCenterScreen
        notifications={items}
        now={now}
        onBack={jest.fn()}
        {...props}
      />,
    ).then(() => props);
  };

  it('읽은 알림이어도 버튼이고 누르면 그 참여 요청을 연다', async () => {
    const props = await renderWith([rejected]);

    const item = row('notification-9');
    expect(item).toHaveProp('accessibilityRole', 'button');
    expect(item).toHaveProp('accessibilityHint', '참여 요청 결과를 엽니다');
    await userEvent.press(item);

    expect(props.onOpen).toHaveBeenCalledWith('request-3');
    expect(props.onRead).not.toHaveBeenCalled();
  });

  it('읽은 알림이어도 열 곳이 있으면 누르고 있는 동안 배경이 Gray50 이 된다', async () => {
    await renderWith([rejected]);

    await expectPressedBackground(
      row('notification-9'),
      pressedBackground.onWhite,
    );
  });

  it('읽지 않았으면 읽음으로 바꾸고 연다', async () => {
    const props = await renderWith([{ ...rejected, read: false }]);

    await userEvent.press(row('notification-9'));

    expect(props.onRead).toHaveBeenCalledWith('notification-9');
    expect(props.onOpen).toHaveBeenCalledWith('request-3');
  });
});
