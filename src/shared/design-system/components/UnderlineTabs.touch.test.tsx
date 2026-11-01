import { render, screen } from '@testing-library/react-native';
import {
  expectMinTouchTarget,
  hitSlopOf,
  minLineHeight,
  stylePt,
  type HostElement,
} from '../../testing/touchTarget';
import { UnderlineTabs } from './UnderlineTabs';

const items = [
  { key: 'confirmed', label: '확정 일정', count: 2 },
  { key: 'pending', label: '응답 필요', count: 7 },
];

const renderTabs = () =>
  render(
    <UnderlineTabs
      items={items}
      selectedKey="confirmed"
      onChange={jest.fn()}
    />,
  );

describe('UnderlineTabs 터치 영역', () => {
  // 탭 폭은 라벨 글자 폭이라 계산하지 않는다. 탭 사이는 20 간격이라 좌우로 넓히지 않는다
  it('가장 작은 글자 설정에서도 탭 높이를 위아래로 넓혀 최소 터치 영역을 채운다', async () => {
    await renderTabs();

    const tab = screen.getByRole('tab', { name: '확정 일정 2건' });
    expectMinTouchTarget(tab, {
      height:
        stylePt(tab, 'paddingTop') +
        minLineHeight(screen.getByText('확정 일정')) +
        stylePt(tab, 'gap') +
        stylePt(
          screen.getByTestId('underline-tabs-indicator-confirmed'),
          'height',
        ),
    });
  });

  // 부모 뷰 경계 밖의 터치는 자식에게 가지 않으므로 탭이 넓힌 만큼 목록도 받아야 한다
  it('탭이 넓힌 영역은 탭 목록의 터치 영역 안에 있다', async () => {
    await renderTabs();

    const tab = screen.getByRole('tab', { name: '확정 일정 2건' });
    const tablist = tab.parent as HostElement;
    const tabSlop = hitSlopOf(tab);
    const listSlop = hitSlopOf(tablist);
    expect(tabSlop.top).toBeLessThanOrEqual(listSlop.top);
    // 아래로 넓힌 만큼은 목록의 밑줄 테두리 안에 든다
    expect(tabSlop.bottom).toBeLessThanOrEqual(
      stylePt(tablist, 'borderBottomWidth') + listSlop.bottom,
    );
  });
});
