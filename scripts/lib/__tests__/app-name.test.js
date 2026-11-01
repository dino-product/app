// 앱 이름은 Orbit 이다. 사용자에게 보이는 이름만 검사한다.
// 번들 ID(com.dinoproduct.app)와 내부 이름(Xcode 타깃·JS 모듈 DinoApp)은 보이지 않아 그대로 둔다 (#49)
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..', '..');
const read = file =>
  fs
    .readFileSync(path.join(root, file), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '');
const list = dir => fs.readdirSync(path.join(root, dir));

const APP_NAME = 'Orbit';
const BUNDLE_ID = 'com.dinoproduct.app';
const ANDROID_RES = 'android/app/src/main/res';

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

  it('iOS 표시 이름을 Info.plist 밖(빌드 설정·InfoPlist.strings)에서 덮어쓰지 않는다', () => {
    expect(read('ios/DinoApp.xcodeproj/project.pbxproj')).not.toMatch(
      /INFOPLIST_KEY_CFBundleDisplayName/,
    );
    const localized = list('ios/DinoApp').flatMap(entry =>
      entry.endsWith('.lproj')
        ? list(`ios/DinoApp/${entry}`).map(file => `${entry}/${file}`)
        : entry.endsWith('.xcstrings')
        ? [entry]
        : [],
    );
    expect(
      localized.filter(file =>
        read(`ios/DinoApp/${file}`).includes('CFBundleDisplayName'),
      ),
    ).toEqual([]);
  });

  it('Android 홈 화면 이름(app_name)이 모든 리소스 폴더에서 Orbit 이다', () => {
    const values = list(ANDROID_RES)
      .filter(dir => dir === 'values' || dir.startsWith('values-'))
      .flatMap(dir =>
        list(`${ANDROID_RES}/${dir}`)
          .filter(file => file.endsWith('.xml'))
          .map(file => read(`${ANDROID_RES}/${dir}/${file}`)),
      )
      .flatMap(xml => [
        ...xml.matchAll(
          /<string\b[^>]*\bname="app_name"[^>]*>([^<]*)<\/string>/g,
        ),
      ])
      .map(match => match[1]);

    expect(values).toEqual([APP_NAME]);
  });

  it('Android Manifest 의 라벨은 모두 app_name 을 쓴다', () => {
    const labels = [
      ...read('android/app/src/main/AndroidManifest.xml').matchAll(
        /android:label="([^"]*)"/g,
      ),
    ].map(match => match[1]);

    expect(labels.length).toBeGreaterThan(0);
    expect(new Set(labels)).toEqual(new Set(['@string/app_name']));
  });

  // displayName 은 빌드·실행에 쓰이지 않는다 (RN CLI init 템플릿 값). 문서 일관성용
  it('app.json 의 표시 이름이 Orbit 이다', () => {
    expect(JSON.parse(read('app.json')).displayName).toBe(APP_NAME);
  });

  // 라벨을 지우는 런치 화면 재디자인(#21)에도 깨지지 않게 글자 대신 파일 전체를 본다
  it('런치 화면에 예전 이름(Dino)이 없다', () => {
    const storyboard = read('ios/DinoApp/LaunchScreen.storyboard');

    expect(storyboard).toMatch(/<document\b[^>]*\blaunchScreen="YES"/);
    expect(storyboard).not.toMatch(/dino/i);
  });

  // 첫 업로드 뒤에는 바꿀 수 없고, 이미 설치된 앱을 덮어쓰려면 같아야 한다
  it('번들 ID 는 com.dinoproduct.app 그대로다', () => {
    const iosIds = [
      ...read('ios/DinoApp.xcodeproj/project.pbxproj').matchAll(
        /PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g,
      ),
    ].map(match => match[1].replace(/^"(.*)"$/, '$1'));
    const androidIds = [
      ...read('android/app/build.gradle').matchAll(
        /applicationId\s+"([^"]+)"/g,
      ),
    ].map(match => match[1]);

    expect(iosIds.length).toBeGreaterThan(0);
    expect(new Set(iosIds)).toEqual(new Set([BUNDLE_ID]));
    expect(androidIds).toEqual([BUNDLE_ID]);
  });
});
