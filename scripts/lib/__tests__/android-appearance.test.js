const fs = require('fs');
const path = require('path');

const STYLES_XML = path.resolve(
  __dirname,
  '../../../android/app/src/main/res/values/styles.xml',
);

describe('Android 외관 모드 (#20)', () => {
  const styles = fs.readFileSync(STYLES_XML, 'utf8');
  const appThemeParent = styles.match(
    /<style name="AppTheme" parent="([^"]+)"/,
  )?.[1];

  it('iOS 와 같이 라이트로 고정하므로 앱 테마가 DayNight 가 아닌 Light 계열이다', () => {
    expect(appThemeParent).toBe('Theme.AppCompat.Light.NoActionBar');
  });
});
