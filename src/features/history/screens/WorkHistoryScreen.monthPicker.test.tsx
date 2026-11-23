import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { holdNativeAnimations } from '../../../../jest/nativeAnimation';
import { swipeFrom } from '../../../../jest/responder';
import { fakeTabCover, WithTabCover } from '../../../../jest/tabCover';
import { colors, typography } from '../../../shared/design-system';
import { TabSwipeArea } from '../../../shared/gesture/TabSwipeArea';
import { SWITCH_DISTANCE } from '../../../shared/gesture/tabSwipe';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { scrollListTo } from '../../../shared/testing/autoHideHeader';
import { pressIn } from '../../../shared/testing/press';
import type { HostElement } from '../../../shared/testing/touchTarget';
import type { CompletedWork } from '../model';
import { PICKER_MS, pickerEasing, WHEEL_ROW } from '../monthPicker';
import {
  WorkHistoryScreen,
  type WorkHistoryScreenProps,
} from './WorkHistoryScreen';

// #203 작업이력 날짜 선택. Figma 작업이력 (날짜 선택) 50867:4988 · (날짜 호버) 50867:4861, 시안 A '글자 자리에서 펼쳐짐'.
// 월 글자를 누르면 글자 자리에서 흰 상자가 펼쳐지고, 연·월 휠을 굴려 고른 달은 상자 바깥이나 머리 글자를 누르면 적용된다

const today = new Date(2026, 8, 28); // 2026년 9월

const base = {
  start: '08:00',
  end: '09:00',
  company: '한빛 설비',
  customerName: '정다은',
  address: '서울 용산구 이태원로 202',
};
const works: CompletedWork[] = [
  { ...base, id: 's1', dateKey: '2026-09-26', title: '세탁기 설치' },
  { ...base, id: 'a1', dateKey: '2026-08-20', title: '도어록 교체' },
  { ...base, id: 'o1', dateKey: '2025-03-11', title: '보일러 점검' },
];

const renderHistory = (overrides: Partial<WorkHistoryScreenProps> = {}) =>
  render(
    <WorkHistoryScreen
      today={today}
      works={works}
      onOpenWork={jest.fn()}
      {...overrides}
    />,
  );

const hidden = { includeHiddenElements: true };
const monthButton = (name = '2026년 9월') =>
  screen.getByRole('button', { name });
const monthText = () => screen.getByText(/^\d{4}년 \d{1,2}월$/);
/** 목록 (상자가 열린 동안은 스크린리더에서 빠진다) */
const list = () => screen.getByTestId('work-history-list', hidden);
const picker = () => screen.queryByTestId('work-history-month-picker');
const part = (testID: string) => screen.getByTestId(testID, hidden);
const box = () => part('work-history-month-picker-box');
const yearWheel = () => screen.getByTestId('month-picker-year-wheel', hidden);
const monthWheel = () => screen.getByTestId('month-picker-month-wheel', hidden);
/** 목록 행 제목. 상자가 열린 동안은 목록이 스크린리더에서 빠져 있어 숨은 요소도 찾는다 */
const rowTitles = () =>
  screen
    .getAllByRole('button', { name: /, 완료, /, ...hidden })
    .map(row => row.props.accessibilityLabel.split(',')[0]);
const styleOf = (element: HostElement) =>
  StyleSheet.flatten(element.props.style);
function transformOf(element: HostElement, key: string): unknown {
  const transform = styleOf(element).transform as
    | Record<string, unknown>[]
    | undefined;
  return transform?.find(item => key in item)?.[key];
}

/** 휠이 index 줄에서 멈춘다 (손을 뗀 뒤 관성이 끝났다) */
const settleWheel = (wheel: HostElement, index: number) =>
  act(() => {
    fireEvent(wheel, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 0, y: index * WHEEL_ROW } },
    });
  });
/** 손가락으로 휠을 굴리기 시작한다 */
const beginDrag = (wheel: HostElement) =>
  act(() => {
    fireEvent(wheel, 'scrollBeginDrag', {
      nativeEvent: { contentOffset: { x: 0, y: 0 } },
    });
  });
/** y 에서 손을 뗀다. velocity 가 0 이 아니면 관성이 이어진다 */
const endDrag = (wheel: HostElement, y: number, velocity = 0) =>
  act(() => {
    fireEvent(wheel, 'scrollEndDrag', {
      nativeEvent: {
        contentOffset: { x: 0, y },
        velocity: { x: 0, y: velocity },
      },
    });
  });
const scrollTo = jest.mocked(ScrollView.prototype.scrollTo);

/** 한 자리에서 누르고 뗀다 (상자 바깥·머리 글자·상자 안) */
const tap = (element: HostElement) =>
  swipeFrom(element, { from: { x: 200, y: 400 }, steps: 1 });

let finishAnimations: () => Promise<void>;
beforeEach(() => {
  finishAnimations = holdNativeAnimations().finish;
  scrollTo.mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest
    .mocked(AccessibilityInfo.isReduceMotionEnabled)
    .mockImplementation(() => Promise.resolve(false));
});

describe('날짜 선택 — 열기 (#203)', () => {
  it('월 글자는 날짜 선택을 여는 버튼이고 처음에는 닫혀 있다', async () => {
    await renderHistory();

    expect(monthButton()).toBeCollapsed();
    expect(picker()).toBeNull();
    expect(screen.queryByTestId('work-history-month-picker-box')).toBeNull();
  });

  // Figma 작업이력 (날짜 호버) 50867:4871: 바뀐 것은 월 글자 색 하나다 (휴대폰에는 호버가 없어 눌림으로 본다)
  it('누르고 있는 동안 월 글자만 Gray800 에서 Gray900 으로 진해진다', async () => {
    await renderHistory();

    await pressIn(monthButton());
    expect(monthText()).toHaveStyle({ color: colors.gray[900] });
    // 누른 채 밀어 누르기가 취소되면 돌아온다 (상자는 열리지 않는다). 가장 짧은 누름 시간(130ms)이 지난 뒤다
    await act(() => new Promise<void>(resolve => setTimeout(resolve, 130)));
    await fireEvent(monthButton(), 'responderTerminate', {
      persist: () => {},
      currentTarget: { measure: () => {} },
      nativeEvent: { touches: [], changedTouches: [], timestamp: 0 },
    });
    expect(monthText()).toHaveStyle({ color: colors.gray[800] });
    expect(picker()).toBeNull();
  });

  it('월 글자를 누르면 상자가 240ms 감속 곡선의 UI 스레드 전환으로 열린다', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await renderHistory();

    await userEvent.press(monthButton());

    expect(picker()).toBeOnTheScreen();
    expect(monthButton()).toBeExpanded();
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), {
      toValue: 1,
      duration: PICKER_MS,
      easing: pickerEasing,
      useNativeDriver: true,
    });
  });

  // Figma 50867:5281: 열린 상자의 머리 글자는 기본 월 글자와 같은 자리·같은 크기이고 색만 Gray900 이다
  it('머리 글자는 월 글자 그대로(같은 자리 Body/M/SemiBold)이고 Gray900 이며, 화살표는 글자 쪽으로 들어가며 사라진다', async () => {
    await renderHistory();
    const textBefore = monthText();

    await userEvent.press(monthButton());
    await finishAnimations();

    expect(monthText()).toBe(textBefore);
    expect(monthText()).toHaveStyle({
      ...typography['Body/M/SemiBold'],
      color: colors.gray[900],
    });
    expect(transformOf(part('work-history-month'), 'translateY')).toBeCloseTo(
      0,
      5,
    );
    for (const [name, inward] of [
      ['이전 달', 8],
      ['다음 달', -8],
    ] as const) {
      const icon = screen.getByRole('button', { name, ...hidden })
        .children[0] as HostElement;
      expect(styleOf(icon).opacity).toBe(0);
      expect(transformOf(icon, 'translateX')).toBe(inward);
      expect(transformOf(icon, 'scale')).toBe(0.5);
    }
  });

  // Figma 50867:5275: 위 92(상태 표시줄 60 + 32) · 왼쪽 24 · 345×274 · 반경 24.68 · White/100 · 그림자, 배경 어둡게 하기 없음
  it('상자는 월 줄 위 24 에서 시작하는 좌우 24 안쪽의 345×274 흰 상자다', async () => {
    await renderHistory();

    await userEvent.press(monthButton());
    await finishAnimations();

    expect(box()).toHaveStyle({
      backgroundColor: colors.white[100],
      borderRadius: 24.68,
      boxShadow: '0px 4.94px 9.87px rgba(0, 0, 0, 0.06)',
    });
    const column = box().parent as HostElement;
    expect(column).toHaveStyle({ ...readableColumn, paddingHorizontal: 24 });
    expect(column.parent).toHaveStyle({ top: 32, height: 274 });
    // 상자 밖은 어둡게 하지 않는다 (바깥을 누르는 자리는 투명하다)
    expect(
      styleOf(part('work-history-month-picker-backdrop')).backgroundColor,
    ).toBeUndefined();
  });

  // 시안 A: 흰 바탕이 월 글자 크기에서 상자 크기로 커지고, 휠은 70% 부터 나타난다
  it('상자는 월 글자 자리·크기에서 펼쳐지고, 휠은 다 펼친 뒤에 보인다', async () => {
    await renderHistory();

    await userEvent.press(monthButton());

    // 글자(99×28, 가운데 위 14) 크기·자리에서 시작한다: 상자 가운데(137)에서 위로 99
    expect(transformOf(box(), 'translateY')).toBeCloseTo(-99, 5);
    expect(transformOf(box(), 'scaleX')).toBeCloseTo(99 / 345, 5);
    expect(transformOf(box(), 'scaleY')).toBeCloseTo(28 / 274, 5);
    expect(styleOf(part('work-history-month-picker-wheel')).opacity).toBe(0);

    await finishAnimations();
    expect(transformOf(box(), 'translateY')).toBeCloseTo(0, 5);
    expect(transformOf(box(), 'scaleX')).toBeCloseTo(1, 5);
    expect(transformOf(box(), 'scaleY')).toBeCloseTo(1, 5);
    expect(styleOf(part('work-history-month-picker-wheel')).opacity).toBe(1);
  });

  it('잰 월 글자 폭·상자 폭으로 시작 크기를 정한다 (상자 폭은 닫은 뒤에도 기억한다)', async () => {
    await renderHistory();
    await act(() => {
      fireEvent(monthText().parent as HostElement, 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 120, height: 28 } },
      });
    });
    await userEvent.press(monthButton());
    await act(() => {
      fireEvent(box(), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 274 } },
      });
    });
    await tap(part('work-history-month-picker-backdrop'));
    await finishAnimations();

    await userEvent.press(monthButton());

    expect(transformOf(box(), 'scaleX')).toBeCloseTo(120 / 300, 5);
  });

  // 시안 제안: 접힌 바에서 열면 글자가 접힌 자리(위 79 · 18)에서 상자 머리(위 116 · 20)로 내려오며 커진다
  it('상단 바가 접힌 채 열면 월 글자가 접힌 자리에서 머리 자리로 내려오며 커지고, 바는 접힌 채다', async () => {
    await renderHistory();
    await scrollListTo(list(), 300);
    await finishAnimations();

    await userEvent.press(monthButton());
    expect(transformOf(part('work-history-month'), 'translateY')).toBeCloseTo(
      -38.4,
      5,
    );
    expect(transformOf(monthText().parent as HostElement, 'scale')).toBe(0.9);
    // 상자도 접힌 글자(0.9 배) 자리에서 펼쳐진다
    expect(transformOf(box(), 'translateY')).toBeCloseTo(-99 - 38.4, 5);
    expect(transformOf(box(), 'scaleX')).toBeCloseTo((99 / 345) * 0.9, 5);

    await finishAnimations();
    expect(transformOf(part('work-history-month'), 'translateY')).toBeCloseTo(
      0,
      5,
    );
    expect(transformOf(monthText().parent as HostElement, 'scale')).toBe(1);
    expect(styleOf(part('work-history-bar-tint')).opacity).toBe(1);
  });
});

// Figma wheelPicker 51030:18401 · selected 51030:18402 · 흐림 51030:17834 · 51030:17835
describe('날짜 선택 — 휠 Figma 값 (#203)', () => {
  beforeEach(async () => {
    await renderHistory();
    await userEvent.press(monthButton());
    await finishAnimations();
  });

  it('휠은 상자 안 좌우 24 · 위 76 의 높이 174 이고 넘치는 줄은 잘린다', () => {
    expect(part('work-history-month-picker-wheel')).toHaveStyle({
      position: 'absolute',
      top: 76,
      left: 24,
      right: 24,
      height: 174,
      overflow: 'hidden',
    });
  });

  it('선택 줄 띠는 위 70.85 · 높이 32.31 · 반경 7.60 의 검정 4% 다', () => {
    expect(part('work-history-month-picker-band')).toHaveStyle({
      top: 70.85,
      height: 32.31,
      left: 0.07,
      right: 0.86,
      borderRadius: 7.6,
      backgroundColor: 'rgba(0, 0, 0, 0.04)',
    });
  });

  it('위아래 흐림은 가운데 쪽 좁은 띠에 흰색 → 42% 흰색으로 덮인다', () => {
    expect(part('work-history-month-picker-fade-top')).toHaveStyle({
      top: 6,
      height: 13,
      width: 98,
      marginLeft: -49.5,
      backgroundImage:
        'linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0.42))',
    });
    expect(part('work-history-month-picker-fade-bottom')).toHaveStyle({
      top: 152,
      height: 14,
      width: 108,
      marginLeft: -54.5,
      backgroundImage:
        'linear-gradient(to bottom, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 1))',
    });
  });

  it('연도 열은 2020 ~ 올해, 월 열은 1 ~ 12월이고, 보던 달(2026년 9월)에서 시작한다', () => {
    expect(yearWheel()).toHaveProp('contentOffset', {
      x: 0,
      y: 6 * WHEEL_ROW,
    });
    expect(monthWheel()).toHaveProp('contentOffset', {
      x: 0,
      y: 8 * WHEEL_ROW,
    });
    for (const year of [2020, 2023, 2026]) {
      expect(screen.getByText(`${year}년`, hidden)).toBeOnTheScreen();
      expect(screen.getByText(`${year}`, hidden)).toBeOnTheScreen();
    }
    expect(screen.queryByText('2027', hidden)).toBeNull();
    for (const month of [1, 9, 12]) {
      expect(screen.getByText(`${month}월`, hidden)).toBeOnTheScreen();
    }
  });

  it('휠은 한 줄(32)씩 붙어 멈추고, 스크롤 표시줄·가장자리 효과가 없다', () => {
    for (const wheel of [yearWheel(), monthWheel()]) {
      expect(wheel).toHaveProp('snapToInterval', WHEEL_ROW);
      expect(wheel).toHaveProp('decelerationRate', 'fast');
      expect(wheel).toHaveProp('showsVerticalScrollIndicator', false);
      expect(wheel).toHaveProp('overScrollMode', 'never');
      expect(wheel).toHaveProp('scrollEventThrottle', 16);
    }
  });

  // Figma 가운데 줄 SF Pro Text Regular 22.17 #000. iOS 는 시스템 글꼴(SF Pro), Android 는 Pretendard Regular (#203 정해야 할 것)
  it('줄 글자는 22.17 검정이고, 월은 자간 -0.95 다', () => {
    expect(screen.getByText('2026년', hidden)).toHaveStyle({
      fontSize: 22.17,
      lineHeight: 26,
      color: colors.black,
      letterSpacing: 0,
    });
    expect(screen.getByText('9월', hidden)).toHaveStyle({
      fontSize: 22.17,
      color: colors.black,
      letterSpacing: -0.95,
    });
  });
});

describe('날짜 선택 — 고르기와 적용 (#203)', () => {
  it('휠이 멈추면 머리 글자가 그 달로 바뀌고, 목록은 닫을 때까지 그대로다', async () => {
    const onMonthChange = jest.fn();
    await renderHistory({ onMonthChange });
    await userEvent.press(monthButton());

    await settleWheel(yearWheel(), 5);

    expect(monthText()).toHaveTextContent('2025년 9월');
    expect(rowTitles()).toEqual(['세탁기 설치']);
    expect(onMonthChange).not.toHaveBeenCalled();
  });

  it('줄 위에서 멈춘 채 손을 떼면(관성 없음) 그 줄에서 멈춘 것이고, 줄 사이에서 떼거나 관성이 있으면 관성이 끝날 때까지 기다린다', async () => {
    await renderHistory();
    await userEvent.press(monthButton());

    await endDrag(yearWheel(), 4.5 * WHEEL_ROW);
    expect(monthText()).toHaveTextContent('2026년 9월');
    // 튕기며 손을 뗀 자리가 마침 줄 위여도 지나가는 줄이다 (머리 글자가 두 번 바뀌지 않는다)
    await endDrag(yearWheel(), 4 * WHEEL_ROW, -3);
    expect(monthText()).toHaveTextContent('2026년 9월');
    await settleWheel(yearWheel(), 1);
    expect(monthText()).toHaveTextContent('2021년 9월');

    await endDrag(yearWheel(), 4 * WHEEL_ROW);
    expect(monthText()).toHaveTextContent('2024년 9월');
  });

  it('상자 바깥을 누르면 고른 달을 적용하며 닫는다 (목록이 그 달로 바뀌고 알린다)', async () => {
    const onMonthChange = jest.fn();
    await renderHistory({ onMonthChange });
    await userEvent.press(monthButton());
    await settleWheel(yearWheel(), 5);
    await settleWheel(monthWheel(), 2);

    await tap(part('work-history-month-picker-backdrop'));

    expect(onMonthChange).toHaveBeenCalledWith({ year: 2025, month: 2 });
    expect(rowTitles()).toEqual(['보일러 점검']);
    expect(monthButton('2025년 3월')).toBeCollapsed();
    await finishAnimations();
    expect(picker()).toBeNull();
    expect(screen.queryByTestId('work-history-month-picker-box')).toBeNull();
    expect(monthText()).toHaveStyle({ color: colors.gray[800] });
  });

  it('휠이 관성으로 도는 중에 바깥을 누르면, 닫는 동안 휠이 멈춘 줄의 달을 한 번만 적용한다', async () => {
    const onMonthChange = jest.fn();
    await renderHistory({ onMonthChange });
    await userEvent.press(monthButton());
    await finishAnimations();
    await beginDrag(yearWheel());
    await endDrag(yearWheel(), 4.5 * WHEEL_ROW, -3);

    await tap(part('work-history-month-picker-backdrop'));
    expect(onMonthChange).not.toHaveBeenCalled();
    expect(monthButton()).toBeCollapsed();

    await settleWheel(yearWheel(), 1);
    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onMonthChange).toHaveBeenCalledWith({ year: 2021, month: 8 });
    expect(monthText()).toHaveTextContent('2021년 9월');
    await finishAnimations();
    expect(picker()).toBeNull();
    expect(onMonthChange).toHaveBeenCalledTimes(1);
  });

  it('닫는 전환이 끝날 때까지 휠이 멈추지 않으면 그때 머리 글자의 달을 적용한다', async () => {
    const onMonthChange = jest.fn();
    await renderHistory({ onMonthChange });
    await userEvent.press(monthButton());
    await settleWheel(monthWheel(), 7);
    await beginDrag(yearWheel());
    await endDrag(yearWheel(), 4.5 * WHEEL_ROW, -3);

    await tap(part('work-history-month-picker-backdrop'));
    expect(onMonthChange).not.toHaveBeenCalled();
    await finishAnimations();

    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onMonthChange).toHaveBeenCalledWith({ year: 2026, month: 7 });
    expect(picker()).toBeNull();
  });

  it('닫는 중에 다시 열면 휠을 고른 달에서 새로 시작한다', async () => {
    await renderHistory();
    await userEvent.press(monthButton());
    await settleWheel(yearWheel(), 5);
    await tap(part('work-history-month-picker-backdrop'));

    await userEvent.press(monthButton('2025년 9월'));

    expect(monthButton('2025년 9월')).toBeExpanded();
    expect(yearWheel()).toHaveProp('contentOffset', {
      x: 0,
      y: 5 * WHEEL_ROW,
    });
    expect(monthWheel()).toHaveProp('contentOffset', {
      x: 0,
      y: 8 * WHEEL_ROW,
    });
  });

  it('머리 글자(월 글자)를 누르면 적용하며 닫는다', async () => {
    const onMonthChange = jest.fn();
    await renderHistory({ onMonthChange });
    await userEvent.press(monthButton());
    await settleWheel(monthWheel(), 7);

    await tap(part('work-history-month-picker-head'));

    expect(onMonthChange).toHaveBeenCalledWith({ year: 2026, month: 7 });
    expect(rowTitles()).toEqual(['도어록 교체']);
  });

  it('스크린리더로 월 글자 버튼을 눌러도 적용하며 닫는다', async () => {
    await renderHistory();
    await userEvent.press(monthButton());
    await settleWheel(monthWheel(), 7);

    await userEvent.press(monthButton('2026년 8월'));

    expect(monthButton('2026년 8월')).toBeCollapsed();
  });

  it('상자 안(휠 밖)을 눌러도 닫히지 않는다', async () => {
    await renderHistory();
    await userEvent.press(monthButton());

    await tap(part('work-history-month-picker-panel'));

    expect(monthButton()).toBeExpanded();
  });

  it('고른 달이 보던 달과 같으면 그대로 닫는다', async () => {
    const onMonthChange = jest.fn();
    await renderHistory({ onMonthChange });
    await userEvent.press(monthButton());

    await tap(part('work-history-month-picker-backdrop'));

    expect(onMonthChange).not.toHaveBeenCalled();
    expect(monthButton()).toBeCollapsed();
  });

  // 시안 제안: iOS 날짜 선택의 최대 날짜처럼 이번 달 뒤로는 갈 수 없다
  it('이번 달 뒤의 달에 멈추면 월 휠이 이번 달로 되돌아간다', async () => {
    await renderHistory();
    await userEvent.press(monthButton());

    await settleWheel(monthWheel(), 11);

    expect(scrollTo).toHaveBeenLastCalledWith({
      x: 0,
      y: 8 * WHEEL_ROW,
      animated: true,
    });
    expect(monthText()).toHaveTextContent('2026년 9월');
  });

  it('지난해 12월을 보다가 연도를 올해로 굴리면 월이 이번 달로 되돌아간다', async () => {
    await renderHistory();
    await userEvent.press(monthButton());
    await settleWheel(yearWheel(), 5);
    await settleWheel(monthWheel(), 11);
    expect(monthText()).toHaveTextContent('2025년 12월');

    await settleWheel(yearWheel(), 6);

    expect(scrollTo).toHaveBeenLastCalledWith({
      x: 0,
      y: 8 * WHEEL_ROW,
      animated: true,
    });
    expect(monthText()).toHaveTextContent('2026년 9월');
  });

  it('줄을 누르면 그 줄로 굴러간다', async () => {
    await renderHistory();
    await userEvent.press(monthButton());
    const column = screen.getByRole('adjustable', { name: '월', ...hidden });

    // 휠 위 끝에서 26 (가운데 87 에서 두 줄 위, Figma 위 -55.3 근처)
    await swipeFrom(column, {
      from: { x: 200, y: 400 + 26 },
      steps: 1,
      rects: new Map([[column, { x: 180, y: 400, width: 150, height: 174 }]]),
    });

    expect(scrollTo).toHaveBeenLastCalledWith({
      x: 0,
      y: 6 * WHEEL_ROW,
      animated: true,
    });
    expect(monthText()).toHaveTextContent('2026년 7월');
  });

  it('Android 뒤로 가기는 상자만 닫는다 (고른 달을 적용한다)', async () => {
    type Handler = Parameters<typeof BackHandler.addEventListener>[1];
    const handlers = new Set<Handler>();
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        handlers.add(handler);
        return { remove: () => handlers.delete(handler) };
      });
    // RN BackHandler 처럼 나중에 등록한 핸들러부터 부르고, 하나가 처리하면 멈춘다
    const pressBack = async () => {
      let handled = false;
      await act(() => {
        handled = [...handlers]
          .reverse()
          .some(handler => handler(undefined as never) === true);
      });
      return handled;
    };
    await renderHistory();
    expect(handlers.size).toBe(0);
    await userEvent.press(monthButton());
    await settleWheel(monthWheel(), 7);

    expect(await pressBack()).toBe(true);

    expect(monthButton('2026년 8월')).toBeCollapsed();
    expect(handlers.size).toBe(0);
  });

  it('닫으면 같은 시간·곡선으로 접고, 동작 줄이기면 애니메이션 없이 바로 열고 닫는다', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await renderHistory();
    await userEvent.press(monthButton());
    await tap(part('work-history-month-picker-backdrop'));
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), {
      toValue: 0,
      duration: PICKER_MS,
      easing: pickerEasing,
      useNativeDriver: true,
    });
    await finishAnimations();

    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockImplementation(() => Promise.resolve(true));
    await renderHistory();
    timing.mockClear();
    await userEvent.press(monthButton());
    expect(transformOf(box(), 'scaleX')).toBe(1);
    await tap(part('work-history-month-picker-backdrop'));
    expect(picker()).toBeNull();
    expect(timing).not.toHaveBeenCalled();
  });
});

describe('날짜 선택 — 열린 동안 멈추는 것 (#203)', () => {
  it('목록은 스크롤하지 않고, 스크롤 이벤트가 와도 상단 바를 접지 않다가 닫은 뒤에 접는다', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await renderHistory();
    await userEvent.press(monthButton());
    await finishAnimations();
    timing.mockClear();

    expect(list()).toHaveProp('scrollEnabled', false);
    await scrollListTo(list(), 300);
    expect(timing).not.toHaveBeenCalled();

    await tap(part('work-history-month-picker-backdrop'));
    await finishAnimations();
    expect(list()).toHaveProp('scrollEnabled', true);
    // 닫는 전환 하나 뒤에 접힘 전환이 시작한다
    expect(timing).toHaveBeenCalledTimes(2);
    expect(timing.mock.calls[1][1]).toMatchObject({ toValue: 1 });
  });

  it('상자 바깥이나 휠에서 가로로 밀어도 탭·달이 바뀌지 않는다', async () => {
    const { cover, onSwipe: onTabSwipe } = fakeTabCover();
    const onMonthChange = jest.fn();
    await render(
      <WithTabCover cover={cover}>
        <TabSwipeArea canSwipe={() => true}>
          <WorkHistoryScreen
            today={today}
            works={works}
            onOpenWork={jest.fn()}
            onMonthChange={onMonthChange}
          />
        </TabSwipeArea>
      </WithTabCover>,
    );
    await userEvent.press(monthButton());

    for (const element of [
      part('work-history-month-picker-backdrop'),
      screen.getByRole('adjustable', { name: '연도', ...hidden }),
    ]) {
      await swipeFrom(element, {
        from: { x: 200, y: 600 },
        dx: SWITCH_DISTANCE + 30,
      });
    }

    expect(onTabSwipe).not.toHaveBeenCalled();
    expect(onMonthChange).not.toHaveBeenCalled();
    // 밀기는 누르기가 아니다: 상자는 열린 채다
    expect(monthButton()).toBeExpanded();
  });

  it('상자가 보이는 동안(닫는 중 포함)을 알려 바깥이 탭 바·뒤로 가기 탭 전환을 막게 한다', async () => {
    const onPickerVisibleChange = jest.fn();
    await renderHistory({ onPickerVisibleChange });
    expect(onPickerVisibleChange).not.toHaveBeenCalledWith(true);

    await userEvent.press(monthButton());
    expect(onPickerVisibleChange).toHaveBeenLastCalledWith(true);

    await tap(part('work-history-month-picker-backdrop'));
    expect(onPickerVisibleChange).toHaveBeenLastCalledWith(true);
    await finishAnimations();
    expect(onPickerVisibleChange).toHaveBeenLastCalledWith(false);
  });
});

describe('날짜 선택 — 스크린리더 (#203)', () => {
  it('연·월 열은 조절 요소이고 지금 값을 읽는다. 열린 동안 목록·제목·화살표는 읽지 않는다', async () => {
    await renderHistory();
    await userEvent.press(monthButton());

    const year = screen.getByRole('adjustable', { name: '연도' });
    const month = screen.getByRole('adjustable', { name: '월' });
    expect(year).toHaveAccessibilityValue({ text: '2026년' });
    expect(month).toHaveAccessibilityValue({ text: '9월' });
    expect(screen.queryByRole('header', { name: '작업 이력' })).toBeNull();
    expect(screen.queryByRole('button', { name: '이전 달' })).toBeNull();
    expect(screen.queryByRole('button', { name: /, 완료, / })).toBeNull();
    // 바깥 누르는 자리·머리 누르는 자리는 읽지 않는다 (월 글자 버튼이 닫는다)
    expect(within(picker()!).queryAllByRole('button')).toHaveLength(0);
  });

  it('조절 동작으로 한 줄씩 움직이고, 이번 달 뒤로는 가지 않는다', async () => {
    await renderHistory();
    await userEvent.press(monthButton());
    const month = () => screen.getByRole('adjustable', { name: '월' });

    await act(() => {
      fireEvent(month(), 'accessibilityAction', {
        nativeEvent: { actionName: 'decrement' },
      });
    });
    expect(month()).toHaveAccessibilityValue({ text: '8월' });
    expect(scrollTo).toHaveBeenLastCalledWith({
      x: 0,
      y: 7 * WHEEL_ROW,
      animated: true,
    });

    await act(() => {
      fireEvent(month(), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      });
    });
    await act(() => {
      fireEvent(month(), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      });
    });
    expect(month()).toHaveAccessibilityValue({ text: '9월' });
    expect(monthText()).toHaveTextContent('2026년 9월');
  });

  it('연도 열도 한 줄씩 움직이고 끝에서 멈춘다. 지난해 12월에서 올해로 올리면 월이 이번 달로 맞춰진다', async () => {
    await renderHistory();
    await userEvent.press(monthButton());
    const year = () => screen.getByRole('adjustable', { name: '연도' });
    const adjust = (actionName: string) =>
      act(() => {
        fireEvent(year(), 'accessibilityAction', {
          nativeEvent: { actionName },
        });
      });

    await adjust('increment');
    expect(year()).toHaveAccessibilityValue({ text: '2026년' });
    await adjust('decrement');
    expect(year()).toHaveAccessibilityValue({ text: '2025년' });
    expect(scrollTo).toHaveBeenLastCalledWith({
      x: 0,
      y: 5 * WHEEL_ROW,
      animated: true,
    });
    await settleWheel(monthWheel(), 11);
    expect(monthText()).toHaveTextContent('2025년 12월');

    await adjust('increment');
    expect(monthText()).toHaveTextContent('2026년 9월');
    expect(scrollTo).toHaveBeenLastCalledWith({
      x: 0,
      y: 8 * WHEEL_ROW,
      animated: true,
    });
  });

  // 열면 초점은 월 글자 버튼에 남는다. 거기서도 닫기 동작이 먹는다
  it('월 글자 버튼에 초점이 있어도 닫기 동작으로 닫고, 닫혀 있으면 닫기 동작을 받지 않는다', async () => {
    await renderHistory();
    expect(monthButton().props.onAccessibilityEscape).toBeUndefined();
    await userEvent.press(monthButton());

    await act(() => {
      fireEvent(monthButton(), 'accessibilityEscape');
    });

    expect(monthButton()).toBeCollapsed();
  });

  it('스크린리더 닫기 동작(두 손가락 문지르기)으로 적용하며 닫는다', async () => {
    await renderHistory();
    await userEvent.press(monthButton());
    await settleWheel(monthWheel(), 7);

    await act(() => {
      fireEvent(picker()!, 'accessibilityEscape');
    });

    expect(monthButton('2026년 8월')).toBeCollapsed();
  });
});
