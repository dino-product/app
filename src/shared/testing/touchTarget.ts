import type { screen } from '@testing-library/react-native';
import {
  StyleSheet,
  type Insets,
  type StyleProp,
  type TextStyle,
} from 'react-native';

// 터치 영역(보이는 크기 + hitSlop) 검사용 테스트 헬퍼.
// 테스트 렌더러에는 레이아웃이 없으므로 크기는 스타일과 타이포 line-height 로 계산해 넘긴다.

export type HostElement = ReturnType<typeof screen.getByRole>;

/** HIG 최소 터치 영역 (pt) */
export const MIN_TOUCH_TARGET = 44;

/** 지원하는 가장 좁은 iPhone 의 화면 폭 (SE 2·3세대, mini) */
export const NARROWEST_IPHONE_WIDTH = 375;

export type Edges = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/** hitSlop 을 네 변의 값으로 푼다. 숫자 하나면 네 변이 같고, 빠진 변은 0 이다 */
export function hitSlopOf(element: HostElement): Edges {
  const slop: number | Insets | null | undefined = element.props.hitSlop;
  if (typeof slop === 'number') {
    return { top: slop, bottom: slop, left: slop, right: slop };
  }
  return {
    top: slop?.top ?? 0,
    bottom: slop?.bottom ?? 0,
    left: slop?.left ?? 0,
    right: slop?.right ?? 0,
  };
}

/** 펼친 스타일에서 pt 값을 읽는다. 없으면 0 */
export function stylePt(element: HostElement, key: keyof TextStyle): number {
  const style = StyleSheet.flatten(element.props.style as StyleProp<TextStyle>);
  const value: unknown = style?.[key];
  if (value === undefined) {
    return 0;
  }
  if (typeof value !== 'number') {
    throw new Error(`${key} 가 pt 숫자가 아니다: ${String(value)}`);
  }
  return value;
}

/**
 * 보이는 크기에 hitSlop 을 더한 터치 영역이 44×44pt 이상인지 확인한다.
 * 라벨 폭처럼 글자에 따라 정해져 계산할 수 없는 축은 생략한다.
 */
export function expectMinTouchTarget(
  element: HostElement,
  size: { width?: number; height?: number },
) {
  const slop = hitSlopOf(element);
  if (size.width !== undefined) {
    expect(size.width + slop.left + slop.right).toBeGreaterThanOrEqual(
      MIN_TOUCH_TARGET,
    );
  }
  if (size.height !== undefined) {
    expect(size.height + slop.top + slop.bottom).toBeGreaterThanOrEqual(
      MIN_TOUCH_TARGET,
    );
  }
}
