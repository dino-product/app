import type { ViewStyle } from 'react-native';

/** 시스템이 화면 한쪽 가장자리마다 받아 주는 제외 영역의 세로 길이 (dp, View.setSystemGestureExclusionRects) */
const MAX_EXCLUSION_HEIGHT = 200;

/**
 * 부모 안 top 에서 height 만큼의 가로 띠를 좌우로 edgeInset 만큼 바깥까지 넓힌 자리.
 * 부모가 화면 가장자리에서 edgeInset 만큼 들어가 있으면 띠가 가장자리 뒤로 가기 영역을 덮는다.
 * 200dp 를 넘는 띠는 위쪽 200dp 만 남긴다 (넘겨 주면 시스템은 아래쪽 200dp 만 받는다).
 * height 를 빼면 부모 아래 끝까지다.
 */
export function gestureExclusionStyle({
  edgeInset,
  top = 0,
  height,
}: {
  edgeInset: number;
  top?: number;
  height?: number;
}): ViewStyle {
  return {
    position: 'absolute',
    left: -edgeInset,
    right: -edgeInset,
    top,
    ...(height === undefined
      ? { bottom: 0, maxHeight: MAX_EXCLUSION_HEIGHT }
      : { height: Math.min(height, MAX_EXCLUSION_HEIGHT) }),
  };
}
