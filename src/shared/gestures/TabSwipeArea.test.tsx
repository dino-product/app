import { act, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import {
  Dimensions,
  PanResponder,
  Pressable,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { swipeFrom } from '../../../jest/responder';
import {
  COMPONENT_SLACK,
  EDGE_BAND,
  SWITCH_DISTANCE,
  type Rect,
} from './tabSwipe';
import { TabSwipeArea, useTabSwipeRegion } from './TabSwipeArea';

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

async function setup({ enabled = true }: { enabled?: boolean } = {}) {
  const onSwipe = jest.fn();
  const view = await render(
    <TabSwipeArea canSwipe={() => enabled} onSwipe={onSwipe} testID="area">
      <View testID="background">
        <Card testID="card" />
        <Card testID="row" stacked />
        <OwnSwipe />
      </View>
    </TabSwipeArea>,
  );
  const rects = new Map([
    [screen.getByTestId('card'), CARD],
    [screen.getByTestId('row'), fullRow()],
    [screen.getByTestId('own-swipe'), CARD],
  ]);
  const swipe = (
    testID: string,
    options: Omit<Parameters<typeof swipeFrom>[1], 'rects'>,
  ) => swipeFrom(screen.getByTestId(testID), { ...options, rects });
  return { ...view, onSwipe, swipe };
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

describe('TabSwipeArea — 손바닥 오작동 방지', () => {
  it('임계값보다 짧은 가로 이동은 아무 일도 없다', async () => {
    const { swipe, onSwipe } = await setup();

    await swipe('background', { from: center, dx: -(SWITCH_DISTANCE - 2) });

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
