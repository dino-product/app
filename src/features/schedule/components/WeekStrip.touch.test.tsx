import { render, screen } from '@testing-library/react-native';
import {
  expectMinTouchTarget,
  hitSlopOf,
  minLineHeight,
  stylePt,
  type HostElement,
} from '../../../shared/testing/touchTarget';
import { weekDays } from '../model';
import { WeekStrip } from './WeekStrip';

// 칸 사이 간격은 화면 폭에 따라 정해져 ScheduleScreen.touch.test 에서 확인한다

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
  it('날짜 칸은 폭 40 그대로 넓혀 최소 터치 영역을 채운다', async () => {
    await renderTouchStrip();

    const day = getDay();
    // 날짜 숫자·요일 글자는 40 보다 좁아 minWidth 가 폭이 된다
    expectMinTouchTarget(day, {
      width: stylePt(day, 'minWidth'),
      height:
        stylePt(day, 'paddingVertical') * 2 +
        minLineHeight(screen.getByText('15')) +
        stylePt(day, 'gap') +
        minLineHeight(screen.getByText('목')),
    });
  });

  // 칸이 붙으면(좁은 화면, 큰 글씨) 넓힌 영역이 옆 칸에 겹친다. 겹친 곳은 뒤 형제가 먼저 받으므로
  // 뒤 칸 쪽으로만 넓히면 옆 칸을 가로채지 않는다
  it('칸이 붙어도 앞 칸을 가로채지 않도록 앞쪽으로는 넓히지 않는다', async () => {
    await renderTouchStrip();

    expect(hitSlopOf(getDay()).left).toBe(0);
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
