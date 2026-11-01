import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import {
  expectMinTouchTarget,
  hitSlopOf,
  minLineHeight,
  stylePt,
  type HostElement,
} from '../../testing/touchTarget';
import {
  BottomNavigationBar,
  type BottomNavigationItem,
} from './BottomNavigationBar';

const renderIcon: BottomNavigationItem['renderIcon'] = () => <View />;

const items: BottomNavigationItem[] = [
  { key: 'home', label: '홈', renderIcon },
  { key: 'schedule', label: '내 일정', renderIcon },
  { key: 'history', label: '작업 이력', renderIcon },
  { key: 'my', label: '마이', renderIcon },
];

const renderBar = () =>
  render(
    <BottomNavigationBar items={items} activeKey="home" onChange={jest.fn()} />,
  );

describe('BottomNavigationBar 터치 영역', () => {
  // 탭 폭은 화면 폭의 1/4 이라 넉넉하다. 높이는 아이콘 + 간격 + 라벨 한 줄이다
  it('가장 작은 글자 설정에서도 탭 높이가 최소 터치 영역 이상이다', async () => {
    await renderBar();

    const tab = screen.getByRole('tab', { name: '홈' });
    const icon = tab.children[0] as HostElement;
    expectMinTouchTarget(tab, {
      height:
        stylePt(icon, 'height') +
        stylePt(tab, 'gap') +
        minLineHeight(screen.getByText('홈')),
    });
  });

  // 탭 바는 배경·테두리가 있어 네이티브 뷰다. 그 경계 밖의 터치는 탭에 가지 않는다
  it('넓힌 영역은 탭 바의 위아래 패딩 안에 든다', async () => {
    await renderBar();

    const tab = screen.getByRole('tab', { name: '홈' });
    const bar = tab.parent as HostElement;
    const slop = hitSlopOf(tab);
    expect(slop.top).toBeLessThanOrEqual(stylePt(bar, 'paddingTop'));
    expect(slop.bottom).toBeLessThanOrEqual(stylePt(bar, 'paddingBottom'));
  });
});
