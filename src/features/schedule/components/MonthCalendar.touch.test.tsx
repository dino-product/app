import { render, screen } from '@testing-library/react-native';
import {
  expectMinTouchTarget,
  hitSlopOf,
  minLineHeight,
  stylePt,
  type HostElement,
} from '../../../shared/testing/touchTarget';
import { MonthCalendar } from './MonthCalendar';

// 칸 폭은 화면 폭에 따라 정해져 ScheduleScreen.touch.test 에서 확인한다

const renderTouchCalendar = () =>
  render(
    <MonthCalendar
      year={2026}
      month={9}
      selected={new Date(2026, 9, 15)}
      eventCounts={new Map()}
      onSelect={jest.fn()}
      onPrev={jest.fn()}
      onNext={jest.fn()}
    />,
  );

const getDay = () => screen.getByRole('button', { name: '10월 15일 목요일' });
const getArrow = (name: string) => screen.getByRole('button', { name });
// 날짜 칸 › 주(행) › 주 묶음
const weeksOf = (day: HostElement) => day.parent?.parent as HostElement;
const getRoot = () => screen.getByTestId('month-calendar');

describe('MonthCalendar 터치 영역', () => {
  it('날짜 칸은 Figma 칸 높이 그대로 최소 터치 영역을 채운다', async () => {
    await renderTouchCalendar();

    expectMinTouchTarget(getDay(), { height: stylePt(getDay(), 'height') });
  });

  it('날짜 칸이 넓힌 영역이 옆 칸·이웃 주와 겹치지 않는다', async () => {
    await renderTouchCalendar();

    const day = getDay();
    const slop = hitSlopOf(day);
    // 7칸이 빈틈없이 붙어 있어 좌우로는 넓히지 않는다
    expect(slop.left + slop.right).toBe(0);
    expect(slop.top + slop.bottom).toBeLessThanOrEqual(
      stylePt(weeksOf(day), 'gap'),
    );
  });

  it.each(['이전 달', '다음 달'])(
    '%s 버튼은 24 아이콘 그대로 최소 터치 영역으로 넓힌다',
    async name => {
      await renderTouchCalendar();

      const arrow = getArrow(name);
      const icon = arrow.children[0] as HostElement;
      expectMinTouchTarget(arrow, {
        width: stylePt(icon, 'width'),
        height: stylePt(icon, 'height'),
      });
    },
  );

  // 제목은 화살표와 겹치면 먼저 터치를 받아 가는 네이티브 뷰다
  it('화살표가 제목 쪽으로 넓힌 영역은 제목과의 간격 안에 든다', async () => {
    await renderTouchCalendar();

    const prev = getArrow('이전 달');
    const gap = stylePt(prev.parent as HostElement, 'gap');
    expect(hitSlopOf(prev).right).toBeLessThanOrEqual(gap);
    expect(hitSlopOf(getArrow('다음 달')).left).toBeLessThanOrEqual(gap);
  });

  // 요일 줄은 화살표보다 뒤 형제라 겹친 곳의 터치를 먼저 받는다. 화살표가 아래로 넓힌 영역은
  // Android 에서 간격 12 를 꽉 채워 요일 줄 바로 위까지 온다
  it('요일 줄은 터치를 받지 않아 화살표가 아래로 넓힌 영역을 가로채지 않는다', async () => {
    await renderTouchCalendar();

    const weekdays = screen.getByText('일').parent as HostElement;
    expect(weekdays).toHaveStyle({ pointerEvents: 'none' });
  });

  // 넘김 창은 옆 달을 자르려고 overflow hidden 이다. 그 밖의 터치는 안쪽 칸에 가지 않는다 (Android).
  // 창은 지금 달 격자 높이 그대로라 첫 주 위·마지막 주 아래로 넓힌 영역은 잘린다
  it('날짜 칸이 위아래로 넓힌 영역은 넘김 창 안에 든다', async () => {
    await renderTouchCalendar();

    const day = getDay();
    // 칸 › 주 › 격자 › 페이지 › 트랙 › 넘김 창
    const swipeWindow = weeksOf(day).parent?.parent?.parent as HostElement;
    expect(swipeWindow).toHaveStyle({ overflow: 'hidden' });
    const slop = hitSlopOf(day);
    expect(slop.top).toBeLessThanOrEqual(stylePt(swipeWindow, 'paddingTop'));
    expect(slop.bottom).toBeLessThanOrEqual(
      stylePt(swipeWindow, 'paddingBottom'),
    );
  });

  // 루트가 네이티브 뷰가 되면(testID·제스처 핸들러) 그 경계 밖의 터치는 자식에게 가지 않는다
  it('화살표가 루트 밖으로 넓힌 영역은 루트의 터치 영역 안에 든다', async () => {
    await renderTouchCalendar();

    const rootSlop = hitSlopOf(getRoot());
    // 맨 위 제목 줄의 화살표 위쪽. 제목 줄 높이는 글자가 가장 작을 때 가장 낮고,
    // 화살표보다 낮아지면 화살표가 제목 줄을 채워 위 여백이 없다
    const prev = getArrow('이전 달');
    const icon = prev.children[0] as HostElement;
    const titleInset = Math.max(
      0,
      (minLineHeight(screen.getByText('2026년 10월')) -
        stylePt(icon, 'height')) /
        2,
    );
    expect(hitSlopOf(prev).top - titleInset).toBeLessThanOrEqual(rootSlop.top);
  });
});
