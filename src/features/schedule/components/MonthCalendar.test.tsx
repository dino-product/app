import { render, screen } from '@testing-library/react-native';
import {
  expectMinTouchTarget,
  hitSlopOf,
  NARROWEST_IPHONE_WIDTH,
  stylePt,
  type HostElement,
} from '../../../shared/testing/touchTarget';
import { MonthCalendar } from './MonthCalendar';

// 내 일정 화면 dateArea 의 좌우 패딩
const SCREEN_GUTTER = 24;
// 주(행) 사이 간격 (container gap)
const WEEK_GAP = 12;

const renderCalendar = () =>
  render(
    <MonthCalendar
      year={2026}
      month={9}
      selected={new Date(2026, 9, 15)}
      markedKeys={new Set()}
      onSelect={jest.fn()}
      onPrev={jest.fn()}
      onNext={jest.fn()}
    />,
  );

describe('MonthCalendar 터치 영역', () => {
  it('날짜 칸은 40pt 원 그대로 위아래로 넓혀 44pt 를 채운다', async () => {
    await renderCalendar();

    const day = screen.getByRole('button', { name: '10월 15일 목요일' });
    const circle = screen.getByText('15').parent as HostElement;
    expectMinTouchTarget(day, {
      // 칸 폭은 달력 폭의 1/7 이다
      width: (NARROWEST_IPHONE_WIDTH - SCREEN_GUTTER * 2) / 7,
      height: stylePt(circle, 'height'),
    });
  });

  it('넓힌 영역이 옆 칸·이웃 주와 겹치지 않는다', async () => {
    await renderCalendar();

    const slop = hitSlopOf(
      screen.getByRole('button', { name: '10월 15일 목요일' }),
    );
    // 7칸이 빈틈없이 붙어 있어 좌우로는 넓히지 않는다
    expect(slop.left + slop.right).toBe(0);
    expect(slop.top + slop.bottom).toBeLessThanOrEqual(WEEK_GAP);
  });

  it.each(['이전 달', '다음 달'])(
    '%s 버튼은 16pt 아이콘 그대로 44pt 로 넓힌다',
    async name => {
      await renderCalendar();

      const button = screen.getByRole('button', { name });
      const icon = button.children[0] as HostElement;
      expectMinTouchTarget(button, {
        width: stylePt(icon, 'width'),
        height: stylePt(icon, 'height'),
      });
    },
  );
});
