// #110: Debug 빌드는 맥에서 띄운 로컬 서버(http)에 닿고, Release 는 https 만 쓴다.
// 이미 있는 설정을 지키는 검사다. scripts/lib 모듈이 아니라 실제 iOS·Android 설정 파일을 읽는다 (jest 가 ios/·android/ 아래 테스트를 무시해서 여기에 둔다).
// JS 쪽도 Release 에서 https 가 아닌 API 주소는 쓰지 않는다 (src/shared/api/config.ts)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = file =>
  fs
    .readFileSync(path.join(ROOT, file), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '');

describe('로컬 서버 평문(http) 접속', () => {
  it('iOS ATS: 임의 http 는 막고 로컬 네트워크만 연다', () => {
    const plist = read('ios/DinoApp/Info.plist');
    const ats = plist.match(
      /<key>NSAppTransportSecurity<\/key>\s*<dict>([\s\S]*?)<\/dict>/,
    );

    expect(ats).not.toBeNull();
    expect(ats[1]).toMatch(/<key>NSAllowsArbitraryLoads<\/key>\s*<false\s*\/>/);
    expect(ats[1]).toMatch(/<key>NSAllowsLocalNetworking<\/key>\s*<true\s*\/>/);
    expect(ats[1]).not.toContain('NSExceptionDomains');
  });

  it('Android: 평문 허용은 빌드 종류별 값(debug 만 true)을 따르고 따로 열지 않는다', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    const gradle = read('android/app/build.gradle');

    expect(manifest).toContain(
      'android:usesCleartextTraffic="${usesCleartextTraffic}"',
    );
    expect(manifest).not.toContain('networkSecurityConfig');
    expect(gradle).not.toContain('usesCleartextTraffic');
    expect(
      fs.existsSync(
        path.join(ROOT, 'android/app/src/debug/AndroidManifest.xml'),
      ),
    ).toBe(false);
  });

  it('Android: React Native gradle 플러그인이 debug 는 true, release 는 false 로 채운다', () => {
    const plugin = read(
      'node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/src/main/kotlin/com/facebook/react/utils/AgpConfiguratorUtils.kt',
    );

    expect(plugin).toMatch(
      /getByName\("debug"\)[\s\S]*?usesCleartextTraffic"\] = "true"/,
    );
    expect(plugin).toMatch(
      /getByName\("release"\)[\s\S]*?usesCleartextTraffic"\] = "false"/,
    );
  });
});
