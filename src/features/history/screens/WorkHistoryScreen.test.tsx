import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  NativeModules,
  Platform,
  StyleSheet,
} from 'react-native';
import { swipeFrom } from '../../../../jest/responder';
import {
  colors,
  pressedBackground,
  typography,
} from '../../../shared/design-system';
import { ENTER_OFFSET } from '../../../shared/gesture/enterTransition';
import { SWITCH_DISTANCE, type Rect } from '../../../shared/gesture/tabSwipe';
import * as tabSwipeArea from '../../../shared/gesture/TabSwipeArea';
import { expectPressedBackground } from '../../../shared/testing/pressFeedback';
import { iconSvgs } from '../../../shared/design-system/icons/svgs';
import { holdNativeAnimations } from '../../../../jest/nativeAnimation';
import { scrollListTo } from '../../../shared/testing/autoHideHeader';
import { isInsideScrollView } from '../../../shared/testing/scroll';
import { expectOnlySkeletons } from '../../../shared/testing/skeleton';
import type { HostElement } from '../../../shared/testing/touchTarget';
import { COLLAPSE_MS, collapseEasing } from '../headerCollapse';
import type { CompletedWork } from '../model';
import {
  WorkHistoryScreen,
  type WorkHistoryScreenProps,
} from './WorkHistoryScreen';

const today = new Date(2026, 8, 28); // 월요일

const base = {
  start: '08:00',
  end: '09:00',
  company: '한빛 설비',
  customerName: '정다은',
  address: '서울 용산구 이태원로 202',
};

const works: CompletedWork[] = [
  { ...base, id: 's1', dateKey: '2026-09-26', title: '세탁기 설치' },
  {
    ...base,
    id: 's2',
    dateKey: '2026-09-26',
    title: '에어컨 청소',
    start: '13:00',
    end: '14:00',
  },
  { ...base, id: 's3', dateKey: '2026-09-03', title: '보일러 점검' },
  { ...base, id: 'a1', dateKey: '2026-08-20', title: '도어록 교체' },
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

const rows = () => screen.getAllByRole('button', { name: /, 완료, / });
const rowTitles = () =>
  rows().map(row => row.props.accessibilityLabel.split(',')[0]);
const prevMonth = () => screen.getByRole('button', { name: '이전 달' });
const FAR = SWITCH_DISTANCE + 30;
/** 목록 영역(행)에서 시작해 민다. 탭 영역 밖이라 시작 자리와 상관없이 목록이 갖는다 */
const swipeRows = (
  options: Omit<Parameters<typeof swipeFrom>[1], 'from'>,
  element: HostElement = rows()[0],
) => swipeFrom(element, { from: { x: 200, y: 500 }, ...options });

/** 목록 영역을 밀어 달을 옮기는 뷰 (리스트를 감싼다) */
function monthSwipeArea(): HostElement {
  for (
    let node: HostElement | null = screen.getByTestId('work-history-list');
    node;
    node = node.parent
  ) {
    if (node.props.onTouchStartCapture && node.props.onMoveShouldSetResponder) {
      return node;
    }
  }
  throw new Error('목록 영역을 찾지 못했다');
}

/** 요소를 품은 목록 칸이 옮겨진 거리. 리스트에 닿기 전까지 transform 을 찾는다 */
function shiftOf(element: HostElement) {
  for (let node: HostElement | null = element; node; node = node.parent) {
    if (node.props.testID === 'work-history-list') {
      return { translateX: 0, opacity: undefined };
    }
    const style = StyleSheet.flatten(node.props.style);
    if (style && 'transform' in style && style.transform) {
      const [{ translateX }] = style.transform as [{ translateX: number }];
      return { translateX, opacity: style.opacity };
    }
  }
  return { translateX: 0, opacity: undefined };
}
const nextMonth = () => screen.getByRole('button', { name: '다음 달' });

describe('WorkHistoryScreen — 화면 구성', () => {
  it('제목, 오늘이 속한 달, 요약 카드(이번 달·누적 완료)를 보여준다', async () => {
    await renderHistory();

    expect(screen.getByRole('header', { name: '작업 이력' })).toBeOnTheScreen();
    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();
    expect(screen.getByText('4건')).toBeOnTheScreen();
    expect(screen.getByText('누적 완료')).toBeOnTheScreen();
    expect(screen.getByText('3건')).toBeOnTheScreen();
    expect(screen.getByText('이번 달 완료')).toBeOnTheScreen();
  });

  it('고른 달의 완료 작업을 최근 순으로 보여준다', async () => {
    await renderHistory();

    expect(rowTitles()).toEqual(['에어컨 청소', '세탁기 설치', '보일러 점검']);
  });

  it('행에 제목, 완료 칩, 날짜·시간, 발주사 | 고객 · 주소가 보인다', async () => {
    await renderHistory({ works: [works[0]] });

    expect(screen.getByText('세탁기 설치')).toBeOnTheScreen();
    expect(screen.getByText('완료')).toBeOnTheScreen();
    expect(screen.getByText('2026.09.26 (토) 08:00 - 09:00')).toBeOnTheScreen();
    expect(screen.getByText('한빛 설비')).toBeOnTheScreen();
    expect(
      screen.getByText('정다은 · 서울 용산구 이태원로 202'),
    ).toBeOnTheScreen();
  });
});

// 상단 바 접힘 (#175) 을 보는 도우미. 바는 리스트 위에 겹쳐 그리고, 접힘은 진행도 하나로 각 부분을 옮긴다
const list = () => screen.getByTestId('work-history-list');
const bar = () => screen.getByTestId('work-history-bar');
const hidden = { includeHiddenElements: true };
/** 접힌 동안 스크린리더에서 빠지는 부분도 찾는다 */
const part = (testID: string) => screen.getByTestId(testID, hidden);
const monthText = () => screen.getByText(/^\d{4}년 \d{1,2}월$/);
const arrowIcon = (name: string) =>
  screen.getByRole('button', { name, ...hidden }).children[0] as HostElement;
/** 스타일 (애니메이션 값은 지금 값으로 풀린다) */
const styleOf = (element: HostElement) =>
  StyleSheet.flatten(element.props.style);
/** transform 의 한 값 */
function transformOf(element: HostElement, key: string): number | undefined {
  const transform = styleOf(element).transform as
    | Record<string, number>[]
    | undefined;
  return transform?.find(item => key in item)?.[key];
}
const layout = (height: number, y = 0) => ({
  nativeEvent: { layout: { x: 0, y, width: 390, height } },
});
/** 스크롤 위치 값(네이티브 드라이버 이벤트가 옮기는 값)을 찾는다 */
function scrollValue(event: jest.SpyInstance) {
  return (
    event.mock.calls[0][0] as [
      { nativeEvent: { contentOffset: { y: Animated.Value } } },
    ]
  )[0].nativeEvent.contentOffset.y;
}
const COLLAPSE_TIMING = (toValue: number) => ({
  toValue,
  duration: COLLAPSE_MS,
  easing: collapseEasing,
  useNativeDriver: true,
});

// #175: Figma 작업이력 (기본) 3753:4890. 맨 위에서는 제목과 ◀ 월 ▶ 이 리스트 위에 겹쳐 그린 상단 바에 있다
describe('WorkHistoryScreen — 상단 바 (기본)', () => {
  it('제목은 리스트 밖 상단 바에 있고, 상태 표시줄 아래 8·왼쪽 24 의 Body/XL/SemiBold #000 이며 종이 없다', async () => {
    await renderHistory();

    const title = within(bar()).getByRole('header', { name: '작업 이력' });
    expect(isInsideScrollView(title)).toBe(false);
    expect(title).toHaveStyle({
      ...typography['Body/XL/SemiBold'],
      color: colors.black,
    });
    expect(title.parent?.parent).toHaveStyle({
      paddingTop: 8,
      paddingHorizontal: 24,
    });
    expect(screen.queryByRole('button', { name: '알림센터' })).toBeNull();
  });

  it('◀ 월 ▶ 도 리스트 밖 상단 바에 있고, 월 글자는 Body/M/SemiBold Gray800 이다', async () => {
    await renderHistory();

    expect(
      within(bar()).getByRole('button', { name: '이전 달' }),
    ).toBeOnTheScreen();
    expect(
      within(bar()).getByRole('button', { name: '다음 달' }),
    ).toBeOnTheScreen();
    expect(isInsideScrollView(monthText())).toBe(false);
    expect(monthText()).toHaveStyle({
      ...typography['Body/M/SemiBold'],
      color: colors.gray[800],
    });
  });

  it('바는 화면 배경과 같아 구분되지 않는다 (회색 배경·그림자는 아직 투명하다)', async () => {
    await renderHistory();

    expect(part('work-history-bar-background')).toHaveStyle({
      backgroundColor: colors.white[100],
    });
    expect(styleOf(part('work-history-bar-tint')).opacity).toBe(0);
  });

  it('요약 카드는 바 아래(108)에서 시작하는 리스트 내용이고, 바의 빈 곳 터치는 아래 리스트로 통과한다', async () => {
    await renderHistory();

    expect(
      StyleSheet.flatten(list().props.contentContainerStyle),
    ).toMatchObject({ paddingTop: 108 });
    expect(isInsideScrollView(screen.getByLabelText('누적 완료 4건'))).toBe(
      true,
    );
    expect(bar()).toHaveStyle({ pointerEvents: 'box-none' });
  });

  it('큰 글자로 바가 높아지면 잰 높이로 내용 위 여백을 고친다 (1 보다 적게 다르면 그대로)', async () => {
    await renderHistory();

    await fireEvent(bar(), 'layout', layout(108.4));
    expect(
      StyleSheet.flatten(list().props.contentContainerStyle),
    ).toMatchObject({ paddingTop: 108 });

    await fireEvent(bar(), 'layout', layout(150));
    expect(
      StyleSheet.flatten(list().props.contentContainerStyle),
    ).toMatchObject({ paddingTop: 150 });
  });

  // Animated.View 는 배열·객체 props 를 참조로 비교해 바뀌면 네이티브 애니메이션 연결을 새로 만든다.
  // 화면이 다시 그려져도(같은 달) 바의 연결은 그대로 둔다
  it('화면이 다시 그려져도 상단 바의 애니메이션 연결을 다시 만들지 않는다', async () => {
    const view = await renderHistory();
    const connect = jest
      .spyOn(NativeModules.NativeAnimatedModule, 'connectAnimatedNodeToView')
      .mockClear();

    await view.rerender(
      <WorkHistoryScreen
        today={today}
        works={works}
        onOpenWork={jest.fn()}
        refreshing
      />,
    );

    expect(connect).not.toHaveBeenCalled();
    connect.mockRestore();
  });

  it('스크롤 위치는 네이티브 드라이버 이벤트로 받고, 스크롤 표시줄은 접힌 바(68) 아래에서 시작한다', async () => {
    const event = jest.spyOn(Animated, 'event');
    await renderHistory();

    expect(event).toHaveBeenCalledWith(
      [{ nativeEvent: { contentOffset: { y: expect.any(Animated.Value) } } }],
      expect.objectContaining({ useNativeDriver: true }),
    );
    expect(list()).toHaveProp('scrollEventThrottle', 16);
    expect(list()).toHaveProp('scrollIndicatorInsets', { top: 68 });
    event.mockRestore();
  });
});

// #175: Figma 작업이력 (스크롤) 50833:6839. 스크롤하면 제목이 짧은 페이드로 사라지고 월 선택이 바로 바에 흡수된다.
// 스크롤 양에 따라 중간에 멈추지 않는다: 시작한 전환은 UI 스레드에서 끝까지 간다
describe('WorkHistoryScreen — 스크롤하면 상단 바가 접힌다', () => {
  let finishAnimations: () => Promise<void>;
  beforeEach(() => {
    finishAnimations = holdNativeAnimations().finish;
  });
  afterEach(() => {
    jest.restoreAllMocks();
    // 공유 목이라 restoreAllMocks 로 돌아가지 않는다. 다른 테스트로 새지 않게 꺼진 것으로 되돌린다
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockImplementation(() => Promise.resolve(false));
  });

  it('12 까지는 그대로이고, 넘게 내리면 260ms 감속 곡선의 UI 스레드 전환 하나로 접는다', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await renderHistory();

    for (const y of [0, 6, 12]) {
      await scrollListTo(list(), y);
    }
    expect(timing).not.toHaveBeenCalled();

    await scrollListTo(list(), 13);
    await scrollListTo(list(), 200);
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][1]).toEqual(COLLAPSE_TIMING(1));
  });

  it('접히면 제목이 없고, 바는 높이 68·회색(Background/3)·그림자, 월 글자는 18 로 줄어 가운데에 오고 화살표는 없다', async () => {
    await renderHistory();

    await scrollListTo(list(), 300);
    await finishAnimations();

    const title = part('work-history-title');
    expect(styleOf(title).opacity).toBe(0);
    expect(transformOf(title, 'translateY')).toBe(-6);
    // 바 배경은 펼친 바(108)의 아래 끝에서 40 올라가 68 에서 끝난다
    const background = part('work-history-bar-background');
    expect(background).toHaveStyle({ bottom: 0 });
    expect(transformOf(background, 'translateY')).toBe(-40);
    expect(part('work-history-bar-tint')).toHaveStyle({
      backgroundColor: colors.background[3],
      boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.04)',
      opacity: 1,
    });
    // 월 줄 가운데(70)가 접힌 월 글자 가운데(31.6)로 올라가고, 글자는 20 → 18
    expect(transformOf(part('work-history-month'), 'translateY')).toBeCloseTo(
      -38.4,
      5,
    );
    expect(transformOf(monthText().parent as HostElement, 'scale')).toBe(0.9);
    // 화살표는 월 글자 쪽으로 8 들어가며 반으로 줄어 사라진다
    for (const [name, inward] of [
      ['이전 달', 8],
      ['다음 달', -8],
    ] as const) {
      expect(styleOf(arrowIcon(name)).opacity).toBe(0);
      expect(transformOf(arrowIcon(name), 'scale')).toBe(0.5);
      expect(transformOf(arrowIcon(name), 'translateX')).toBe(inward);
    }
  });

  it('접힌 채 중간까지 올리면 그대로이고, 맨 위(0)에 닿으면 같은 시간·곡선으로 펼친다', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await renderHistory();
    await scrollListTo(list(), 300);
    await finishAnimations();

    await scrollListTo(list(), 100);
    await scrollListTo(list(), 1);
    expect(timing).toHaveBeenCalledTimes(1);

    await scrollListTo(list(), 0);
    expect(timing).toHaveBeenCalledTimes(2);
    expect(timing.mock.calls[1][1]).toEqual(COLLAPSE_TIMING(0));

    await finishAnimations();
    expect(styleOf(part('work-history-title')).opacity).toBe(1);
    expect(styleOf(part('work-history-bar-tint')).opacity).toBe(0);
    expect(
      transformOf(part('work-history-bar-background'), 'translateY'),
    ).toBeCloseTo(0, 5);
    expect(transformOf(part('work-history-month'), 'translateY')).toBeCloseTo(
      0,
      5,
    );
    expect(transformOf(monthText().parent as HostElement, 'scale')).toBe(1);
    expect(styleOf(arrowIcon('이전 달')).opacity).toBe(1);
  });

  it('전환 중에 반대 조건이 되면 지금 전환을 끝까지 마친 뒤 반대로 돌아간다', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await renderHistory();

    await scrollListTo(list(), 300);
    await scrollListTo(list(), 0);
    expect(timing).toHaveBeenCalledTimes(1);

    await finishAnimations();
    expect(timing).toHaveBeenCalledTimes(2);
    expect(timing.mock.calls[1][1]).toEqual(COLLAPSE_TIMING(0));

    await finishAnimations();
    expect(styleOf(part('work-history-title')).opacity).toBe(1);
  });

  it('전환이 끝나기 전에 원래 조건으로 돌아오면 반대로 돌아가지 않는다', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await renderHistory();

    await scrollListTo(list(), 300);
    await scrollListTo(list(), 0);
    await scrollListTo(list(), 300);
    await finishAnimations();

    expect(timing).toHaveBeenCalledTimes(1);
    expect(styleOf(part('work-history-title')).opacity).toBe(0);
  });

  it('동작 줄이기면 애니메이션 없이 바로 접고 바로 펼친다', async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    await renderHistory();
    await act(async () => {});

    await scrollListTo(list(), 300);
    expect(styleOf(part('work-history-title')).opacity).toBe(0);
    expect(styleOf(part('work-history-bar-tint')).opacity).toBe(1);

    await scrollListTo(list(), 0);
    expect(styleOf(part('work-history-title')).opacity).toBe(1);
    expect(styleOf(part('work-history-bar-tint')).opacity).toBe(0);
    expect(timing).not.toHaveBeenCalled();
  });

  // 내용이 줄면 스크롤 이벤트 없이 맨 위로 돌아갈 수 있다 (달을 바꿔 행이 적은 달·빈 달이 됨)
  // 회전·창 크기 변경으로 리스트가 커져 내용이 거의 다 들어오면 스크롤 이벤트가 오지 않을 수 있다
  it('접힌 동안 리스트가 커져 기준값 넘게 스크롤할 수 없게 되면 펼친다', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await renderHistory();
    await scrollListTo(list(), 300);
    await finishAnimations();

    // 내용 2000 에 리스트 1000: 아직 접힌 채다
    await fireEvent(list(), 'layout', layout(1000));
    expect(timing).toHaveBeenCalledTimes(1);

    // 리스트 1995: 5 만큼만 스크롤할 수 있다
    await fireEvent(list(), 'layout', layout(1995));
    expect(timing).toHaveBeenCalledTimes(2);
    expect(timing.mock.calls[1][1]).toEqual(COLLAPSE_TIMING(0));
  });

  it('접힌 동안 내용이 짧아져 기준값 넘게 스크롤할 수 없게 되면 펼친다', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await renderHistory();
    await scrollListTo(list(), 300);
    await finishAnimations();

    // 스크롤 뷰 600 에 내용 1500: 아직 접힌 채다
    await fireEvent(list(), 'contentSizeChange', 390, 1500);
    expect(timing).toHaveBeenCalledTimes(1);

    // 내용 610: 10 만큼만 스크롤할 수 있다
    await fireEvent(list(), 'contentSizeChange', 390, 610);
    expect(timing).toHaveBeenCalledTimes(2);
    expect(timing.mock.calls[1][1]).toEqual(COLLAPSE_TIMING(0));
  });

  // 큰 글자에서는 펼친 바와 월 줄이 높아진다. 접힌 바(68)와 접힌 월 글자 가운데(31.6)는 그대로다
  it('잰 바 높이·월 줄 위치로 접히는 거리를 정한다', async () => {
    await renderHistory();
    await fireEvent(bar(), 'layout', layout(150));
    await fireEvent(part('work-history-month'), 'layout', layout(40, 70));

    await scrollListTo(list(), 300);
    await finishAnimations();

    expect(transformOf(part('work-history-bar-background'), 'translateY')).toBe(
      -82,
    );
    expect(transformOf(part('work-history-month'), 'translateY')).toBeCloseTo(
      -58.4,
      5,
    );
  });

  it('화면을 닫으면 돌던 전환을 멈춘다', async () => {
    const stop = jest.spyOn(Animated.Value.prototype, 'stopAnimation');
    const view = await renderHistory();
    await scrollListTo(list(), 300);

    await view.unmount();

    expect(stop).toHaveBeenCalled();
  });
});

describe('WorkHistoryScreen — 접힌 상단 바의 접근성 (#175)', () => {
  let finishAnimations: () => Promise<void>;
  beforeEach(() => {
    finishAnimations = holdNativeAnimations().finish;
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('접힌 동안 화살표는 접근성 트리에서 빠지고 눌리지 않으며, 월 글자는 그대로 읽는다', async () => {
    const onMonthChange = jest.fn();
    await renderHistory({ onMonthChange });

    await scrollListTo(list(), 300);

    expect(screen.queryByRole('button', { name: '이전 달' })).toBeNull();
    expect(screen.queryByRole('button', { name: '다음 달' })).toBeNull();
    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();
    // 보이지 않는 제목도 읽지 않는다
    expect(screen.queryByRole('header', { name: '작업 이력' })).toBeNull();

    await userEvent.press(
      screen.getByRole('button', { name: '이전 달', ...hidden }),
    );
    expect(onMonthChange).not.toHaveBeenCalled();
    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();
  });

  it('맨 위로 돌아와 펼치면 제목·화살표를 다시 읽고 누를 수 있다', async () => {
    await renderHistory();
    await scrollListTo(list(), 300);
    await finishAnimations();

    await scrollListTo(list(), 0);
    await finishAnimations();

    expect(screen.getByRole('header', { name: '작업 이력' })).toBeOnTheScreen();
    await userEvent.press(prevMonth());
    expect(screen.getByText('2026년 8월')).toBeOnTheScreen();
  });
});

describe('WorkHistoryScreen — 당겨서 새로고침 (#175)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Android 는 새로고침 표시를 펼친 바 아래(108)에서 내린다 (당길 수 있는 맨 위는 늘 펼친 상태다)', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await renderHistory({ onRefresh: jest.fn() });

    expect(list()).toHaveProp('progressViewOffset', 108);
  });

  // iOS 는 표시를 리스트 맨 위에 그린다. 바가 당긴 만큼 함께 내려와 그 위에 드러난 자리에 표시가 보인다
  it('iOS 는 표시를 옮기지 않고, 맨 위에서 당긴 만큼 바가 함께 내려온다', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const event = jest.spyOn(Animated, 'event');
    const view = await renderHistory({ onRefresh: jest.fn() });
    expect(list().props.progressViewOffset).toBeUndefined();

    await act(() => scrollValue(event).setValue(-60));
    await view.rerender(
      <WorkHistoryScreen
        today={today}
        works={works}
        onOpenWork={jest.fn()}
        onRefresh={jest.fn()}
      />,
    );
    expect(transformOf(bar(), 'translateY')).toBe(60);

    await act(() => scrollValue(event).setValue(200));
    await view.rerender(
      <WorkHistoryScreen today={today} works={works} onOpenWork={jest.fn()} />,
    );
    expect(transformOf(bar(), 'translateY')).toBe(0);
  });
});

// #175: 바(제목·월)에서 시작한 밀기는 탭 전환(#140), 목록 안쪽은 월 이동(#153). 펼침·접힘 모두
describe('WorkHistoryScreen — 바와 목록의 밀기 판정 (#175)', () => {
  let finishAnimations: () => Promise<void>;
  beforeEach(() => {
    finishAnimations = holdNativeAnimations().finish;
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['펼친 바', false],
    ['접힌 바', true],
  ])(
    '%s 의 월 글자에서 민 것은 탭을 바꾸고 달은 그대로, 목록 안쪽에서 민 것은 달을 옮긴다',
    async (_state, collapse) => {
      const onTabSwipe = jest.fn();
      await render(
        <tabSwipeArea.TabSwipeArea canSwipe={() => true} onSwipe={onTabSwipe}>
          <WorkHistoryScreen
            today={today}
            works={works}
            onOpenWork={jest.fn()}
          />
        </tabSwipeArea.TabSwipeArea>,
      );
      if (collapse) {
        await scrollListTo(list(), 300);
        await finishAnimations();
      }

      await swipeFrom(monthText(), { from: { x: 200, y: 80 }, dx: FAR });
      expect(onTabSwipe).toHaveBeenCalledWith('prev');
      expect(screen.getByText('2026년 9월')).toBeOnTheScreen();

      onTabSwipe.mockClear();
      await swipeRows({ dx: FAR });
      expect(screen.getByText('2026년 8월')).toBeOnTheScreen();
      expect(onTabSwipe).not.toHaveBeenCalled();
    },
  );

  // 바 뷰는 펼친 크기(108) 그대로이고 그리는 것만 68 로 줄인다. 그 사이(68~108)는 접힌 동안 리스트가 보이는 자리다
  it('접힌 동안은 접힌 바(68) 아래부터 목록 영역이다 — 펼친 바 자리였던 곳에서 민 것은 펼침이면 탭, 접힘이면 달', async () => {
    const width = Dimensions.get('window').width;
    // 화면 위 자리: 리스트 0~700 위에 바(0~108)가 겹치고, 요약 카드는 스크롤로 올라가 보이지 않는다
    const covers: Record<string, Rect> = {
      'work-history-bar': { x: 0, y: 0, width, height: 108 },
      'work-history-list-header': { x: 0, y: -300, width, height: 120 },
    };
    // 테스트 렌더러에는 화면 위 사각형이 없다. 목록 영역을 잴 때 쓰는 공용 함수가 덮개(testID)의 자리를 돌려주게 한다
    const measure = tabSwipeArea.measureElement;
    jest
      .spyOn(tabSwipeArea, 'measureElement')
      .mockImplementation(
        target =>
          covers[
            (target as { props?: { testID?: string } } | null)?.props?.testID ??
              ''
          ] ?? measure(target),
      );
    const onTabSwipe = jest.fn();
    await render(
      <tabSwipeArea.TabSwipeArea canSwipe={() => true} onSwipe={onTabSwipe}>
        <WorkHistoryScreen today={today} works={works} onOpenWork={jest.fn()} />
      </tabSwipeArea.TabSwipeArea>,
    );
    const rects = new Map([
      [monthSwipeArea(), { x: 0, y: 0, width, height: 700 }],
    ]);
    // 접힌 바 아래 끝(68)에서 가장자리 여유(12)보다 안쪽, 펼친 바 아래 끝(108)보다는 위
    const swipeBelowCollapsedBar = () =>
      swipeFrom(rows()[0], { from: { x: width / 2, y: 95 }, dx: FAR, rects });

    await swipeBelowCollapsedBar();
    expect(onTabSwipe).toHaveBeenCalledWith('prev');
    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();

    onTabSwipe.mockClear();
    await scrollListTo(list(), 300);
    await finishAnimations();
    await swipeBelowCollapsedBar();
    expect(onTabSwipe).not.toHaveBeenCalled();
    expect(screen.getByText('2026년 8월')).toBeOnTheScreen();
  });
});

// #175: 내용 위 여백은 상태와 상관없이 펼친 바 높이다. 접힌 바는 더 짧아 그보다 더 가리지 않는다
describe('WorkHistoryScreen — 두 상태의 불러오기·빈 상태 (#175)', () => {
  let finishAnimations: () => Promise<void>;
  beforeEach(() => {
    finishAnimations = holdNativeAnimations().finish;
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['펼침', false],
    ['접힘', true],
  ])(
    '%s: 스켈레톤·빈 상태가 바 아래에서 시작한다',
    async (_state, collapse) => {
      const view = await renderHistory({
        works: [],
        load: { status: 'loading' },
      });
      if (collapse) {
        await scrollListTo(list(), 300);
        await finishAnimations();
      }
      expectOnlySkeletons('work-rows-skeleton');
      expect(
        StyleSheet.flatten(list().props.contentContainerStyle),
      ).toMatchObject({ paddingTop: 108 });

      await view.rerender(
        <WorkHistoryScreen today={today} works={[]} onOpenWork={jest.fn()} />,
      );
      expect(
        screen.getByText('이 달에 완료한 작업이 없어요'),
      ).toBeOnTheScreen();
      expect(
        StyleSheet.flatten(list().props.contentContainerStyle),
      ).toMatchObject({ paddingTop: 108 });
    },
  );
});

describe('WorkHistoryScreen — 월 이동', () => {
  it('◀ 를 누르면 이전 달로 바뀌고 목록과 이번 달 완료 숫자가 그 달 기준이 된다', async () => {
    await renderHistory();

    await userEvent.press(prevMonth());

    expect(screen.getByText('2026년 8월')).toBeOnTheScreen();
    expect(rowTitles()).toEqual(['도어록 교체']);
    expect(screen.getByLabelText('이번 달 완료 1건')).toBeOnTheScreen();
    // 누적은 달과 상관없다
    expect(screen.getByLabelText('누적 완료 4건')).toBeOnTheScreen();
  });

  it('이번 달에서는 ▶ 가 비활성이고, 지난달에서는 ▶ 로 다음 달에 간다', async () => {
    await renderHistory();
    expect(nextMonth()).toBeDisabled();

    await userEvent.press(prevMonth());
    expect(nextMonth()).toBeEnabled();

    await userEvent.press(nextMonth());
    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();
    expect(nextMonth()).toBeDisabled();
  });

  it('12월에서 ▶ 를 누르면 다음 해 1월이 된다', async () => {
    await renderHistory({
      today: new Date(2027, 0, 10),
      works: [
        { ...base, id: 'd1', dateKey: '2026-12-31', title: '수전 교체' },
        { ...base, id: 'j1', dateKey: '2027-01-02', title: '에어컨 청소' },
      ],
    });

    await userEvent.press(prevMonth());
    expect(screen.getByText('2026년 12월')).toBeOnTheScreen();
    expect(rowTitles()).toEqual(['수전 교체']);

    await userEvent.press(nextMonth());
    expect(screen.getByText('2027년 1월')).toBeOnTheScreen();
    expect(rowTitles()).toEqual(['에어컨 청소']);
  });

  it('고른 달에 완료 작업이 없으면 빈 상태를 보여준다', async () => {
    await renderHistory();
    expect(
      screen.queryByText('이 달에 완료한 작업이 없어요'),
    ).not.toBeOnTheScreen();

    await userEvent.press(prevMonth());
    await userEvent.press(prevMonth());

    expect(screen.getByText('2026년 7월')).toBeOnTheScreen();
    expect(screen.getByText('이 달에 완료한 작업이 없어요')).toBeOnTheScreen();
    expect(screen.getByLabelText('이번 달 완료 0건')).toBeOnTheScreen();
  });

  it('빈 상태 아이콘은 화살표 없는 채운 시계(Gray300, 40)다', async () => {
    await renderHistory({ works: [] });

    const icon = screen.getByTestId('history-empty-icon', {
      includeHiddenElements: true,
    });
    expect(icon).toHaveStyle({ width: 40, height: 40 });
    const [svg] = icon.children;
    if (typeof svg === 'string') {
      throw new Error('SVG 뷰가 없습니다');
    }
    expect(svg.props.xml).toBe(iconSvgs['history-empty'].xml);
    expect(svg.props.xml).not.toContain('M5 2.667V6.167H8.5');
    expect(svg.props.color).toBe(colors.gray[300]);
  });
});

describe('WorkHistoryScreen — 좌우로 밀어 월 이동 (#153)', () => {
  it('목록을 오른쪽으로 밀면 이전 달, 왼쪽으로 밀면 다음 달로 간다', async () => {
    const onMonthChange = jest.fn();
    await renderHistory({ onMonthChange });

    await swipeRows({ dx: FAR });
    expect(screen.getByText('2026년 8월')).toBeOnTheScreen();
    expect(rowTitles()).toEqual(['도어록 교체']);

    await swipeRows({ dx: -FAR });
    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();
    expect(onMonthChange.mock.calls).toEqual([
      [{ year: 2026, month: 7 }],
      [{ year: 2026, month: 8 }],
    ]);
  });

  it('이번 달에서 왼쪽으로 밀면 그대로다 (▶ 처럼 미래 달로 가지 않는다)', async () => {
    const onMonthChange = jest.fn();
    await renderHistory({ onMonthChange });

    await swipeRows({ dx: -FAR });

    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();
    expect(onMonthChange).not.toHaveBeenCalled();
  });

  it('완료 작업이 없는 달도 목록 자리(빈 상태)를 밀어 옮긴다', async () => {
    await renderHistory();
    await swipeRows({ dx: FAR });
    await swipeRows({ dx: FAR });
    const empty = screen.getByText('이 달에 완료한 작업이 없어요');
    expect(screen.getByText('2026년 7월')).toBeOnTheScreen();

    await swipeRows({ dx: -FAR }, empty);

    expect(screen.getByText('2026년 8월')).toBeOnTheScreen();
  });

  it('세로 우세로 움직이면(목록 스크롤) 달은 그대로다', async () => {
    await renderHistory();

    // 목록 영역(월 넘김)이 응답자를 잡지 않아 리스트가 그대로 스크롤한다
    const monthArea = monthSwipeArea();
    expect(await swipeRows({ dx: FAR, dy: 160 })).not.toBe(monthArea.props);
    await swipeRows({
      path: [
        { x: 0, y: 0 },
        { x: 0, y: 30 },
        { x: FAR, y: 40 },
      ],
    });

    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();
  });

  it('짧게 밀거나 두 손가락이면 아무 일도 없다', async () => {
    const onOpenWork = jest.fn();
    await renderHistory({ onOpenWork });

    await swipeRows({ dx: SWITCH_DISTANCE - 10 });
    // 가로로 정해진 짧은 밀기는 목록이 응답자를 잡아 행 누르기가 되지 않는다
    expect(onOpenWork).not.toHaveBeenCalled();
    await swipeRows({ dx: FAR, fingers: 2 });

    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();
  });

  it('그 달을 불러오는 중에도 목록 자리를 밀어 옮긴다', async () => {
    const onMonthChange = jest.fn();
    await renderHistory({ load: { status: 'loading' }, onMonthChange });

    await swipeRows({ dx: FAR }, screen.getByTestId('work-history-list'));

    expect(onMonthChange).toHaveBeenCalledWith({ year: 2026, month: 7 });
  });

  it('밀면 행이 눌리지 않고, 행을 누르면 지금처럼 그 작업 상세를 연다', async () => {
    const onOpenWork = jest.fn();
    await renderHistory({ onOpenWork });

    await swipeRows({ dx: FAR });
    expect(onOpenWork).not.toHaveBeenCalled();

    await userEvent.press(rows()[0]);
    expect(onOpenWork).toHaveBeenCalledWith('a1');
  });
});

describe('WorkHistoryScreen — 월 전환 애니메이션 (#153)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    // 공유 목이라 restoreAllMocks 로 돌아가지 않는다. 다른 테스트로 새지 않게 꺼진 것으로 되돌린다
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockImplementation(() => Promise.resolve(false));
  });

  it('이전 달은 -x 에서, 다음 달은 +x 에서 0 으로 들어오고 투명도는 그대로다 (밀기·화살표 모두)', async () => {
    await renderHistory();
    const animations = holdNativeAnimations();

    await swipeRows({ dx: FAR });
    expect(shiftOf(rows()[0])).toEqual({
      translateX: -ENTER_OFFSET,
      opacity: undefined,
    });
    await animations.finish();
    expect(shiftOf(rows()[0]).translateX).toBe(0);

    await userEvent.press(nextMonth());
    expect(shiftOf(rows()[0]).translateX).toBe(ENTER_OFFSET);
    await animations.finish();
    expect(shiftOf(rows()[0]).translateX).toBe(0);

    // 빈 상태도 같은 결로 들어온다
    await userEvent.press(prevMonth());
    await animations.finish();
    await userEvent.press(prevMonth());
    expect(
      shiftOf(screen.getByText('이 달에 완료한 작업이 없어요')).translateX,
    ).toBe(-ENTER_OFFSET);
  });

  it('상단 바(월 선택)·머리(요약 카드)는 달을 바꿔도 옮기지 않는다', async () => {
    await renderHistory();
    holdNativeAnimations();

    await swipeRows({ dx: FAR });

    expect(shiftOf(screen.getByLabelText('누적 완료 4건')).translateX).toBe(0);
    // 월 선택은 리스트 밖 상단 바에 있어 목록 칸과 함께 옮겨지지 않는다 (#175)
    expect(isInsideScrollView(screen.getByText('2026년 8월'))).toBe(false);
  });

  it('동작 줄이기면 옮기지 않고 바로 바꾼다', async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(true);
    await renderHistory();
    await act(async () => {});
    holdNativeAnimations();

    await swipeRows({ dx: FAR });

    expect(screen.getByText('2026년 8월')).toBeOnTheScreen();
    expect(shiftOf(rows()[0]).translateX).toBe(0);
  });
});

describe('WorkHistoryScreen — 상세 열기', () => {
  it('행을 누르면 그 작업 id 로 onOpenWork 를 부른다', async () => {
    const onOpenWork = jest.fn();
    await renderHistory({ onOpenWork });

    await userEvent.press(rows()[1]);

    expect(onOpenWork).toHaveBeenCalledWith('s1');
  });
});

// #102: 누르는 동안 회색 배경
describe('WorkHistoryScreen — 눌림', () => {
  it('완료 작업 행을 누르고 있는 동안 배경이 Gray50 이 되고 떼면 돌아온다', async () => {
    await renderHistory();

    await expectPressedBackground(rows()[0], pressedBackground.onWhite);
  });
});

describe('WorkHistoryScreen — 스크린리더', () => {
  it('행은 버튼 하나로 제목, 완료, 날짜·시간, 발주사, 고객, 주소를 읽는다', async () => {
    await renderHistory({ works: [works[0]] });

    expect(
      screen.getByRole('button', {
        name: '세탁기 설치, 완료, 2026년 9월 26일 토요일 오전 8시부터 9시, 한빛 설비, 정다은, 서울 용산구 이태원로 202',
      }),
    ).toBeOnTheScreen();
  });

  it('월 화살표는 "이전 달", "다음 달" 버튼이다', async () => {
    await renderHistory();

    expect(prevMonth()).toBeOnTheScreen();
    expect(nextMonth()).toBeOnTheScreen();
  });

  // 포커스는 누른 화살표에 남아 바뀐 제목을 읽지 않는다
  it('달을 바꾸면 바뀐 달과 그 달 완료 건수를 알려 준다', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    await renderHistory();

    await userEvent.press(prevMonth());
    expect(announce).toHaveBeenLastCalledWith('2026년 8월, 완료 1건');

    await userEvent.press(prevMonth());
    expect(announce).toHaveBeenLastCalledWith('2026년 7월, 완료 0건');

    await userEvent.press(nextMonth());
    expect(announce).toHaveBeenLastCalledWith('2026년 8월, 완료 1건');
    announce.mockRestore();
  });

  it('요약 카드는 카드 하나로 "누적 완료 4건" 처럼 읽는다', async () => {
    await renderHistory();

    for (const label of ['누적 완료 4건', '이번 달 완료 3건']) {
      const card = screen.getByLabelText(label);
      expect(card).toHaveProp('accessible', true);
    }
  });
});

// Figma 작업이력 (기본) 2751:6982 의 패널 값
describe('WorkHistoryScreen — Figma 값', () => {
  const parentOf = (element: HostElement) => element.parent as HostElement;

  // 새 Figma 작업이력 (기본) 3753:4890: 제목 아래 14 에 월 줄(높이 28), 그 아래 24 에 요약 카드 (#175)
  it('제목과 월 선택 사이 14, 월 제목과 화살표 사이 6, 월 선택과 요약 카드 사이 24', async () => {
    await renderHistory();

    const monthRow = parentOf(prevMonth());
    expect(monthRow).toHaveStyle({ gap: 6, marginTop: 14 });
    expect(bar()).toHaveStyle({ paddingBottom: 24 });
  });

  // 요약 카드는 새 Figma 작업이력 (기본) 3753:4890 › 3753:4903 기준이다 (#145)
  it('요약 카드는 모서리 16, 카드 사이 10, 누적 완료 설명은 Gray600', async () => {
    await renderHistory();

    const card = screen.getByLabelText('누적 완료 4건');
    expect(card).toHaveStyle({ borderRadius: 16 });
    expect(parentOf(card)).toHaveStyle({ gap: 10 });
    expect(screen.getByText('누적 완료')).toHaveStyle({
      color: colors.gray[600],
    });
  });

  it('요약 카드는 이번 달 완료(Primary 강조)가 왼쪽, 누적 완료가 오른쪽이다', async () => {
    await renderHistory();

    const month = screen.getByLabelText('이번 달 완료 3건');
    const total = screen.getByLabelText('누적 완료 4건');
    expect(parentOf(month)).toBe(parentOf(total));
    expect(parentOf(month).children).toEqual([month, total]);
    expect(month).toHaveStyle({ backgroundColor: colors.primary });
    expect(total).not.toHaveStyle({ backgroundColor: colors.primary });
  });

  it('스크린리더도 이번 달 완료 → 누적 완료 순서로 읽는다', async () => {
    await renderHistory();

    expect(
      screen
        .getAllByLabelText(/^(이번 달 완료|누적 완료) /)
        .map(card => card.props.accessibilityLabel),
    ).toEqual(['이번 달 완료 3건', '누적 완료 4건']);
  });

  // 카드를 다시 그리면 그 View 의 props 객체가 새로 만들어진다. 같은 객체면 memo 로 건너뛴 것이다
  // (props 를 toBe 로 비교하면 실패할 때 자식 요소까지 diff 를 찍다 메모리가 넘쳐 참·거짓으로 본다)
  it('달을 바꿔도 누적 완료 카드는 다시 그리지 않는다', async () => {
    await renderHistory();
    const before = screen.getByLabelText('누적 완료 4건').props;

    await userEvent.press(prevMonth());

    expect(screen.getByLabelText('이번 달 완료 1건')).toBeOnTheScreen();
    const sameProps = screen.getByLabelText('누적 완료 4건').props === before;
    expect(sameProps).toBe(true);
  });

  it('행은 줄 사이 10, 아래 구분선 Gray200, 제목 Body/M/SemiBold', async () => {
    await renderHistory({ works: [works[0]] });

    expect(rows()[0]).toHaveStyle({
      gap: 10,
      borderBottomColor: colors.gray[200],
    });
    expect(screen.getByText('세탁기 설치')).toHaveStyle({
      ...typography['Body/M/SemiBold'],
      color: colors.gray[900],
    });
  });

  it('날짜 줄은 달력 아이콘 24 와 글자 사이 5', async () => {
    await renderHistory({ works: [works[0]] });

    const timeRow = parentOf(screen.getByText('2026.09.26 (토) 08:00 - 09:00'));
    expect(timeRow).toHaveStyle({ gap: 5 });
    expect(timeRow.children[0] as HostElement).toHaveStyle({
      width: 24,
      height: 24,
    });
  });

  it('발주사 줄은 사이 8, 구분선 Gray400, 고객 · 주소는 Caption/M/Medium Gray600', async () => {
    await renderHistory({ works: [works[0]] });

    const metaRow = parentOf(screen.getByText('한빛 설비'));
    expect(metaRow).toHaveStyle({ gap: 8 });
    expect(metaRow.children[1] as HostElement).toHaveStyle({
      width: 1,
      height: 12,
      backgroundColor: colors.gray[400],
    });
    expect(screen.getByText('정다은 · 서울 용산구 이태원로 202')).toHaveStyle({
      ...typography['Caption/M/Medium'],
      color: colors.gray[600],
    });
  });
});

// 서버에서 달마다 불러온다 (#114)
describe('WorkHistoryScreen — 불러오기', () => {
  it('누적 완료는 주어진 수를 보인다 (서버가 달마다 주므로 목록 길이와 다르다)', async () => {
    await renderHistory({ totalCompleted: 42 });

    expect(screen.getByLabelText('누적 완료 42건')).toBeOnTheScreen();
  });

  it('누적 완료를 모르면(서버가 주지 않음·처음 불러오는 중) "-" 로 보인다', async () => {
    await renderHistory({ totalCompleted: null });

    expect(screen.getByLabelText('누적 완료, 알 수 없음')).toBeOnTheScreen();
    expect(screen.getByText('-')).toBeOnTheScreen();
  });

  it('처음 불러오는 동안 두 요약 카드의 숫자 자리는 스켈레톤이고, 카드는 "불러오는 중" 으로 읽는다', async () => {
    await renderHistory({
      works: [],
      totalCompleted: null,
      load: { status: 'loading' },
    });

    expect(screen.getByLabelText('누적 완료, 불러오는 중')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('이번 달 완료, 불러오는 중'),
    ).toBeOnTheScreen();
    // 숫자 자리 스켈레톤은 카드가 읽으므로 스크린리더에서 숨는다
    expect(
      screen.getAllByTestId('summary-count-skeleton', {
        includeHiddenElements: true,
      }),
    ).toHaveLength(2);
    expect(screen.queryByText('-')).not.toBeOnTheScreen();
    // 이번 달 완료(왼쪽)는 Primary 카드라 막대를 흰색 토큰으로 옅게, 누적 완료는 회색이다
    const [month, total] = screen.getAllByTestId('summary-count-line-bar', {
      includeHiddenElements: true,
    });
    expect(month).toHaveStyle({ backgroundColor: colors.white[9] });
    expect(total).toHaveStyle({ backgroundColor: colors.gray[100] });
  });

  it('달을 바꿔 그 달을 불러오는 동안 누적 완료는 그대로이고 이번 달 완료만 스켈레톤이다', async () => {
    await renderHistory({
      works: [],
      totalCompleted: 42,
      load: { status: 'loading' },
    });

    expect(screen.getByLabelText('누적 완료 42건')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('이번 달 완료, 불러오는 중'),
    ).toBeOnTheScreen();
    expect(
      screen.getAllByTestId('summary-count-skeleton', {
        includeHiddenElements: true,
      }),
    ).toHaveLength(1);
  });

  it('불러오는 동안 목록 자리에 완료 작업 행을 닮은 스켈레톤을 보인다 (빈 상태·스피너 대신)', async () => {
    await renderHistory({ works: [], load: { status: 'loading' } });

    expectOnlySkeletons('work-rows-skeleton');
    expect(
      screen.queryByText('이 달에 완료한 작업이 없어요'),
    ).not.toBeOnTheScreen();
  });

  it('불러오지 못하면 이번 달 완료는 스켈레톤 대신 "-" 다', async () => {
    await renderHistory({
      works: [],
      load: { status: 'error', message: '네트워크 문구', onRetry: jest.fn() },
    });

    expect(screen.getByLabelText('이번 달 완료, 알 수 없음')).toBeOnTheScreen();
    expect(
      screen.queryByTestId('summary-count-skeleton'),
    ).not.toBeOnTheScreen();
  });

  it('불러오지 못하면 문구와 다시 시도를 보인다', async () => {
    const onRetry = jest.fn();
    await renderHistory({
      works: [],
      load: { status: 'error', message: '네트워크 문구', onRetry },
    });

    await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

    expect(screen.getByText('네트워크 문구')).toBeOnTheScreen();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('달을 바꾸면 그 달을 알린다 (그 달의 이력을 불러온다)', async () => {
    const onMonthChange = jest.fn();
    await renderHistory({ onMonthChange });

    await userEvent.press(prevMonth());

    expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2026, month: 7 });
  });

  it('바꾼 달을 다 불러온 뒤에 바뀐 달과 그 달 완료 건수를 알려 준다', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {})
      .mockClear();
    // 바깥(경로)처럼 달이 바뀌면 그 달을 불러오는 중이 된다
    let finishLoading = () => {};
    function Harness() {
      const [loading, setLoading] = useState(false);
      finishLoading = () => setLoading(false);
      return (
        <WorkHistoryScreen
          today={today}
          works={loading ? [] : works}
          load={loading ? { status: 'loading' } : undefined}
          onMonthChange={() => setLoading(true)}
          onOpenWork={jest.fn()}
        />
      );
    }
    await render(<Harness />);

    await userEvent.press(prevMonth());
    expect(announce).not.toHaveBeenCalled();

    await act(() => finishLoading());
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenLastCalledWith('2026년 8월, 완료 1건');
    announce.mockRestore();
  });

  it('당겨서 새로고침한다', async () => {
    const onRefresh = jest.fn();
    await renderHistory({ onRefresh, refreshing: true });

    expect(list().props.refreshing).toBe(true);
    await fireEvent(list(), 'refresh');

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

// 켜 둔 채 날짜가 바뀌어 달이 넘어가면, 이번 달을 보던 화면은 새 달로 옮기고 직접 고른 달은 그대로 둔다 (#114 리뷰)
describe('WorkHistoryScreen — 날짜가 바뀌면', () => {
  it('이번 달을 보고 있었으면 새 달로 옮기고 그 달을 알린다', async () => {
    const onMonthChange = jest.fn();
    const { rerender } = await renderHistory({ onMonthChange });

    await rerender(
      <WorkHistoryScreen
        today={new Date(2026, 9, 1)}
        works={works}
        onOpenWork={jest.fn()}
        onMonthChange={onMonthChange}
      />,
    );

    expect(screen.getByText('2026년 10월')).toBeOnTheScreen();
    expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2026, month: 9 });
  });

  it('지난달을 직접 골라 보고 있었으면 그대로 둔다', async () => {
    const { rerender } = await renderHistory();
    await userEvent.press(prevMonth());

    await rerender(
      <WorkHistoryScreen
        today={new Date(2026, 9, 1)}
        works={works}
        onOpenWork={jest.fn()}
      />,
    );

    expect(screen.getByText('2026년 8월')).toBeOnTheScreen();
  });
});
