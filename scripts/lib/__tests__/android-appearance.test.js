const fs = require('fs');
const path = require('path');

const MAIN_DIR = path.resolve(__dirname, '../../../android/app/src/main');
const RES_DIR = path.join(MAIN_DIR, 'res');
const read = file => fs.readFileSync(file, 'utf8');

const APP_THEME_BLOCK = /<style\s+name="AppTheme"[\s\S]*?<\/style>/;

describe('Android 외관 모드 (#20)', () => {
  const styles = read(path.join(RES_DIR, 'values/styles.xml'));
  const appTheme = styles.match(APP_THEME_BLOCK)?.[0] ?? '';

  it('iOS 와 같이 라이트로 고정하므로 앱 테마가 DayNight 가 아닌 Light 계열이다', () => {
    const parent = appTheme.match(/\sparent="([^"]+)"/)?.[1] ?? '';

    expect(parent).toMatch(/\.Light(\.|$)/);
    expect(parent).not.toMatch(/DayNight/);
  });

  it('OEM·개발자 옵션의 강제 다크(force dark)로 화면이 반전되지 않게 막는다', () => {
    expect(appTheme).toMatch(
      /<item\s+name="android:forceDarkAllowed"[^>]*>\s*false\s*<\/item>/,
    );
  });

  it('다른 리소스 한정자(values-night 등)에서 AppTheme 를 다시 정의하지 않는다', () => {
    const overrides = fs
      .readdirSync(RES_DIR)
      .filter(dir => dir.startsWith('values-'))
      .flatMap(dir =>
        fs
          .readdirSync(path.join(RES_DIR, dir))
          .filter(file => file.endsWith('.xml'))
          .map(file => path.join(dir, file)),
      )
      .filter(file => APP_THEME_BLOCK.test(read(path.join(RES_DIR, file))));

    expect(overrides).toEqual([]);
  });

  it('Manifest 의 모든 테마가 AppTheme 다', () => {
    const themes = [
      ...read(path.join(MAIN_DIR, 'AndroidManifest.xml')).matchAll(
        /android:theme="([^"]+)"/g,
      ),
    ].map(match => match[1]);

    expect(themes).toEqual(['@style/AppTheme']);
  });

  it('AppCompat 야간 모드를 꺼서 내비게이션 바·Appearance 도 기기 다크 모드를 따르지 않는다', () => {
    const app = read(
      path.join(MAIN_DIR, 'java/com/dinoproduct/app/MainApplication.kt'),
    );
    const nightModeOff = app.search(
      /AppCompatDelegate\.setDefaultNightMode\(\s*AppCompatDelegate\.MODE_NIGHT_NO\s*\)/,
    );

    expect(nightModeOff).toBeGreaterThan(app.indexOf('super.onCreate()'));
    // 첫 Activity 가 만들어지기 전에 정해야 처음부터 라이트로 뜬다
    expect(nightModeOff).toBeLessThan(app.indexOf('loadReactNative(this)'));
  });
});
