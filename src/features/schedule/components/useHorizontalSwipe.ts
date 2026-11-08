import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  type GestureResponderHandlers,
  type LayoutChangeEvent,
} from 'react-native';
import { useReduceMotion } from '../../../shared/accessibility/useReduceMotion';
import { decidePanAxis, type PanAxis } from '../../../shared/gesture/panAxis';

// 달력을 좌우로 밀어 넘긴다. 새 의존성 없이 PanResponder 로 받고, 끄는 동안 트랙이 손가락을 따라 움직인다.
// 손길마다 처음 움직인 방향을 decidePanAxis 로 한 번 정하고(10pt·45도), 가로로 정해졌을 때만 응답자가 된다.
// 방향은 화면에 손가락 하나로 시작해 정할 때까지 한 손가락인 손길에서만 본다 (useTouchScrollLock 과 같은 규칙).
// 그래서 날짜 탭은 안쪽 Pressable 이 받고, 세로로 정해진 손길은 끝까지 리스트 스크롤 몫이다 (#144).
// 리스트 머리에 둔 달력은 같은 규칙으로 리스트 스크롤을 막는다(useTouchScrollLock).
// 밀던 중에는 리스트가 응답자를 달라고 해도(iOS) 넘겨 주지 않고, 응답자가 되면 네이티브 부모의 가로채기도 막는다
// (Android, PanResponder 기본값). 시스템이 끊으면(전화·시스템 제스처 등) 넘기지 않고 제자리로 돌아간다.
// 스택 안쪽 화면에 두면 iOS 26 화면 전체 뒤로 가기와 오른쪽 밀기가 겹친다 (지금은 탭 첫 화면에만 있다).
// Android 제스처 내비게이션은 어느 화면이든 가장자리에서 시작한 밀기를 먼저 가져가 뒤로 가기로 쓴다.
// 그래서 미는 뷰 안에 GestureExclusionArea 를 둬 그 자리만 시스템 제스처에서 뺀다 (한쪽 가장자리당 세로 200dp 까지).
//
// 트랙(SwipeTrack)은 page 번째 칸에 지금 페이지를, 그 앞뒤 칸에 옆 페이지를 두고 통째로 translateX 만큼 옮긴다.
// 넘김이 끝나면 옮긴 거리를 0 으로 되돌리지 않고 page 를 옮긴다. 그 렌더에서 지금 페이지가 옆 페이지가 있던 칸으로 가며
// 그 내용을 그리므로, 네이티브 값과 렌더가 한 프레임 어긋나도 보이는 것이 같다 (되돌리면 그 프레임에 깜빡인다).
// translateX 는 처음부터 네이티브 값이라 끄는 동안의 setValue 는 다시 그리지 않고 UI 스레드로만 간다.
// 손을 뗀 뒤와 버튼 넘김은 네이티브 드라이버로 돈다.

/** 밀기로 본 지점에서 이만큼 더 밀고 놓으면 넘긴다 (pt) */
const SWIPE_DISTANCE = 40;
/** 덜 밀었어도 같은 방향으로 이만큼 빠르게 튕기면 넘긴다 (pt/ms) */
const FLICK_VELOCITY = 0.3;
/** 한 페이지를 미끄러져 넘기는 시간 (ms). 손을 뗀 뒤에는 남은 거리만큼 줄인다 */
export const SLIDE_MS = 280;
/** 남은 거리가 짧아도 이만큼은 미끄러진다 (ms). 한 프레임 안에 끝나 튀어 보이지 않게 한다 */
export const MIN_SLIDE_MS = 120;
const slideEasing = Easing.out(Easing.cubic);

export type HorizontalSwipe = {
  /** 미는 뷰에 단다 */
  panHandlers: GestureResponderHandlers;
  /** 트랙을 옮기는 거리 (네이티브 값) */
  translateX: Animated.Value;
  /** 트랙에서 지금 페이지가 있는 칸. 넘김이 끝날 때마다 하나씩 옮긴다 */
  page: number;
  /** 트랙의 onLayout. 한 칸(페이지) 폭을 잰다 */
  onTrackLayout: (event: LayoutChangeEvent) => void;
  /** 이전(-1)·다음(1) 페이지로 미끄러져 넘긴다 (버튼) */
  slide: (delta: -1 | 1) => void;
};

/** 미끄러지는 중인 넘김. delta 는 다 넘어가면 확정할 페이지 수 (제자리로 돌아가면 0) */
type Slide = {
  from: number;
  to: number;
  start: number;
  duration: number;
  delta: number;
};

/**
 * onPrev·onNext 는 다 넘어간 뒤에 부른다. 그 자리에서(같은 작업 안에서) 내용을 앞뒤 페이지로 바꿔야 한다.
 * 트랙은 그 렌더에서 지금 페이지를 옆 칸으로 옮기므로, 내용을 바꾸지 않거나 나중에 바꾸면 그동안 옛 내용이 옆 칸에 보인다
 */
export function useHorizontalSwipe(callbacks: {
  onPrev: () => void;
  onNext: () => void;
}): HorizontalSwipe {
  // 부모가 렌더마다 새 콜백을 넘겨도 PanResponder 는 한 번만 만들고 최신 콜백을 부른다
  const latest = useRef(callbacks);
  useLayoutEffect(() => {
    latest.current = callbacks;
  });
  const reduceMotion = useReduceMotion();
  const [page, setPage] = useState(0);

  const [swipe] = useState(() => {
    const translateX = new Animated.Value(0, { useNativeDriver: true });
    // 응답자·애니메이션 콜백이 읽는 값이라 렌더와 따로 둔다
    let current = 0;
    let width = 0;
    let sliding: Slide | null = null;
    let dragFrom = 0;
    // 이번 손길의 방향. 처음 정한 뒤로는 바꾸지 않는다. 'none' 은 방향을 보지 않는 손길이다:
    // 여러 손가락인 손길, 그리고 응답자가 된 뒤 다음 닿는 순간을 볼 때까지
    let axis: PanAxis | 'none' | null = null;

    const restAt = (target: number) => -target * width;
    // 앞뒤 한 페이지까지만 그려 두므로 그 너머로는 끌지 않는다 (큰 화면에서는 창보다 길게 끌 수 있다)
    const dragAt = (dx: number) =>
      Math.min(
        restAt(current - 1),
        Math.max(restAt(current + 1), dragFrom + dx),
      );

    // 페이지 칸과 부모의 내용을 한 렌더에서 함께 바꾼다 (같은 작업 안의 setState 는 한 번에 처리된다)
    const commit = (delta: number) => {
      current += delta;
      setPage(current);
      if (delta < 0) {
        latest.current.onPrev();
      } else {
        latest.current.onNext();
      }
    };

    // 미끄러지던 넘김을 이어받을 때 지금 보이는 자리를 돌려준다. 애니메이션은 UI 스레드에서 돌아 JS 는
    // 지금 값을 모르므로 시작 시각과 곡선으로 계산한다. 아직 확정하지 않은 넘김은 이때 확정한다 (보이는 것은 같다)
    const takeOver = () => {
      if (!sliding) {
        return restAt(current);
      }
      const { from, to, start, duration, delta } = sliding;
      sliding = null;
      const progress = Math.min(1, (Date.now() - start) / duration);
      if (delta !== 0) {
        commit(delta);
      }
      return from + (to - from) * slideEasing(progress);
    };

    const slideTo = (target: number, from: number) => {
      const delta = target - current;
      const to = restAt(target);
      const distance = Math.abs(to - from);
      // 동작 줄이기면 미끄러지지 않는다. 폭을 재기 전(그리기 전)에는 넘길 거리를 모른다
      if (reduceMotion.current || width === 0 || distance === 0) {
        // 돌던 애니메이션도 멈춘다 (finished: false 로 끝난다)
        translateX.setValue(to);
        if (delta !== 0) {
          commit(delta);
        }
        return;
      }
      const duration = Math.max(
        MIN_SLIDE_MS,
        SLIDE_MS * Math.min(1, distance / width),
      );
      const slide: Slide = { from, to, start: Date.now(), duration, delta };
      sliding = slide;
      // 돌던 애니메이션은 멈추고(finished: false) 네이티브가 지금 값에서 이어 간다. JS 의 추정 자리에 먼저 세우면
      // 그사이 앞서간 만큼 뒤로 튄다
      Animated.timing(translateX, {
        toValue: to,
        duration,
        easing: slideEasing,
        useNativeDriver: true,
      }).start(({ finished }) => {
        // 손가락이나 다음 넘김이 이어받았으면 그때 확정했다
        if (!finished || sliding !== slide) {
          return;
        }
        sliding = null;
        if (delta !== 0) {
          commit(delta);
        }
        // 미끄러지는 사이에 폭이 바뀌었으면 옛 폭으로 멈췄다. 지금 페이지 칸에 맞춘다
        if (restAt(current) !== to) {
          translateX.setValue(restAt(current));
        }
      });
    };

    const responder = PanResponder.create({
      // 응답자가 되지는 않고 손가락이 닿을 때마다 이번 손길을 정한다. 화면에 손가락이 하나면 새 손길이라 방향을 비운다
      // (PanResponder 도 이때 dx·dy 를 0 으로 되돌린다). 다른 손가락이 함께 닿아 있으면 그 손길은 방향을 보지 않는다
      onStartShouldSetPanResponderCapture: ({ nativeEvent }) => {
        axis = nativeEvent.touches.length === 1 ? null : 'none';
        return false;
      },
      // 정하기 전에 손가락이 늘면 그 손길은 방향을 보지 않는다
      onMoveShouldSetPanResponder: (_, { dx, dy, numberActiveTouches }) => {
        if (axis === null) {
          axis = numberActiveTouches === 1 ? decidePanAxis(dx, dy) : 'none';
        }
        return axis === 'horizontal';
      },
      onPanResponderGrant: () => {
        // 응답자가 된 뒤로는 다시 묻지 않는다. 다음 손길의 닿는 순간을 못 보더라도(다른 뷰가 응답자일 때) 이 가로 방향을
        // 이어 쓰지 않게 비운다. 닿는 순간을 보면 그때 다시 정한다
        axis = 'none';
        const wasSliding = sliding !== null;
        dragFrom = takeOver();
        // 손가락이 잡은 자리에 세운다 (돌던 애니메이션은 finished: false 로 끝난다)
        if (wasSliding) {
          translateX.setValue(dragFrom);
        }
      },
      // dx 는 응답자가 된 지점부터 잰다. 밀기로 본 거리만큼 튀지 않고 그 자리부터 손가락을 따라간다
      onPanResponderMove: (_, { dx }) => translateX.setValue(dragAt(dx)),
      onPanResponderRelease: (_, { dx, vx }) => {
        const far = Math.abs(dx) >= SWIPE_DISTANCE;
        const flick =
          Math.abs(vx) >= FLICK_VELOCITY && Math.sign(vx) === Math.sign(dx);
        // 왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전
        const delta = !far && !flick ? 0 : dx < 0 ? 1 : -1;
        slideTo(current + delta, dragAt(dx));
      },
      // 밀던 중 리스트 등이 응답자를 달라고 하면 거절한다 (#99)
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: (_, { dx }) => slideTo(current, dragAt(dx)),
    });

    return {
      panHandlers: responder.panHandlers,
      translateX,
      onTrackLayout: ({ nativeEvent }: LayoutChangeEvent) => {
        if (nativeEvent.layout.width === width) {
          return;
        }
        width = nativeEvent.layout.width;
        // 회전 등으로 폭이 바뀌면 지금 페이지 칸으로 옮긴다
        if (!sliding) {
          translateX.setValue(restAt(current));
        }
      },
      slide: (delta: -1 | 1) => {
        const from = takeOver();
        slideTo(current + delta, from);
      },
      // 미끄러지는 중에 화면을 떠나면 멈추고 넘기지 않는다
      stop: () => {
        sliding = null;
        translateX.stopAnimation();
      },
    };
  });
  const { stop, ...api } = swipe;
  useEffect(() => stop, [stop]);

  return { ...api, page };
}
