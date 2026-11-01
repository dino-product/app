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

/**
 * 화면 폭에 따라 정해지는 크기를 계산하는 기준 폭 (pt). Figma 와 SE 2·3세대·mini 의 기본 폭이다.
 * 320pt(SE 1세대, 확대 디스플레이)는 주간 줄 7칸부터 넘쳐 지금 디자인의 범위 밖이다.
 */
export const LAYOUT_BASE_WIDTH = 375;

/** iOS 글자 크기 설정의 가장 작은 배율 (RCTUtils.mm RCTFontSizeMultiplier). line-height 에도 곱해진다 */
export const MIN_FONT_SCALE = 0.823;

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

/** 가장 작은 글자 설정에서 글자 한 줄의 높이. 글자로 정해지는 크기는 이 값으로 계산한다 */
export function minLineHeight(text: HostElement): number {
  return stylePt(text, 'lineHeight') * MIN_FONT_SCALE;
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
  checkAxis('width', size.width, slop.left, slop.right);
  checkAxis('height', size.height, slop.top, slop.bottom);
}

function checkAxis(
  axis: 'width' | 'height',
  length: number | undefined,
  slopA: number,
  slopB: number,
) {
  if (length === undefined) {
    return;
  }
  const total = length + slopA + slopB;
  if (total < MIN_TOUCH_TARGET) {
    const pt = (value: number) => Number(value.toFixed(2));
    throw new Error(
      `터치 영역 ${axis} ${pt(total)} 가 ${MIN_TOUCH_TARGET} 보다 작다 ` +
        `(크기 ${pt(length)} + hitSlop ${slopA} + ${slopB})`,
    );
  }
}
