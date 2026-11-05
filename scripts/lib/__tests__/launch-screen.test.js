const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

// 런치 화면 배경 = 첫 화면 배경색(colors.background[3]). 다크 모드 미지원(#20)이라 라이트 고정.
const BACKGROUND = read('src/shared/design-system/tokens/colors.ts').match(
  /background:\s*\{[^}]*?3:\s*'(#[0-9A-Fa-f]{6})'/,
)?.[1];

const hexToRgb01 = hex =>
  [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

describe('iOS 런치 화면 (#21)', () => {
  const storyboard = read('ios/DinoApp/LaunchScreen.storyboard');
  const rootColor =
    storyboard.match(/<color key="backgroundColor"[^>]*>/)?.[0] ?? '';

  it('colors.background[3] 값을 읽을 수 있다', () => {
    expect(BACKGROUND).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('RN 템플릿 문구(앱 이름 레이블, Powered by React Native)가 없다', () => {
    expect(storyboard).not.toMatch(/Powered by React Native/);
    expect(storyboard).not.toMatch(/<label\b/);
  });

  it('배경이 systemBackgroundColor 가 아닌 고정 색이다', () => {
    expect(rootColor).not.toBe('');
    expect(rootColor).not.toMatch(/systemColor|cocoaTouchSystemColor/);
  });

  it('고정 색 값이 첫 화면 배경색(colors.background[3])과 같다', () => {
    const channel = name =>
      Number(rootColor.match(new RegExp(`${name}="([^"]+)"`))?.[1]);
    const actual = ['red', 'green', 'blue'].map(channel);

    hexToRgb01(BACKGROUND).forEach((expected, i) => {
      expect(actual[i]).toBeCloseTo(expected, 3);
    });
    expect(rootColor).toMatch(/alpha="1"/);
  });
});

describe('Android 런치 배경 (#21)', () => {
  const RES = 'android/app/src/main/res';
  const colors = fs.existsSync(path.join(ROOT, RES, 'values/colors.xml'))
    ? read(`${RES}/values/colors.xml`)
    : '';
  const styles = read(`${RES}/values/styles.xml`);
  const appTheme =
    styles.match(/<style\s+name="AppTheme"[\s\S]*?<\/style>/)?.[0] ?? '';

  const resolve = value =>
    value?.startsWith('@color/')
      ? colors.match(
          new RegExp(
            `<color\\s+name="${value.slice(
              7,
            )}">\\s*(#[0-9A-Fa-f]{6,8})\\s*</color>`,
          ),
        )?.[1]
      : value;
  const itemValue = name =>
    appTheme.match(
      new RegExp(`<item\\s+name="${name}"[^>]*>\\s*([^<\\s]+)\\s*</item>`),
    )?.[1];

  it('AppTheme 의 windowBackground 가 첫 화면 배경색이다 (스플래시 뒤 빈 화면 방지)', () => {
    expect(resolve(itemValue('android:windowBackground'))).toBe(BACKGROUND);
  });

  it('Android 12+ 시스템 스플래시 배경(windowSplashScreenBackground)도 같은 색이다', () => {
    expect(resolve(itemValue('android:windowSplashScreenBackground'))).toBe(
      BACKGROUND,
    );
  });

  it('core-splashscreen 의존성을 추가하지 않는다 (새 런치 디자인 이슈 몫)', () => {
    expect(read('android/app/build.gradle')).not.toMatch(/core-splashscreen/);
  });
});
