import { fonts, type FontFamily } from './fonts';

// Figma Design.v0 › DesignSystem 의 로컬 텍스트 스타일과 이름이 같다.
// Figma 쪽 표기가 섞여 있는 `Semibold` 는 `SemiBold` 로 통일했다.

type TextStyleSpec = {
  font: FontFamily;
  size: number;
  lineHeightPercent: number;
  letterSpacingPercent: number;
};

export type TextStyleToken = {
  fontFamily: FontFamily;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function createTextStyle({
  font,
  size,
  lineHeightPercent,
  letterSpacingPercent,
}: TextStyleSpec): TextStyleToken {
  return {
    fontFamily: font,
    fontSize: size,
    lineHeight: round2((size * lineHeightPercent) / 100),
    letterSpacing: round2((size * letterSpacingPercent) / 100),
  };
}

// 거의 모든 스타일이 행간 140%, 자간 -2.5% 다
const style = (
  font: FontFamily,
  size: number,
  lineHeightPercent = 140,
  letterSpacingPercent = -2.5,
) => createTextStyle({ font, size, lineHeightPercent, letterSpacingPercent });

export const typography = {
  'Title/M': style(fonts.bold, 36),
  'Title/S': style(fonts.bold, 32),

  'Body/XXL/Bold': style(fonts.bold, 28),
  'Body/XL/Bold': style(fonts.bold, 24),
  'Body/XL/SemiBold': style(fonts.semiBold, 24),
  'Body/XL/Medium': style(fonts.medium, 24),
  'Body/L/Bold': style(fonts.bold, 22),
  'Body/M/SemiBold': style(fonts.semiBold, 20),
  'Body/M/Medium': style(fonts.medium, 20),
  'Body/M/Regular': style(fonts.regular, 20),
  'Body/S/Bold': style(fonts.bold, 18),
  'Body/S/SemiBold': style(fonts.semiBold, 18),
  'Body/S/Medium': style(fonts.medium, 18),
  'Body/XS/SemiBold': style(fonts.semiBold, 16),
  'Body/XS/Medium': style(fonts.medium, 16),
  'Body/XS/Regular': style(fonts.regular, 16),

  'Caption/M/SemiBold': style(fonts.semiBold, 14),
  'Caption/M/Medium': style(fonts.medium, 14, 150),
  'Caption/M/Regular': style(fonts.regular, 14, 150),
  'Caption/S/Medium': style(fonts.medium, 12),

  'Button/S': style(fonts.medium, 14, 140, 0),
} as const satisfies Record<string, TextStyleToken>;

export type TypographyVariant = keyof typeof typography;
