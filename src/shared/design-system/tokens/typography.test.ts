import { fonts } from './fonts';
import { createTextStyle, typography } from './typography';

describe('createTextStyle', () => {
  it('Figma 의 % 행간·자간을 px 로 환산한다', () => {
    expect(
      createTextStyle({
        font: fonts.bold,
        size: 18,
        lineHeightPercent: 140,
        letterSpacingPercent: -2.5,
      }),
    ).toEqual({
      fontFamily: 'Pretendard-Bold',
      fontSize: 18,
      lineHeight: 25.2,
      letterSpacing: -0.45,
    });
  });

  it('부동소수 오차를 소수 둘째 자리에서 정리한다', () => {
    const style = createTextStyle({
      font: fonts.medium,
      size: 14,
      lineHeightPercent: 140,
      letterSpacingPercent: -2.5,
    });

    expect(style.lineHeight).toBe(19.6);
    expect(style.letterSpacing).toBe(-0.35);
  });
});

describe('typography', () => {
  it('Figma 텍스트 스타일 이름으로 찾을 수 있다', () => {
    expect(typography['Title/M']).toEqual({
      fontFamily: 'Pretendard-Bold',
      fontSize: 36,
      lineHeight: 50.4,
      letterSpacing: -0.9,
    });
    expect(typography['Caption/M/Regular']).toEqual({
      fontFamily: 'Pretendard-Regular',
      fontSize: 14,
      lineHeight: 21,
      letterSpacing: -0.35,
    });
  });

  it('Button/S 는 자간이 0 이다', () => {
    expect(typography['Button/S'].letterSpacing).toBe(0);
  });
});
