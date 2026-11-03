// 화면에 보이는 앱 버전(src/app/appVersion.ts 의 APP_VERSION)은 JS 상수다 (#72).
// 스토어에 올라가는 버전(iOS MARKETING_VERSION, Android versionName)과 어긋나지 않게 네이티브 빌드 설정 파일을 읽어 비교한다.
// 버전을 올릴 때 세 곳을 함께 바꾼다
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..', '..');
const read = file =>
  fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

const appVersion = () => {
  const match = /export const APP_VERSION = '([^']+)';/.exec(
    read('src/app/appVersion.ts'),
  );
  if (!match) {
    throw new Error('src/app/appVersion.ts 에서 APP_VERSION 을 찾지 못했다');
  }
  return match[1];
};

describe('앱 버전 (#72)', () => {
  it('iOS 모든 빌드 구성의 MARKETING_VERSION 과 같다', () => {
    const versions = [
      ...read('ios/DinoApp.xcodeproj/project.pbxproj').matchAll(
        /MARKETING_VERSION = ([^;]+);/g,
      ),
    ].map(match => match[1].replace(/^"(.*)"$/, '$1'));

    expect(versions.length).toBeGreaterThan(0);
    expect(new Set(versions)).toEqual(new Set([appVersion()]));
  });

  it('iOS Info.plist 가 MARKETING_VERSION 을 그대로 쓴다', () => {
    expect(read('ios/DinoApp/Info.plist')).toMatch(
      /<key>CFBundleShortVersionString<\/key>\s*<string>\$\(MARKETING_VERSION\)<\/string>/,
    );
  });

  it('Android versionName 과 같다', () => {
    const versions = [
      ...read('android/app/build.gradle').matchAll(/versionName\s+"([^"]+)"/g),
    ].map(match => match[1]);

    expect(versions).toEqual([appVersion()]);
  });
});
