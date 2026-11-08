import { screen, userEvent } from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { holdNativeAnimations } from '../../../jest/nativeAnimation';
import { swipeFrom } from '../../../jest/responder';
import {
  COMPONENT_SLACK,
  EDGE_BAND,
  SWITCH_DISTANCE,
  type Rect,
} from '../../shared/gesture/tabSwipe';
import {
  CURRENT_WORK_TITLE,
  fixAppTestClock,
  openStartedWorkDetail,
  renderSignedInHome,
} from '../testing';
import { TAB_ENTER_MS, TAB_ENTER_OFFSET } from './tabTransition';

// 메인 탭 좌우 밀기와 방향을 반영한 전환 (#140). 탭 순서: 홈 → 내 일정 → 작업 이력 → 마이
fixAppTestClock();
// 앱 전체를 그리는 흐름 테스트라 기본 5초보다 길게 둔다 (App.my.test 와 같다)
jest.setTimeout(20_000);

const FAR = SWITCH_DISTANCE + 30;
const MIDDLE = { x: 200, y: 400 };

type TabName = 'home' | 'schedule' | 'history' | 'my';
const tabLabels: Record<TabName, string> = {
  home: '홈',
  schedule: '내 일정',
  history: '작업 이력',
  my: '마이',
};

const tabArea = (name: TabName) =>
  screen.getByTestId(`tab-swipe-${name}`, { includeHiddenElements: true });
const expectSelected = (name: TabName) =>
  expect(
    screen.getByRole('tab', { name: tabLabels[name], selected: true }),
  ).toBeOnTheScreen();
/** 탭 화면의 배경(탭 영역 자체)에서 민다 */
const swipeTab = (name: TabName, dx: number) =>
  swipeFrom(tabArea(name), { from: MIDDLE, dx });

/** 탭 화면(장면)에 걸린 스타일. 탭 영역을 품은 장면 뷰가 bottom-tabs 의 전환 스타일을 받는다 */
function sceneStyle(name: TabName) {
  for (let node = tabArea(name).parent; node; node = node.parent) {
    const style = StyleSheet.flatten(node.props.style);
    if (style && 'transform' in style) {
      return style;
    }
  }
  return {};
}
const translateXOf = (name: TabName) => {
  const transform = sceneStyle(name).transform as
    | Array<{ translateX?: number }>
    | undefined;
  return transform?.[0]?.translateX ?? 0;
};

describe('메인 탭 좌우 밀기', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('홈 배경에서 왼쪽으로 밀면 오른쪽 이웃 탭(내 일정), 내 일정에서 오른쪽으로 밀면 홈', async () => {
    await renderSignedInHome();

    await swipeTab('home', -FAR);
    expectSelected('schedule');

    await swipeTab('schedule', FAR);
    expectSelected('home');
  });

  it('양 끝 탭에서 바깥쪽으로 밀면 아무 일도 없다', async () => {
    await renderSignedInHome();

    await swipeTab('home', FAR);
    expectSelected('home');

    await userEvent.press(screen.getByRole('tab', { name: '마이' }));
    await swipeTab('my', -FAR);
    expectSelected('my');
  });

  it('짧게 밀면 탭이 그대로다', async () => {
    await renderSignedInHome();

    await swipeTab('home', -(SWITCH_DISTANCE - 4));

    expectSelected('home');
  });

  it('탭 안쪽 화면(작업 상세)에서는 밀어도 탭이 그대로다 (iOS 뒤로 가기 밀기와 겹치지 않게)', async () => {
    await renderSignedInHome();
    await openStartedWorkDetail();

    await swipeTab('home', -FAR);

    expectSelected('home');
    expect(
      screen.getByRole('button', { name: '작업 전 사진 추가' }),
    ).toBeOnTheScreen();
  });
});

type HostElement = ReturnType<typeof screen.getByRole>;

/** 요소를 품은 세부 컴포넌트(탭 밀기 영역 규칙을 단 뷰) */
function regionOf(element: HostElement): HostElement {
  for (let node: HostElement | null = element; node; node = node.parent) {
    if (node.props.onTouchStart) {
      return node;
    }
  }
  throw new Error('탭 밀기 영역 규칙을 단 컴포넌트가 없다');
}

/** element 에서 시작해 민다. element 를 품은 컴포넌트가 화면에서 rect 자리에 있다 */
const swipeOn = (
  element: HostElement,
  rect: Rect,
  options: { from: { x: number; y: number }; dx: number },
) =>
  swipeFrom(element, {
    ...options,
    rects: new Map([[regionOf(element), rect]]),
  });

const windowWidth = () => Dimensions.get('window').width;

describe('메인 탭 좌우 밀기 — 세부 컴포넌트', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('홈 진행할 작업 카드는 가장자리 여유에서 시작하면 탭이 바뀌고, 안쪽 깊은 곳이면 바뀌지 않는다', async () => {
    await renderSignedInHome();
    const card = () =>
      screen.getByRole('button', { name: `${CURRENT_WORK_TITLE} 상세 보기` });
    const rect = { x: 80, y: 150, width: 300, height: 220 };

    await swipeOn(card(), rect, {
      from: { x: 230, y: rect.y + COMPONENT_SLACK - 3 },
      dx: -FAR,
    });
    expectSelected('schedule');

    await userEvent.press(screen.getByRole('tab', { name: '홈' }));
    // 안쪽에서 민 것은 카드 몫이다 (탭은 그대로. 카드 안에서 손을 떼면 누르기는 기존대로 카드가 받는다)
    await swipeOn(card(), rect, { from: { x: 230, y: 260 }, dx: -FAR });
    expectSelected('home');
  });

  it('작업 이력 목록은 화면 가장자리 띠·목록 가장자리 여유에서 시작하면 탭이 바뀌고, 안쪽에서 밀면 달을 옮긴다 (#153)', async () => {
    await renderSignedInHome();
    const openHistory = async () => {
      await userEvent.press(screen.getByRole('tab', { name: '작업 이력' }));
      const [row] = await screen.findAllByRole('button', { name: /, 완료, / });
      return row;
    };
    // 목록 영역 (상단 바·월 선택·요약 카드 아래)
    const rect = { x: 0, y: 300, width: windowWidth(), height: 400 };

    await swipeOn(await openHistory(), rect, {
      from: { x: EDGE_BAND - 8, y: 450 },
      dx: FAR,
    });
    expectSelected('schedule');

    await swipeOn(await openHistory(), rect, {
      from: { x: windowWidth() / 2, y: rect.y + COMPONENT_SLACK - 4 },
      dx: FAR,
    });
    expectSelected('schedule');

    await swipeOn(await openHistory(), rect, {
      from: { x: windowWidth() / 2, y: 450 },
      dx: FAR,
    });
    expectSelected('history');
    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();
  });

  it('내 일정 주간 줄은 안쪽에서는 주를 넘기고, 화면 가장자리 띠에서는 탭이 먼저 바뀐다', async () => {
    await renderSignedInHome();
    await userEvent.press(screen.getByRole('tab', { name: '내 일정' }));
    // 2026-10-21(수) 의 주는 10월 18일 ~ 24일. 다음 주의 일요일은 25일
    const nextSunday = /^10월 25일/;
    await screen.findAllByRole('button', { name: /^10월 21일/ });
    const strip = () => screen.getByTestId('week-strip');
    const rect = { x: 20, y: 200, width: windowWidth() - 40, height: 69 };
    const day = () => screen.getAllByRole('button', { name: /^10월 21일/ })[0];

    await swipeFrom(day(), {
      from: { x: windowWidth() / 2, y: 235 },
      dx: -FAR,
      rects: new Map([[strip(), rect]]),
    });
    expectSelected('schedule');
    expect(
      await screen.findAllByRole('button', { name: nextSunday }),
    ).not.toHaveLength(0);

    await swipeFrom(screen.getAllByRole('button', { name: nextSunday })[0], {
      from: { x: EDGE_BAND - 8, y: 235 },
      dx: FAR,
      rects: new Map([[strip(), rect]]),
    });
    expectSelected('home');
  });

  it('내 일정 펼친 달력은 안쪽에서는 달을 넘기고, 화면 가장자리 띠에서는 탭이 먼저 바뀐다', async () => {
    await renderSignedInHome();
    await userEvent.press(screen.getByRole('tab', { name: '내 일정' }));
    await screen.findAllByRole('button', { name: /^10월 21일/ });
    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));
    expect(screen.getByText('2026년 10월')).toBeOnTheScreen();
    const calendar = () => screen.getByTestId('month-calendar');
    const rect = { x: 20, y: 200, width: windowWidth() - 40, height: 360 };
    const day = () => screen.getAllByRole('button', { name: /^10월 21일/ })[0];

    await swipeFrom(day(), {
      from: { x: windowWidth() / 2, y: 380 },
      dx: -FAR,
      rects: new Map([[calendar(), rect]]),
    });
    expectSelected('schedule');
    expect(await screen.findByText('2026년 11월')).toBeOnTheScreen();

    await swipeFrom(calendar(), {
      from: { x: windowWidth() - EDGE_BAND + 8, y: 380 },
      dx: -FAR,
      rects: new Map([[calendar(), rect]]),
    });
    expectSelected('history');
  });
});

describe('탭 전환 애니메이션 방향', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    // 공유 목이라 restoreAllMocks 로 돌아가지 않는다. 다른 테스트로 새지 않게 꺼진 것으로 되돌린다
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockImplementation(() => Promise.resolve(false));
  });

  it('탭 바로 오른쪽 탭에 가면 +x 에서, 왼쪽 탭에 가면 -x 에서 0 으로 들어오고 투명도는 그대로다', async () => {
    await renderSignedInHome();
    const animations = holdNativeAnimations();

    await userEvent.press(screen.getByRole('tab', { name: '마이' }));
    expect(translateXOf('my')).toBe(TAB_ENTER_OFFSET);
    expect(sceneStyle('my').opacity).toBeUndefined();
    await animations.finish();
    expect(translateXOf('my')).toBe(0);

    await userEvent.press(screen.getByRole('tab', { name: '내 일정' }));
    expect(translateXOf('schedule')).toBe(-TAB_ENTER_OFFSET);
    expect(sceneStyle('schedule').opacity).toBeUndefined();
    await animations.finish();
    expect(translateXOf('schedule')).toBe(0);
  });

  it('밀어서 옮겨도 같은 방향 규칙으로 들어온다', async () => {
    await renderSignedInHome();
    const animations = holdNativeAnimations();

    await swipeTab('home', -FAR);
    expect(translateXOf('schedule')).toBe(TAB_ENTER_OFFSET);
    await animations.finish();

    await swipeTab('schedule', FAR);
    expect(translateXOf('home')).toBe(-TAB_ENTER_OFFSET);
    await animations.finish();
    expect(translateXOf('home')).toBe(0);
  });

  it('애니메이션은 네이티브 드라이버(UI 스레드)로 돈다', async () => {
    await renderSignedInHome();
    const timing = jest.spyOn(Animated, 'timing');

    await userEvent.press(screen.getByRole('tab', { name: '작업 이력' }));

    const enter = timing.mock.calls.find(
      ([, config]) => config.duration === TAB_ENTER_MS && config.toValue === 0,
    );
    expect(enter?.[1].useNativeDriver).toBe(true);
  });

  it('동작 줄이기면 옮기지 않고 바로 바뀐다', async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(true);
    await renderSignedInHome();
    holdNativeAnimations();

    await userEvent.press(screen.getByRole('tab', { name: '마이' }));

    expectSelected('my');
    expect(sceneStyle('my').transform).toBeUndefined();
  });
});
