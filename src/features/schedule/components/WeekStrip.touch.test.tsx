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

  // 루트가 네이티브 뷰가 되면(testID·제스처 핸들러) 그 경계 밖의 터치는 자식에게 가지 않는다
  it('마지막 칸이 루트 밖으로 넓힌 영역은 루트의 터치 영역 안에 든다', async () => {
    await renderTouchStrip();

    const saturday = getDay('10월 17일 토요일');
    const root = saturday.parent as HostElement;
    expect(hitSlopOf(saturday).right).toBeLessThanOrEqual(
      hitSlopOf(root).right,
    );
  });
});
