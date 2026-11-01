// 앱 이름은 Orbit 이다. 사용자에게 보이는 이름만 검사한다.
// 번들 ID(com.dinoproduct.app)와 내부 이름(Xcode 타깃·JS 모듈 DinoApp)은 보이지 않아 그대로 둔다 (#49)
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..', '..');
const read = file =>
  fs
    .readFileSync(path.join(root, file), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '');

const APP_NAME = 'Orbit';

describe('앱 이름 (#49)', () => {
  it('iOS 홈 화면 이름(CFBundleDisplayName)이 Orbit 이다', () => {
    const plist = read('ios/DinoApp/Info.plist');
    const values = [
      ...plist.matchAll(
        /<key>CFBundleDisplayName<\/key>\s*<string>([^<]*)<\/string>/g,
      ),
    ].map(match => match[1]);

    expect(values).toEqual([APP_NAME]);
  });

  it('Android 홈 화면 이름(app_name)이 Orbit 이다', () => {
    const strings = read('android/app/src/main/res/values/strings.xml');
    const values = [
      ...strings.matchAll(/<string\s+name="app_name"[^>]*>([^<]*)<\/string>/g),
    ].map(match => match[1]);

    expect(values).toEqual([APP_NAME]);
  });

  it('app.json 의 표시 이름이 Orbit 이다', () => {
    expect(JSON.parse(read('app.json')).displayName).toBe(APP_NAME);
  });

  it('런치 화면 글자에 예전 이름(Dino)이 없다', () => {
    const texts = [
      ...read('ios/DinoApp/LaunchScreen.storyboard').matchAll(
        /\stext="([^"]*)"/g,
      ),
    ].map(match => match[1]);

    expect(texts).toContain(APP_NAME);
    expect(texts.filter(text => /dino/i.test(text))).toEqual([]);
  });
});
