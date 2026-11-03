import { render, screen } from '@testing-library/react-native';
import {
  expectIconButtonTouchTarget,
  hitSlopOf,
  stylePt,
  type HostElement,
} from '../testing/touchTarget';
import { TabHeader } from './TabHeader';

describe('TabHeader 터치 영역', () => {
  it('종은 26 아이콘 그대로 최소 터치 영역으로 넓힌다', async () => {
    await render(<TabHeader title="내 작업" onOpenNotifications={jest.fn()} />);

    expectIconButtonTouchTarget(
      screen.getByRole('button', { name: '알림센터' }),
    );
  });

  // 위로 넓힌 영역이 상단 바 밖(상태 표시줄)으로 나가지 않는다
  it('종이 위로 넓힌 영역은 상단 바 위 여백 안에 든다', async () => {
    await render(<TabHeader title="내 작업" onOpenNotifications={jest.fn()} />);

    const bell = screen.getByRole('button', { name: '알림센터' });
    const row = bell.parent as HostElement;
    const icon = bell.children[0] as HostElement;
    const inset = (stylePt(row, 'minHeight') - stylePt(icon, 'height')) / 2;
    expect(hitSlopOf(bell).top - inset).toBeLessThanOrEqual(
      stylePt(row.parent as HostElement, 'paddingTop'),
    );
  });
});
