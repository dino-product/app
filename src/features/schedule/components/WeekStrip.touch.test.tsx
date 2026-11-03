import { render, screen } from '@testing-library/react-native';
import {
  expectMinTouchTarget,
  hitSlopOf,
  stylePt,
  type HostElement,
} from '../../../shared/testing/touchTarget';
import { weekDays } from '../model';
import { WeekStrip } from './WeekStrip';

// 칸 폭은 화면 폭에 따라 정해져 ScheduleScreen.touch.test 에서 확인한다

const touchDate = new Date(2026, 9, 15);

const renderTouchStrip = () =>
  render(
    <WeekStrip
      days={weekDays(touchDate)}
      selected={touchDate}
      onSelect={jest.fn()}
      onPrev={jest.fn()}
      onNext={jest.fn()}
    />,
  );

const getDay = (name = '10월 15일 목요일') =>
  screen.getByRole('button', { name });

describe('WeekStrip 터치 영역', () => {
  it('날짜 칸은 Figma 칸 높이 그대로 최소 터치 영역을 채운다', async () => {
    await renderTouchStrip();

    expectMinTouchTarget(getDay(), { height: stylePt(getDay(), 'height') });
  });

  // 겹친 곳은 뒤 형제가 먼저 받으므로 뒤 칸 쪽으로만, 칸 사이 간격까지만 넓힌다
  it('넓힌 영역은 뒤 칸 쪽 칸 사이 간격 안에 든다', async () => {
    await renderTouchStrip();

    const day = getDay();
    const slop = hitSlopOf(day);
    expect(slop.left).toBe(0);
    expect(slop.right).toBeLessThanOrEqual(
      stylePt(day.parent as HostElement, 'gap'),
    );
  });

  // 넘김 창은 옆 주를 자르려고 overflow hidden 이다. 그 밖의 터치는 안쪽 칸에 가지 않는다 (Android).
  // 페이지는 창 폭 그대로이고 좌우 여백만큼 칸이 들어가 있다
  it('마지막 칸이 넓힌 영역은 넘김 창 안(페이지 좌우 여백)에 든다', async () => {
    await renderTouchStrip();

    const saturday = getDay('10월 17일 토요일');
    // 칸 › 주 줄 › 페이지 › 트랙 › 넘김 창
    const page = saturday.parent?.parent as HostElement;
    const swipeWindow = page.parent?.parent as HostElement;
    expect(swipeWindow).toHaveStyle({ overflow: 'hidden' });
    expect(hitSlopOf(saturday).right).toBeLessThanOrEqual(
      stylePt(page, 'paddingHorizontal'),
    );
  });
});
