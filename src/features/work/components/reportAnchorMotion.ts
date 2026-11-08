import { Animated, Easing, type EasingFunction } from 'react-native';

// '완료 보고 작성하기' 앵커의 카툰 등장·퇴장 (#149). 움직이는 값은 앵커가 제자리에서 아래로 내려간 거리(pt)다.
// 0 이 제자리, 양수는 아래(숨는 쪽), 음수는 제자리보다 위로 넘친 것이다.
// 나타날 때: 아래에서 불쑥 올라와 관성으로 OVERSHOOT 만큼 위로 넘쳤다가 제자리로 내려앉는다.
// 사라질 때: ANTICIPATION 만큼 위로 살짝 떴다가 아래로 쑤욱 빠진다.
// 단계마다 따로 시작하는 네이티브 애니메이션이라, 도중에 멈추고 반대로 시작하면 네이티브 값의 지금 자리에서 이어진다

/** 나타날 때 제자리보다 위로 넘치는 거리 */
export const ANCHOR_OVERSHOOT = 12;
/** 사라지기 전에 위로 뜨는 거리 */
export const ANCHOR_ANTICIPATION = 8;
/** 나타날 때 넘친 자리까지 올라오는 시간 / 제자리로 내려앉는 시간 (ms) */
const ANCHOR_RISE_MS = 260;
const ANCHOR_SETTLE_MS = 180;
/** 사라질 때 위로 뜨는 시간 / 아래로 빠지는 시간 (ms) */
const ANCHOR_LIFT_MS = 120;
const ANCHOR_DROP_MS = 240;

export type AnchorKeyframe = {
  toValue: number;
  duration: number;
  easing: EasingFunction;
};

/**
 * 등장·퇴장 키프레임 (차례대로 이어 돈다).
 * interrupted 는 반대 방향 애니메이션이 아직 도는 중에 바뀐 경우다. 올라오던 중에 숨으면 위로 더 뜨지 않고 바로 내려간다
 */
export function anchorKeyframes(
  visible: boolean,
  hiddenOffset: number,
  interrupted = false,
): AnchorKeyframe[] {
  if (visible) {
    return [
      {
        toValue: -ANCHOR_OVERSHOOT,
        duration: ANCHOR_RISE_MS,
        easing: Easing.out(Easing.cubic),
      },
      {
        toValue: 0,
        duration: ANCHOR_SETTLE_MS,
        easing: Easing.inOut(Easing.quad),
      },
    ];
  }
  const drop: AnchorKeyframe = {
    toValue: hiddenOffset,
    duration: ANCHOR_DROP_MS,
    easing: Easing.in(Easing.cubic),
  };
  return interrupted
    ? [drop]
    : [
        {
          toValue: -ANCHOR_ANTICIPATION,
          duration: ANCHOR_LIFT_MS,
          easing: Easing.out(Easing.quad),
        },
        drop,
      ];
}

/** 키프레임을 UI 스레드(네이티브 드라이버)에서 차례로 돈다 */
export function anchorAnimation(
  offset: Animated.Value,
  visible: boolean,
  hiddenOffset: number,
  interrupted = false,
): Animated.CompositeAnimation {
  return Animated.sequence(
    anchorKeyframes(visible, hiddenOffset, interrupted).map(frame =>
      Animated.timing(offset, { ...frame, useNativeDriver: true }),
    ),
  );
}

/**
 * 버튼 뒤 그라데이션이 따라갈 값. 같은 값으로 함께 내려가고 올라오되 제자리보다 위로는 가지 않는다
 * (넘칠 때 그라데이션 아래 끝이 들려 틈이 보이지 않게). 네이티브 드라이버로 함께 돈다
 */
export function fadeFollowing(
  offset: Animated.Value,
  hiddenOffset: number,
): Animated.AnimatedInterpolation<number> {
  return offset.interpolate({
    inputRange: [0, hiddenOffset],
    outputRange: [0, hiddenOffset],
    extrapolateLeft: 'clamp',
  });
}
