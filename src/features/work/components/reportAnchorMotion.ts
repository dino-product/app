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
        duration: 260,
        easing: Easing.out(Easing.cubic),
      },
      { toValue: 0, duration: 180, easing: Easing.inOut(Easing.quad) },
    ];
  }
  const drop: AnchorKeyframe = {
    toValue: hiddenOffset,
    duration: 240,
    easing: Easing.in(Easing.cubic),
  };
  return interrupted
    ? [drop]
    : [
        {
          toValue: -ANCHOR_ANTICIPATION,
          duration: 120,
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
