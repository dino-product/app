import { render, screen } from '@testing-library/react-native';
import {
  expectMinTouchTarget,
  hitSlopOf,
  NARROWEST_IPHONE_WIDTH,
  stylePt,
} from '../../../shared/testing/touchTarget';
import { weekDays } from '../model';
import { WeekStrip } from './WeekStrip';

// 내 일정 화면 dateArea 의 좌우 패딩
const SCREEN_GUTTER = 24;

const selected = new Date(2026, 9, 15);

const renderStrip = () =>
  render(
    <WeekStrip
      days={weekDays(selected)}
      selected={selected}
      onSelect={jest.fn()}
    />,
  );

describe('WeekStrip 터치 영역', () => {
  it('날짜 칸은 폭 40 그대로 좌우로 넓혀 44pt 를 채운다', async () => {
    await renderStrip();

    const day = screen.getByRole('button', { name: '10월 15일 목요일' });
    // 날짜 숫자·요일 글자는 40 보다 좁아 minWidth 가 폭이 된다
    expectMinTouchTarget(day, {
      width: stylePt(day, 'minWidth'),
      height:
        stylePt(day, 'paddingVertical') * 2 +
        stylePt(screen.getByText('15'), 'lineHeight') +
        stylePt(day, 'gap') +
        stylePt(screen.getByText('목'), 'lineHeight'),
    });
  });

  it('좌우로 넓힌 영역이 옆 날짜와 겹치지 않는다', async () => {
    await renderStrip();

    const day = screen.getByRole('button', { name: '10월 15일 목요일' });
    // 7칸을 space-between 으로 벌리므로 칸 사이 간격은 남는 폭의 1/6 이다
    const rowWidth = NARROWEST_IPHONE_WIDTH - SCREEN_GUTTER * 2;
    const spacing = (rowWidth - stylePt(day, 'minWidth') * 7) / 6;
    const slop = hitSlopOf(day);
    expect(slop.left + slop.right).toBeLessThanOrEqual(spacing);
  });
});
