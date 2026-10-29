// assets/fonts 의 파일명 = PostScript 이름이라 iOS(UIAppFonts)·Android(assets/fonts) 모두 이 이름으로 찾는다.
// fontWeight 를 같이 주면 Android 가 굵기를 합성하므로 굵기는 패밀리 이름으로만 고른다.
export const fonts = {
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semiBold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
} as const;

export type FontFamily = (typeof fonts)[keyof typeof fonts];
