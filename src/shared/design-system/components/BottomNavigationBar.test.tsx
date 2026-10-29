import { render, screen, userEvent } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import * as SafeArea from 'react-native-safe-area-context';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';
import {
  BottomNavigationBar,
  type BottomNavigationItem,
} from './BottomNavigationBar';

const renderIcon: BottomNavigationItem['renderIcon'] = ({ active, color }) => (
  <RNText testID={`icon-${active ? 'active' : 'idle'}`}>{color}</RNText>
);

const items: BottomNavigationItem[] = [
  { key: 'home', label: '홈', renderIcon },
  { key: 'schedule', label: '내 일정', renderIcon },
  { key: 'history', label: '작업 이력', renderIcon },
  { key: 'my', label: '마이', renderIcon },
];

describe('BottomNavigationBar', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('항목마다 탭을 그리고 활성 탭을 선택 상태로 노출한다', async () => {
    await render(
      <BottomNavigationBar
        items={items}
        activeKey="home"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: '홈' })).toBeSelected();
    expect(screen.getByRole('tab', { name: '마이' })).not.toBeSelected();
  });

  it('활성 라벨은 Primary, 나머지는 Gray500 이다', async () => {
    await render(
      <BottomNavigationBar
        items={items}
        activeKey="home"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText('홈')).toHaveStyle({
      ...typography['Caption/M/Medium'],
      color: colors.primary,
    });
    expect(screen.getByText('내 일정')).toHaveStyle({
      color: colors.gray[500],
    });
  });

  it('아이콘에 활성 여부와 라벨과 같은 색을 넘긴다', async () => {
    await render(
      <BottomNavigationBar
        items={items}
        activeKey="home"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('icon-active')).toHaveTextContent(colors.primary);
    expect(screen.getAllByTestId('icon-idle')).toHaveLength(3);
  });

  it('탭을 누르면 그 key 로 onChange 를 호출한다', async () => {
    const onChange = jest.fn();
    await render(
      <BottomNavigationBar
        items={items}
        activeKey="home"
        onChange={onChange}
      />,
    );

    await userEvent.press(screen.getByRole('tab', { name: '작업 이력' }));

    expect(onChange).toHaveBeenCalledWith('history');
  });

  it('위쪽 모서리 30, 흰 배경 컨테이너이고 아래 안전 영역만큼 띄운다', async () => {
    await render(
      <BottomNavigationBar
        items={items}
        activeKey="home"
        onChange={jest.fn()}
        testID="bottom-nav"
      />,
    );

    expect(screen.getByTestId('bottom-nav')).toHaveStyle({
      backgroundColor: colors.white[100],
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      borderColor: colors.inactive,
      boxShadow: '0px -4px 4px rgba(0, 0, 0, 0.03)',
      paddingTop: 16,
      // jest 목의 인셋은 0 이라 최소 여백이 적용된다
      paddingBottom: 16,
    });
  });

  it('아래 인셋이 최소 여백보다 크면 인셋만큼 띄운다', async () => {
    jest
      .spyOn(SafeArea, 'useSafeAreaInsets')
      .mockReturnValue({ top: 0, right: 0, bottom: 34, left: 0 });

    await render(
      <BottomNavigationBar
        items={items}
        activeKey="home"
        onChange={jest.fn()}
        testID="bottom-nav"
      />,
    );

    expect(screen.getByTestId('bottom-nav')).toHaveStyle({ paddingBottom: 34 });
  });
});
