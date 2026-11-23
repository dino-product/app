import { act, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';
import { holdNativeAnimations } from '../../../jest/nativeAnimation';
import { swipeFrom } from '../../../jest/responder';
import { haptic } from '../../shared/haptics/haptic';
import * as tabSwipeArea from '../../shared/gesture/TabSwipeArea';
import {
  COMPONENT_SLACK,
  EDGE_BAND,
  SWITCH_DISTANCE,
  TAB_TRACK_DISTANCE,
  type Rect,
} from '../../shared/gesture/tabSwipe';
import {
  CURRENT_WORK_TITLE,
  fixAppTestClock,
  openStartedWorkDetail,
  renderSignedInHome,
} from '../testing';

// 메인 탭 좌우 밀기 (#140) 와 덮기 전환 (#216). 탭 순서: 홈 → 내 일정 → 작업 이력 → 마이.
// 놓은 뒤 덮기를 마저 끝내고 탭을 바꾼다 (네이티브 애니메이션 목은 16ms 뒤에 끝난다)
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
/** 놓은 뒤 덮기가 끝나기를 기다린다 */
const settle = () =>
  act(() => new Promise<void>(resolve => setTimeout(resolve, 50)));
const swipeAndSettle = async (...args: Parameters<typeof swipeFrom>) => {
  await swipeFrom(...args);
  await settle();
};
/** 탭 화면의 배경(탭 영역 자체)에서 민다 */
const swipeTab = (name: TabName, dx: number) =>
  swipeAndSettle(tabArea(name), { from: MIDDLE, dx });

type Node = ReturnType<typeof tabArea>;
/**
 * 탭 화면이 그려진 층. rest 는 지금 탭, over 는 덮으며 들어오는 탭, under 는 덮이는 탭, hidden 은 안 보이는 탭
 * (덮기 탭 뷰의 장면 스타일로 본다)
 */
/** 탭 장면이 터치를 받는지 */
function pointerEventsOf(name: TabName) {
  for (let node: Node | null = tabArea(name); node; node = node.parent) {
    if (StyleSheet.flatten(node.props.style)?.zIndex !== undefined) {
      return node.props.pointerEvents;
    }
  }
  throw new Error(`${name} 탭 장면을 찾지 못했다`);
}

function layerOf(name: TabName): 'rest' | 'over' | 'under' | 'hidden' {
  for (let node: Node | null = tabArea(name); node; node = node.parent) {
    const style = StyleSheet.flatten(node.props.style) ?? {};
    if (style.display === 'none') {
      return 'hidden';
    }
    if (style.zIndex === 3) {
      return 'over';
    }
    if (style.zIndex === 1) {
      return style.transform ? 'under' : 'rest';
    }
  }
  throw new Error(`${name} 탭 장면을 찾지 못했다`);
}

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

    // 8pt 이하로 스치는 것은 탭 밀기가 아니다 (#216)
    await swipeTab('home', -TAB_TRACK_DISTANCE);

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
  swipeAndSettle(element, {
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
      // 탭 바로 옮긴 덮기가 끝난 뒤에 민다 (마무리 중에는 밀기를 받지 않는다)
      await settle();
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

  it('작업 이력 목록 영역은 보이는 상단 바·머리(월 선택·요약 카드)를 뺀 아래쪽이다 — 머리에서 밀면 탭, 그 아래 행에서 밀면 달 (#153)', async () => {
    // 화면 위 자리: 리스트 50~650 위에 상단 바(50~100)가 겹치고, 그 아래 머리(100~320), 그 아래 행
    const list = { x: 0, y: 50, width: windowWidth(), height: 600 };
    const covers: Record<string, Rect> = {
      'work-history-bar': { x: 0, y: 50, width: windowWidth(), height: 50 },
      'work-history-list-header': {
        x: 0,
        y: 100,
        width: windowWidth(),
        height: 220,
      },
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
    await renderSignedInHome();
    const openHistory = async () => {
      await userEvent.press(screen.getByRole('tab', { name: '작업 이력' }));
      await screen.findAllByRole('button', { name: /, 완료, / });
      await settle();
    };
    const swipeHistory = (element: HostElement, y: number) =>
      swipeOn(element, list, { from: { x: windowWidth() / 2, y }, dx: FAR });

    // 머리(요약 카드)에서 시작: 목록 영역 밖이라 탭이 바뀐다
    await openHistory();
    await swipeHistory(screen.getByLabelText(/^누적 완료/), 200);
    expectSelected('schedule');

    // 머리가 스크롤로 다 올라가도, 보이는 상단 바의 빈 곳을 지나 리스트에 닿은 터치는 목록 영역 밖이다
    await openHistory();
    // 앞에서 민 것으로 달이 바뀌지 않았다
    expect(screen.getByText('2026년 10월')).toBeOnTheScreen();
    covers['work-history-list-header'] = {
      ...covers['work-history-list-header'],
      y: -300,
    };
    await swipeHistory(screen.getByTestId('work-history-list'), 80);
    expectSelected('schedule');

    // 머리 아래 행 안쪽에서 시작: 달을 옮긴다
    await openHistory();
    const [row] = screen.getAllByRole('button', { name: /, 완료, / });
    await swipeHistory(row, 450);
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

    await swipeAndSettle(day(), {
      from: { x: windowWidth() / 2, y: 235 },
      dx: -FAR,
      rects: new Map([[strip(), rect]]),
    });
    expectSelected('schedule');
    expect(
      await screen.findAllByRole('button', { name: nextSunday }),
    ).not.toHaveLength(0);

    await swipeAndSettle(
      screen.getAllByRole('button', { name: nextSunday })[0],
      {
        from: { x: EDGE_BAND - 8, y: 235 },
        dx: FAR,
        rects: new Map([[strip(), rect]]),
      },
    );
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

    await swipeAndSettle(day(), {
      from: { x: windowWidth() / 2, y: 380 },
      dx: -FAR,
      rects: new Map([[calendar(), rect]]),
    });
    expectSelected('schedule');
    expect(await screen.findByText('2026년 11월')).toBeOnTheScreen();

    await swipeAndSettle(calendar(), {
      from: { x: windowWidth() - EDGE_BAND + 8, y: 380 },
      dx: -FAR,
      rects: new Map([[calendar(), rect]]),
    });
    expectSelected('history');
  });
});

describe('탭 전환 — 이웃 탭 화면이 덮는다 (#216)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    // 공유 목이라 restoreAllMocks 로 돌아가지 않는다. 다른 테스트로 새지 않게 꺼진 것으로 되돌린다
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockImplementation(() => Promise.resolve(false));
  });

  it('밀어서 놓으면 이웃 탭 화면이 마저 덮은 뒤에 탭이 바뀐다 (탭 바도 그때 바뀐다)', async () => {
    await renderSignedInHome();
    const animations = holdNativeAnimations();

    await swipeFrom(tabArea('home'), { from: MIDDLE, dx: -FAR });
    // 처음 여는 탭도 밀기를 시작할 때 그려 덮는다
    expect(layerOf('schedule')).toBe('over');
    expect(layerOf('home')).toBe('under');
    expectSelected('home');

    await animations.finish();
    expectSelected('schedule');
    expect(layerOf('schedule')).toBe('rest');
    expect(layerOf('home')).toBe('hidden');
  });

  it('마무리하는 동안 탭 바로 다른 탭을 누르면 그 탭에 머문다 (밀던 탭으로 또 바뀌지 않는다)', async () => {
    await renderSignedInHome();
    const animations = holdNativeAnimations();

    await swipeFrom(tabArea('home'), { from: MIDDLE, dx: -FAR });
    await userEvent.press(screen.getByRole('tab', { name: '마이' }));
    await animations.finish();
    await settle();

    expectSelected('my');
    expect(layerOf('my')).toBe('rest');
  });

  it('놓은 뒤 마무리하는 동안에는 어느 탭 화면도 터치를 받지 않는다 (가려진 화면이 눌리지 않게)', async () => {
    await renderSignedInHome();
    const animations = holdNativeAnimations();

    await swipeFrom(tabArea('home'), { from: MIDDLE, dx: -FAR });
    expect(pointerEventsOf('home')).toBe('none');
    expect(pointerEventsOf('schedule')).toBe('none');

    await animations.finish();
    expect(pointerEventsOf('schedule')).toBe('box-none');
  });

  it('덮기를 마무리하는 동안 다시 밀어도 받지 않는다 (한 번에 옆 탭 하나)', async () => {
    await renderSignedInHome();
    const animations = holdNativeAnimations();

    await swipeFrom(tabArea('home'), { from: MIDDLE, dx: -FAR });
    await swipeFrom(tabArea('home'), { from: MIDDLE, dx: -FAR });
    await animations.finish();

    expectSelected('schedule');
    // 두 번째 밀기로는 그다음 탭을 그리지도 않았다
    expect(
      screen.queryByTestId('tab-swipe-history', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
  });

  it('탭 바를 누르면 같은 덮기로 들어오고, 끝나면 그 탭만 보인다', async () => {
    await renderSignedInHome();
    const animations = holdNativeAnimations();

    await userEvent.press(screen.getByRole('tab', { name: '마이' }));
    expectSelected('my');
    expect(layerOf('my')).toBe('over');
    expect(layerOf('home')).toBe('under');

    await animations.finish();
    expect(layerOf('my')).toBe('rest');
    expect(layerOf('home')).toBe('hidden');
  });

  it('동작 줄이기면 탭 바를 눌렀을 때 덮지 않고 바로 바뀐다', async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(true);
    await renderSignedInHome();
    holdNativeAnimations();

    await userEvent.press(screen.getByRole('tab', { name: '마이' }));

    expectSelected('my');
    expect(layerOf('my')).toBe('rest');
    expect(layerOf('home')).toBe('hidden');
  });
});

// 햅틱은 밀기 도중(임계를 넘을 때)이 아니라 탭이 실제로 바뀌는 순간에 한 번만 울린다
describe('탭 전환 햅틱', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('밀어서 놓으면 덮기가 끝나 탭이 바뀌는 순간 한 번 울린다 (미는 동안·놓은 직후에는 울리지 않는다)', async () => {
    await renderSignedInHome();
    const tabSwitch = jest.spyOn(haptic, 'tabSwitch');
    const animations = holdNativeAnimations();

    await swipeFrom(tabArea('home'), { from: MIDDLE, dx: -FAR });
    expect(tabSwitch).not.toHaveBeenCalled();

    await animations.finish();
    expectSelected('schedule');
    expect(tabSwitch).toHaveBeenCalledTimes(1);
  });

  it('원래 탭으로 돌아가면(짧게 스침·끝 탭 바깥) 울리지 않는다', async () => {
    await renderSignedInHome();
    const tabSwitch = jest.spyOn(haptic, 'tabSwitch');

    await swipeTab('home', -TAB_TRACK_DISTANCE);
    await swipeTab('home', FAR);

    expectSelected('home');
    expect(tabSwitch).not.toHaveBeenCalled();
  });

  it('탭 바를 눌러 바꿀 때도 한 번 울린다 (지금 탭을 다시 누르면 울리지 않는다)', async () => {
    await renderSignedInHome();
    const tabSwitch = jest.spyOn(haptic, 'tabSwitch');

    await userEvent.press(screen.getByRole('tab', { name: '홈' }));
    expect(tabSwitch).not.toHaveBeenCalled();

    await userEvent.press(screen.getByRole('tab', { name: '마이' }));
    expect(tabSwitch).toHaveBeenCalledTimes(1);
  });
});
