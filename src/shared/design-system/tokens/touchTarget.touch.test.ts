import { Platform } from 'react-native';
import { MIN_FONT_SCALE, MIN_TOUCH_TARGET } from './touchTarget';

// *.touch.test 는 iOS(npm test)와 Android(npm run test:android) 로 한 번씩 돈다
describe(`터치 영역 기준 (${Platform.OS})`, () => {
  it('최소 터치 영역은 iOS HIG 44pt, Android 접근성 지침 48dp 다', () => {
    expect(MIN_TOUCH_TARGET).toBe(Platform.select({ ios: 44, android: 48 }));
  });

  // iOS: RCTUtils.mm RCTFontSizeMultiplier, Android: AOSP 글꼴 크기 설정의 가장 작은 값
  it('가장 작은 글자 배율은 iOS 0.823, Android 0.85 다', () => {
    expect(MIN_FONT_SCALE).toBe(Platform.select({ ios: 0.823, android: 0.85 }));
  });
});
