import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  type GestureResponderEvent,
  type GestureResponderHandlers,
  type PanResponderGestureState,
} from 'react-native';
import { trackHesitation, type HesitationTracker } from './swipeHesitation';
import type { TabCoverDrag } from './tabCover';
import { decideTabTrack, switchDistanceFor, switchOnRelease } from './tabSwipe';

// 메인 탭 덮기 밀기 엔진 (#216). 응답자 잡기는 useSwipeSwitch(#140)와 같다: 닿을 때는 응답자가 되지 않고, 한 손가락이
// 가로로 정해지면(8pt) bubble 단계에서 응답자가 된다. 그 뒤로는 놓을 때까지 손가락 거리를 덮기(TabCoverDrag)에 넘기기만 하고,
// 놓을 때 바꿀지 정한다 (이어 밀었으면 8pt, 망설였으면 화면 폭 절반, tabSwipe.ts · swipeHesitation.ts).
// 미는 동안에는 응답자를 놓아 주지 않는다 (세로 리스트가 가져가 스크롤하지 못하게). onTrackingChange 로 리스트 스크롤을 잠근다.
// 손가락이 가만히 있으면 이동 이벤트가 오지 않으므로 멈춤은 타이머로 본다. 시각은 이벤트 시각(nativeEvent.timestamp)으로 잰다

export type TabCoverSwipe = {
  panHandlers: GestureResponderHandlers;
  /** 미는 뷰의 onTouchStartCapture. 첫 손가락이 닿을 때 제스처를 새로 시작한다 */
  onTouchStartCapture: (event: GestureResponderEvent) => void;
};

export function useTabCoverSwipe(options: {
  /** 이번 제스처를 받을 수 있는지. 가로로 정해지기 전 이동마다 묻고, false 면 그 제스처는 끝까지 받지 않는다 */
  canSwipe: () => boolean;
  cover: TabCoverDrag | null;
  /** 덮기를 시작하고(true) 끝낼 때(false) */
  onTrackingChange?: (tracking: boolean) => void;
}): TabCoverSwipe {
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  const [swipe] = useState(() => {
    const gesture = {
      /** 이번 제스처는 판정이 끝났다 (받지 않거나, 이미 끝냈다) */
      settled: false,
      /** 응답자가 되기까지 움직인 거리. 응답자가 되면 PanResponder 가 dx 를 0 부터 다시 잰다 */
      claimedAt: 0,
      /** 첫 손가락이 닿은 시각 (이벤트 시각) */
      touchedAt: null as number | null,
      /** 이번 손길을 받은 덮기. 응답자가 되기로 한 뒤부터 있다 */
      cover: null as TabCoverDrag | null,
      /** 응답자가 되기로 한 순간. 응답자가 되면(grant) 덮기를 시작한다 */
      claim: null as { t: number; dx: number } | null,
      tracker: null as HesitationTracker | null,
      dx: 0,
      /** 마지막 이벤트 시각과 그때의 벽시계. 타이머에서 이벤트 시각을 잇는다 */
      clock: { event: 0, wall: 0 },
      timer: null as ReturnType<typeof setTimeout> | null,
      due: null as number | null,
    };
    /** 타이머가 이만큼(ms) 넘게 늦게 불리면 JS 가 막혀 있었던 것이다 (밀려 있던 이동을 먼저 본다) */
    const LATE_MS = 32;
    const FRAME_MS = 16;
    const width = () => Dimensions.get('window').width;
    const switchDistance = () =>
      switchDistanceFor(gesture.tracker?.hesitation != null, width());
    const now = () => gesture.clock.event + (Date.now() - gesture.clock.wall);
    const stamp = (event: GestureResponderEvent) => {
      gesture.clock = { event: event.nativeEvent.timestamp, wall: Date.now() };
      return gesture.clock.event;
    };
    const stopTimer = () => {
      if (gesture.timer !== null) {
        clearTimeout(gesture.timer);
        gesture.timer = null;
      }
      gesture.due = null;
    };
    // 멈춤을 볼 시각에 타이머를 건다. 손가락이 흔들림 폭 밖으로 움직이면 다시 건다.
    // 타이머가 늦게 불렸으면(처음 여는 탭을 그리느라 JS 가 막혔다) 그사이 밀려 있던 이동이 아직 안 왔을 수 있어,
    // 한 프레임 뒤에 다시 본다 (그 이동이 먼저 들어와 기준점을 옮긴다)
    const armHold = (delay?: number) => {
      const due = gesture.tracker?.holdDueAt() ?? null;
      if (delay === undefined && due === gesture.due) {
        return;
      }
      stopTimer();
      if (due === null) {
        return;
      }
      gesture.due = due;
      const wait = delay ?? Math.max(0, due - now());
      const expected = Date.now() + wait;
      gesture.timer = setTimeout(() => {
        gesture.timer = null;
        gesture.due = null;
        if (!gesture.tracker || !gesture.cover) {
          return;
        }
        if (Date.now() - expected > LATE_MS) {
          armHold(FRAME_MS);
        } else if (gesture.tracker.check(now())) {
          gesture.cover.move(gesture.dx, switchDistance());
        } else {
          armHold();
        }
      }, wait);
    };
    const finish = () => {
      stopTimer();
      const cover = gesture.cover;
      const tracking = gesture.tracker !== null;
      gesture.cover = null;
      gesture.claim = null;
      gesture.tracker = null;
      gesture.settled = true;
      if (tracking) {
        latest.current.onTrackingChange?.(false);
      }
      return cover;
    };
    const cancel = () => finish()?.cancel();
    // 응답자가 된 뒤 첫 이동에서 덮기를 시작한다. RN 은 새 응답자에게 grant 를 먼저 보내고 지금 응답자가 놓아 주지 않으면
    // 곧바로 reject 를 보내므로, grant 에서 시작하면 거절된 손길에도 이웃 탭을 그리고 되돌리는 동안 다음 밀기가 막힌다
    const start = () => {
      const { cover, claim } = gesture;
      if (!cover || !claim) {
        return;
      }
      gesture.tracker = trackHesitation(
        claim.t,
        claim.dx,
        gesture.touchedAt === null ? undefined : { t: gesture.touchedAt, x: 0 },
      );
      latest.current.onTrackingChange?.(true);
      cover.move(claim.dx, switchDistance());
      armHold();
    };
    const totalDx = ({ dx }: PanResponderGestureState) =>
      gesture.claimedAt + dx;

    const responder = PanResponder.create({
      onMoveShouldSetPanResponder: (event, { dx, dy, numberActiveTouches }) => {
        if (gesture.settled) {
          return false;
        }
        if (!latest.current.canSwipe()) {
          gesture.settled = true;
          return false;
        }
        const decision = decideTabTrack({
          dx,
          dy,
          touches: numberActiveTouches,
        });
        if (decision === 'wait') {
          return false;
        }
        const cover = latest.current.cover;
        if (decision === 'ignore' || !cover?.begin()) {
          gesture.settled = true;
          return false;
        }
        gesture.claimedAt = dx;
        gesture.cover = cover;
        gesture.dx = dx;
        gesture.claim = { t: stamp(event), dx };
        return true;
      },
      // 지금 응답자(안쪽 리스트 등)가 놓아 주지 않았다. 이번 제스처는 그쪽 몫이다
      onPanResponderReject: cancel,
      onPanResponderTerminationRequest: () => gesture.cover === null,
      onPanResponderMove: (event, state) => {
        if (!gesture.cover) {
          return;
        }
        if (!gesture.tracker) {
          start();
        }
        if (!gesture.tracker) {
          return;
        }
        if (state.numberActiveTouches > 1) {
          cancel();
          return;
        }
        gesture.dx = totalDx(state);
        gesture.tracker.move(stamp(event), gesture.dx);
        gesture.cover.move(gesture.dx, switchDistance());
        armHold();
      },
      onPanResponderRelease: (event, state) => {
        if (gesture.cover && !gesture.tracker) {
          start();
        }
        if (!gesture.tracker) {
          return;
        }
        const dx = totalDx(state);
        const hesitation = gesture.tracker.release(stamp(event), dx);
        const commit = switchOnRelease({
          distance: dx,
          hesitant: hesitation !== null,
          windowWidth: width(),
        });
        finish()?.end(dx, commit);
      },
      onPanResponderTerminate: cancel,
    });
    return {
      panHandlers: responder.panHandlers,
      onTouchStartCapture: ({ nativeEvent }: GestureResponderEvent) => {
        // 이번에 닿은 손가락 말고 다른 손가락이 이미 닿아 있으면 두 손가락 이상이다. 덮는 중이었으면 원래대로
        const multiple =
          nativeEvent.touches.length > nativeEvent.changedTouches.length;
        if (multiple || gesture.cover) {
          cancel();
        }
        gesture.settled = multiple;
        gesture.touchedAt =
          typeof nativeEvent.timestamp === 'number'
            ? nativeEvent.timestamp
            : null;
      },
      cancel,
    };
  });
  // 화면이 사라지면 덮던 것을 되돌린다
  useEffect(() => swipe.cancel, [swipe]);
  return swipe;
}
