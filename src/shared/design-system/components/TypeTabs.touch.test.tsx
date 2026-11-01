import { render, screen } from '@testing-library/react-native';
import {
  expectMinTouchTarget,
  minLineHeight,
  stylePt,
} from '../../testing/touchTarget';
import { TypeTabs } from './TypeTabs';

const items = [
  { key: 'employee', label: '직원유형' },
  { key: 'driver', label: '기사유형' },
  { key: 'work', label: '작업유형' },
];

describe('TypeTabs 터치 영역', () => {
  // 탭 폭은 좌우 패딩 32 + 라벨 글자 폭이라 계산하지 않는다. 탭 사이는 8 간격이라 좌우로 넓히지 않는다
  it('가장 작은 글자 설정에서도 탭 높이를 위아래로 넓혀 최소 터치 영역을 채운다', async () => {
    await render(
      <TypeTabs items={items} selectedKey="employee" onChange={jest.fn()} />,
    );

    const tab = screen.getByRole('tab', { name: '직원유형' });
    expectMinTouchTarget(tab, {
      height:
        stylePt(tab, 'paddingVertical') * 2 +
        minLineHeight(screen.getByText('직원유형')),
    });
  });
});
