import { act, render, screen } from '@testing-library/react-native';
import { memo, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  Pressable,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { touchEvent, touchesEvent } from '../../../jest/gesture';
import { swipeFrom } from '../../../jest/responder';
import { fakeTabCover, WithTabCover } from '../../../jest/tabCover';
import {
  COMPONENT_SLACK,
  EDGE_BAND,
  SWITCH_DISTANCE,
  TAB_TRACK_DISTANCE,
  type Rect,
} from './tabSwipe';
import {
  measureElement,
  TabSwipeArea,
  useTabSwipeRegion,
  TabSwipeScrollLock,
} from './TabSwipeArea';

const width = () => Dimensions.get('window').width;
const MIDDLE_Y = 400;
const FAR = SWITCH_DISTANCE + 20;

// 화면 가운데 놓인 카드(세부 컴포넌트)와, 화면 폭을 꽉 채운 행
const CARD: Rect = { x: 100, y: 300, width: 200, height: 120 };
const fullRow = (): Rect => ({ x: 0, y: 500, width: width(), height: 110 });

const onPress = jest.fn();

function Card({ testID, stacked }: { testID: string; stacked?: boolean }) {
  const region = useTabSwipeRegion({ stacked });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={testID}
      onPress={onPress}
      onTouchStart={region.onTouchStart}
      testID={testID}
    />
  );
}

// 자체 가로 제스처가 있는 컴포넌트 (달력 넘김처럼 가로로 10pt 움직이면 응답자가 된다)
const onOwnSwipe = jest.fn();
function OwnSwipe() {
  const region = useTabSwipeRegion();
  const [responder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx }) =>
        Math.abs(dx) > 10 && region.ownsGesture(),
      onPanResponderGrant: () => onOwnSwipe(),
      onPanResponderTerminationRequest: () => false,
    }),
  );
  return (
    <View
      testID="own-swipe"
      onTouchStart={region.onTouchStart}
      {...responder.panHandlers}
    />
  );
}

// 터치를 시작할 때 응답자가 되고 끝까지 넘겨 주지 않는 안쪽 컴포넌트 (예: 스크롤 중인 리스트)
function Holder() {
  const region = useTabSwipeRegion();
  return (
    <View
      testID="holder"
      onTouchStart={region.onTouchStart}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
    />
  );
}

async function setup({ enabled = true }: { enabled?: boolean } = {}) {
  const { cover, onSwipe } = fakeTabCover();
  const view = await render(
    <WithTabCover cover={cover}>
      <TabSwipeArea canSwipe={() => enabled} testID="area">
        <View testID="background">
          <Card testID="card" />
          <Card testID="row" stacked />
          <OwnSwipe />
          <Holder />
        </View>
      </TabSwipeArea>
    </WithTabCover>,
  );
  const rects = new Map([
    [screen.getByTestId('card'), CARD],
    [screen.getByTestId('row'), fullRow()],
    [screen.getByTestId('own-swipe'), CARD],
    [screen.getByTestId('holder'), CARD],
  ]);
  const swipe = (
    testID: string,
    options: Omit<Parameters<typeof swipeFrom>[1], 'rects'>,
  ) => swipeFrom(screen.getByTestId(testID), { ...options, rects });
  return { ...view, onSwipe, cover, swipe };
}

const center = { x: 200, y: MIDDLE_Y };

describe('TabSwipeArea — 어디서 밀면 탭이 바뀌나', () => {
  beforeEach(() => {
    onPress.mockClear();
    onOwnSwipe.mockClear();
  });

  it('배경에서 왼쪽으로 임계값 넘게 밀면 오른쪽 탭(next), 오른쪽이면 왼쪽 탭(prev)', async () => {
    const { swipe, onSwipe } = await setup();

    await swipe('background', { from: center, dx: -FAR });
    expect(onSwipe).toHaveBeenLastCalledWith('next');

    await swipe('background', { from: center, dx: FAR });
    expect(onSwipe).toHaveBeenLastCalledWith('prev');
    expect(onSwipe).toHaveBeenCalledTimes(2);
  });

  it('한 번 민 제스처로는 한 번만 바꾼다 (끝까지 길게 밀어도)', async () => {
    const { swipe, onSwipe } = await setup();

    await swipe('background', { from: center, dx: -FAR * 3, steps: 30 });

    expect(onSwipe).toHaveBeenCalledTimes(1);
  });

  it('세부 컴포넌트 가장자리 안쪽 여유 영역에서 시작하면 탭이 바뀌고 누르기는 취소된다', async () => {
    const { swipe, onSwipe } = await setup();

    await swipe('card', {
      from: { x: CARD.x + COMPONENT_SLACK - 2, y: CARD.y + 60 },
      dx: -FAR,
    });

    expect(onSwipe).toHaveBeenCalledWith('next');
    expect(onPress).not.toHaveBeenCalled();
  });

  it('세부 컴포넌트 안쪽 깊은 곳에서 시작하면 탭이 바뀌지 않는다', async () => {
    const { swipe, onSwipe } = await setup();

    await swipe('card', { from: { x: 200, y: CARD.y + 60 }, dx: -FAR });

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('화면 폭을 꽉 채운 행은 안쪽에서는 바뀌지 않고, 화면 가장자리 띠에서 시작하면 바뀐다', async () => {
    const { swipe, onSwipe } = await setup();

    await swipe('row', { from: { x: 200, y: 550 }, dx: -FAR });
    expect(onSwipe).not.toHaveBeenCalled();

    await swipe('row', { from: { x: EDGE_BAND - 4, y: 550 }, dx: FAR });
    expect(onSwipe).toHaveBeenLastCalledWith('prev');

    await swipe('row', {
      from: { x: width() - EDGE_BAND + 4, y: 550 },
      dx: -FAR,
    });
    expect(onSwipe).toHaveBeenLastCalledWith('next');
  });
});

describe('TabSwipeArea — 응답자 잡기', () => {
  it('가로로 방향이 정해지면(8pt) 바로 응답자가 되어 손가락을 넘기고, 바꿀지는 놓을 때 정한다 (#216)', async () => {
    const { swipe, onSwipe, cover } = await setup();

    // Android 세로 리스트는 세로로 8dp 남짓 움직이면 터치를 가져간다. 그 전에 응답자가 돼 부모의 가로채기를 막는다
    const short = await swipe('background', {
      from: center,
      path: [
        { x: 0, y: 0 },
        { x: -12, y: 4 },
        { x: -30, y: 8 },
      ],
    });
    // 응답자는 탭 영역이다
    expect(short?.onMoveShouldSetResponder).toBe(
      screen.getByTestId('area').props.onMoveShouldSetResponder,
    );
    expect(cover.move).toHaveBeenLastCalledWith(-30, TAB_TRACK_DISTANCE);
    // 이어 민 채 놓았다
    expect(onSwipe).toHaveBeenCalledTimes(1);
    expect(onSwipe).toHaveBeenCalledWith('next');
  });

  it('응답자가 된 뒤 세로로 꺾여도 놓을 때까지 가로로 본다 (그동안 리스트는 스크롤하지 않는다, #216)', async () => {
    const { swipe, onSwipe } = await setup();

    await swipe('background', {
      from: center,
      path: [
        { x: 0, y: 0 },
        { x: -14, y: 2 },
        { x: -20, y: 80 },
        { x: -FAR * 2, y: 120 },
      ],
    });

    expect(onSwipe).toHaveBeenCalledWith('next');
  });

  it('한 번에 크게 움직이고 바로 떼도 바꾼다', async () => {
    const { swipe, onSwipe } = await setup();

    await swipe('background', { from: center, dx: -FAR, steps: 1 });

    expect(onSwipe).toHaveBeenCalledWith('next');
  });

  it('안쪽 응답자가 넘겨 주지 않으면(거절) 바꾸지 않는다', async () => {
    const { swipe, onSwipe } = await setup();

    // 가장자리 띠에서 시작해 탭 전환 몫이지만, 이미 응답자인 안쪽 뷰가 놓아 주지 않는다
    await swipe('holder', { from: { x: 4, y: CARD.y + 60 }, dx: FAR });

    expect(onSwipe).not.toHaveBeenCalled();
  });
});

describe('TabSwipeArea — 손바닥 오작동 방지', () => {
  it('8pt 이하로 스치는 가로 이동은 아무 일도 없다 (#216)', async () => {
    const { swipe, onSwipe } = await setup();

    await swipe('background', { from: center, dx: -TAB_TRACK_DISTANCE });

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('세로 우세 이동은 바꾸지 않는다', async () => {
    const { swipe, onSwipe } = await setup();

    await swipe('background', { from: center, dx: -FAR, dy: 120 });

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('세로로 먼저 움직인(세로 스크롤 중) 제스처는 나중에 가로로 밀어도 바꾸지 않는다', async () => {
    const { swipe, onSwipe } = await setup();

    await swipe('background', {
      from: center,
      path: [
        { x: 0, y: 0 },
        { x: 0, y: 30 },
        { x: 0, y: 60 },
        { x: -60, y: 60 },
        { x: -160, y: 60 },
        { x: -260, y: 60 },
      ],
    });

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('두 손가락이면 바꾸지 않는다', async () => {
    const { swipe, onSwipe } = await setup();

    await swipe('background', { from: center, dx: -FAR, fingers: 2 });

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('한 손가락이 닿아 있는 중에 다른 손가락이 닿으면 그 제스처는 끝까지 바꾸지 않는다', async () => {
    const { onSwipe } = await setup();
    const area = screen.getByTestId('area');
    const touches = (count: number, changed: number) =>
      ({
        nativeEvent: {
          touches: Array.from({ length: count }, (_, identifier) => ({
            identifier,
          })),
          changedTouches: Array.from({ length: changed }, (_, i) => ({
            identifier: count - changed + i,
          })),
        },
      } as unknown as GestureResponderEvent);

    await act(() => {
      area.props.onTouchStartCapture(touches(1, 1));
      area.props.onTouchStartCapture(touches(2, 1));
    });
    // 두 번째 손가락이 떨어진 뒤 한 손가락으로 밀어도 같은 제스처다
    const moved = area.props.onMoveShouldSetResponder({
      touchHistory: {
        numberActiveTouches: 1,
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: 1,
        touchBank: [],
      },
      nativeEvent: { touches: [{}] },
    });

    expect(moved).toBe(false);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('꺼 두면(탭 안쪽 화면) 밀어도 바꾸지 않는다', async () => {
    const { swipe, onSwipe } = await setup({ enabled: false });

    await swipe('background', { from: center, dx: -FAR });

    expect(onSwipe).not.toHaveBeenCalled();
  });
});

describe('useTabSwipeRegion — 판정 영역 재기', () => {
  it('measure 를 주면 터치한 뷰 대신 그 사각형으로 판정한다 (예: 리스트에서 머리를 뺀 목록 영역)', async () => {
    const { cover, onSwipe } = fakeTabCover();
    const measure = jest.fn(() => CARD);
    function Measured() {
      const region = useTabSwipeRegion({ measure });
      return <View testID="measured" onTouchStart={region.onTouchStart} />;
    }
    await render(
      <WithTabCover cover={cover}>
        <TabSwipeArea canSwipe={() => true}>
          <Measured />
        </TabSwipeArea>
      </WithTabCover>,
    );
    const measured = screen.getByTestId('measured');

    // 터치한 뷰는 잴 수 없어도(rects 없음) measure 의 사각형 안쪽 깊은 곳이면 컴포넌트 몫이다
    await swipeFrom(measured, { from: { x: 200, y: CARD.y + 60 }, dx: -FAR });
    expect(onSwipe).not.toHaveBeenCalled();
    expect(measure).toHaveBeenCalled();

    await swipeFrom(measured, {
      from: { x: 200, y: CARD.y + CARD.height - COMPONENT_SLACK + 2 },
      dx: -FAR,
    });
    expect(onSwipe).toHaveBeenCalledWith('next');
  });

  it('measureElement 는 잴 수 없는 뷰(테스트 렌더러·null)면 null 이다', () => {
    expect(measureElement(null)).toBeNull();
    expect(measureElement(3)).toBeNull();
    expect(measureElement({})).toBeNull();
    expect(
      measureElement({ getBoundingClientRect: () => ({ ...CARD, top: 1 }) }),
    ).toEqual(CARD);
  });
});

describe('useTabSwipeRegion — 자체 가로 제스처와 공존', () => {
  beforeEach(() => {
    onOwnSwipe.mockClear();
  });

  it('안쪽 깊은 곳에서는 컴포넌트의 가로 제스처가 받고 탭은 그대로다', async () => {
    const { swipe, onSwipe } = await setup();

    await swipe('own-swipe', { from: { x: 200, y: CARD.y + 60 }, dx: -FAR });

    expect(onOwnSwipe).toHaveBeenCalledTimes(1);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('가장자리 여유 영역·화면 가장자리 띠에서는 탭 전환이 먼저다', async () => {
    const { swipe, onSwipe } = await setup();

    await swipe('own-swipe', {
      from: { x: 200, y: CARD.y + COMPONENT_SLACK - 2 },
      dx: -FAR,
    });
    expect(onSwipe).toHaveBeenLastCalledWith('next');

    await swipe('own-swipe', { from: { x: 4, y: CARD.y + 60 }, dx: FAR });
    expect(onSwipe).toHaveBeenLastCalledWith('prev');

    expect(onOwnSwipe).not.toHaveBeenCalled();
  });

  it('탭 영역 밖에 두면 시작 자리와 상관없이 컴포넌트가 갖는다', async () => {
    let owns: (() => boolean) | undefined;
    let touchStart: ((event: GestureResponderEvent) => void) | undefined;
    function Probe() {
      const region = useTabSwipeRegion();
      owns = region.ownsGesture;
      touchStart = region.onTouchStart;
      return null;
    }
    await render(<Probe />);

    touchStart?.({
      nativeEvent: {
        pageX: 2,
        pageY: 300,
        touches: [{ identifier: 0 }],
        changedTouches: [{ identifier: 0 }],
      },
      currentTarget: { getBoundingClientRect: () => CARD },
    } as unknown as GestureResponderEvent);

    expect(owns?.()).toBe(true);
  });
});

describe('TabSwipeArea — 미는 동안 세로 스크롤 잠금 (#216)', () => {
  const screenRenders = { count: 0 };
  // 탭 첫 화면처럼 리스트를 그리는 화면. 잠금이 바뀌어도 화면은 다시 그리지 않고 리스트만 다시 그린다
  const Screen = memo(function TabScreen() {
    screenRenders.count += 1;
    return (
      <TabSwipeScrollLock>
        {scrollEnabled => (
          <View
            testID="list"
            accessibilityLabel={scrollEnabled ? '풀림' : '잠김'}
          />
        )}
      </TabSwipeScrollLock>
    );
  });

  it('가로로 정해진 순간부터 놓을 때까지 리스트 스크롤을 잠그고, 그동안 화면은 다시 그리지 않는다', async () => {
    const { cover } = fakeTabCover();
    await render(
      <WithTabCover cover={cover}>
        <TabSwipeArea canSwipe={() => true} testID="area">
          <Screen />
        </TabSwipeArea>
      </WithTabCover>,
    );
    const area = () => screen.getByTestId('area').props;
    const list = () => screen.getByTestId('list').props.accessibilityLabel;
    const at = (from: number, x: number, step: number, active = true) =>
      touchEvent({ x: from, y: 0 }, { x, y: 0 }, step, 1, active);

    await act(() => {
      area().onTouchStartCapture(touchesEvent({ changed: [0], touches: [0] }));
      area().onStartShouldSetResponderCapture(at(0, 0, 0));
      area().onStartShouldSetResponder(at(0, 0, 0));
      // 아직 8pt 를 넘지 않았다 (RN 처럼 capture 다음 bubble 로 묻는다)
      const first = at(0, -6, 1);
      area().onMoveShouldSetResponderCapture(first);
      area().onMoveShouldSetResponder(first);
    });
    expect(list()).toBe('풀림');

    await act(() => {
      const move = at(-6, -20, 2);
      area().onMoveShouldSetResponderCapture(move);
      if (area().onMoveShouldSetResponder(move)) {
        area().onResponderGrant(move);
      }
      area().onResponderMove(move);
      area().onResponderMove(at(-20, -40, 3));
    });
    expect(list()).toBe('잠김');

    await act(() => {
      area().onResponderRelease(at(-40, -40, 4, false));
    });
    expect(list()).toBe('풀림');
    expect(screenRenders.count).toBe(1);
  });

  it('화면 자체 잠금(enabled false)이면 밀지 않아도 끈다', async () => {
    await render(
      <TabSwipeScrollLock enabled={false}>
        {scrollEnabled => (
          <View testID="list" accessibilityLabel={String(scrollEnabled)} />
        )}
      </TabSwipeScrollLock>,
    );
    expect(screen.getByTestId('list').props.accessibilityLabel).toBe('false');
  });
});
