import { render, screen, userEvent } from '@testing-library/react-native';
import { colors, typography } from '../design-system';
import { READABLE_MAX_WIDTH } from './readableColumn';
import { TabHeader } from './TabHeader';

const belowTabs = { paddingBottom: 16 };

// Figma 작업 수행 › 메인화면 - 시작 가능 (3463:17452) 의 제목 줄 3463:17455
describe('TabHeader', () => {
  it('제목은 Body/XL/SemiBold, #000000 이고 스크린리더에서 머리말이다', async () => {
    await render(<TabHeader title="내 작업" />);

    expect(screen.getByRole('header', { name: '내 작업' })).toHaveStyle({
      ...typography['Body/XL/SemiBold'],
      color: colors.black,
    });
  });

  it('제목 줄은 가로·양끝 정렬, 좌우 24, 상태 표시줄 아래 12, 높이 34 이고 읽기 좋은 폭 안에 있다', async () => {
    await render(<TabHeader title="내 작업" />);

    const row = screen.getByRole('header', { name: '내 작업' }).parent;
    expect(row).toHaveStyle({
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 34,
    });
    expect(row?.parent).toHaveStyle({
      paddingHorizontal: 24,
      paddingTop: 12,
      maxWidth: READABLE_MAX_WIDTH,
      alignSelf: 'center',
    });
  });

  it('화면마다 상단 바 아래 여백을 더할 수 있다', async () => {
    await render(<TabHeader title="내 일정" style={belowTabs} />);

    expect(
      screen.getByRole('header', { name: '내 일정' }).parent?.parent,
    ).toHaveStyle({ paddingTop: 12, paddingBottom: 16 });
  });

  it('알림 동작이 없으면 종을 그리지 않는다 (Figma 에 종이 없는 화면)', async () => {
    await render(<TabHeader title="내 일정" />);

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('종은 알림센터 버튼이고 누르면 알림 동작을 부른다', async () => {
    const onOpenNotifications = jest.fn();
    await render(
      <TabHeader title="내 작업" onOpenNotifications={onOpenNotifications} />,
    );

    await userEvent.press(screen.getByRole('button', { name: '알림센터' }));

    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
  });

  it('종은 누르는 동안에도 모양이 바뀌지 않는다 (채워지는 토글이 아니다)', async () => {
    await render(<TabHeader title="내 작업" onOpenNotifications={jest.fn()} />);

    const bell = screen.getByRole('button', { name: '알림센터' });
    expect(typeof bell.props.style).not.toBe('function');
    expect(bell).not.toHaveProp('accessibilityState', { selected: true });
  });

  // 종이 아래로 넓힌 터치 영역은 아래 리스트와 겹친다. 뒤 형제(리스트)가 먼저 받지 않도록 위에 쌓는다
  it('상단 바는 아래 리스트보다 위에 쌓인다', async () => {
    await render(<TabHeader title="내 작업" onOpenNotifications={jest.fn()} />);

    expect(
      screen.getByRole('header', { name: '내 작업' }).parent?.parent,
    ).toHaveStyle({ zIndex: 1 });
  });

  // 위에 쌓여도 빈 곳은 터치를 받지 않는다. 아래 요소(내 일정 하위 탭 등)가 위로 넓힌 터치 영역을 가로채지 않는다
  it('상단 바의 빈 곳은 터치를 아래로 넘긴다', async () => {
    await render(<TabHeader title="내 일정" />);

    const row = screen.getByRole('header', { name: '내 일정' }).parent;
    expect(row).toHaveStyle({ pointerEvents: 'box-none' });
    expect(row?.parent).toHaveStyle({ pointerEvents: 'box-none' });
  });
});
