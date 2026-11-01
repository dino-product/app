import { Platform } from 'react-native';
import { typography, type TypographyVariant } from './typography';

// 터치 영역(보이는 크기 + hitSlop)의 기준. 작은 요소는 보이는 크기를 Figma 대로 두고 hitSlop 으로 넓힌다.
// 컴포넌트의 hitSlop 계산과 테스트 헬퍼(src/shared/testing/touchTarget.ts)가 같이 쓴다.

/** 최소 터치 영역. iOS HIG 44pt, Android 접근성 지침 48dp */
export const MIN_TOUCH_TARGET = Platform.select({ android: 48, default: 44 });

/**
 * 글자 크기 설정의 가장 작은 배율. line-height 에도 곱해진다.
 * iOS 는 RCTUtils.mm RCTFontSizeMultiplier, Android 는 AOSP 글꼴 크기 설정의 가장 작은 값이다 (기기마다 다르다).
 */
export const MIN_FONT_SCALE = Platform.select({
  android: 0.85,
  default: 0.823,
});

/** 가장 작은 글자 설정에서 타이포 한 줄의 높이. 글자로 정해지는 크기는 이 값으로 계산한다 (테스트 헬퍼의 minLineHeight 와 같은 값) */
export const smallestLineHeight = (variant: TypographyVariant) =>
  typography[variant].lineHeight * MIN_FONT_SCALE;

/** 길이 length 를 최소 터치 영역까지 채우도록 양쪽에 같이 줄 hitSlop. 정수로 올리고, 넉넉하면 0 이다 */
export const touchSlop = (length: number) =>
  Math.max(0, Math.ceil((MIN_TOUCH_TARGET - length) / 2));

/** 기본 크기(24) 아이콘 하나만 든 버튼의 hitSlop. 아이콘이 더 크면(알림 26) 터치 영역도 그만큼 크다 */
export const ICON_HIT_SLOP = touchSlop(24);
