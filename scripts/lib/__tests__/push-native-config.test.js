// #118: 앱 푸시(FCM) 네이티브 설정. Firebase 설정 파일은 저장소에 넣지 않으며, 없어도 빌드되고 푸시만 꺼진다.
// scripts/lib 모듈이 아니라 실제 iOS·Android 설정 파일을 읽는다 (jest 가 ios/·android/ 아래 테스트를 무시해서 여기에 둔다)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = file =>
  fs
    .readFileSync(path.join(ROOT, file), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '');

// 최상위 <dict> 의 키 → 값 본문
function topLevelValue(plist, key) {
  const match = plist.match(
    new RegExp(
      `\\n\\t<key>${key}</key>\\n\\t(<(\\w+)[^>]*>[\\s\\S]*?</\\2>|<\\w+/>)`,
    ),
  );
  return match ? match[1] : null;
}

describe('앱 푸시 — iOS', () => {
  it('Push Notifications capability (aps-environment) 가 있다', () => {
    expect(
      topLevelValue(
        read('ios/DinoApp/DinoApp.entitlements'),
        'aps-environment',
      ),
    ).toBe('<string>development</string>');
  });

  it('Background Modes 에 remote-notification 이 있다', () => {
    expect(
      topLevelValue(read('ios/DinoApp/Info.plist'), 'UIBackgroundModes'),
    ).toContain('<string>remote-notification</string>');
  });

  it('FirebaseApp.configure() 는 번들에 GoogleService-Info.plist 가 있을 때만 부른다', () => {
    const delegate = read('ios/DinoApp/AppDelegate.swift');
    const guard = delegate.indexOf(
      'Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil',
    );

    expect(guard).toBeGreaterThan(-1);
    expect(delegate.indexOf('FirebaseApp.configure()')).toBeGreaterThan(guard);
    expect(delegate.match(/FirebaseApp\.configure\(\)/g)).toHaveLength(1);
  });

  // RNFB messaging 26.4.1 은 didFinishLaunching 알림에서 AppDelegate 의 window 를 확인 없이 읽는다
  // (RNFBMessaging+NSNotificationCenter.m, invertase/react-native-firebase#8796). 창은 SceneDelegate 가 갖지만
  // AppDelegate 가 window 를 선언하지 않으면 unrecognized selector 로 켜자마자 죽는다
  it('AppDelegate 가 window 를 선언한다 (값은 nil, 창은 SceneDelegate)', () => {
    expect(read('ios/DinoApp/AppDelegate.swift')).toMatch(
      /^ {2}var window: UIWindow\?$/m,
    );
  });

  it('설정 파일은 저장소에 없고, 빌드 단계가 있을 때만 번들에 복사한다 (없으면 지난 것도 지운다)', () => {
    expect(read('.gitignore')).toMatch(
      /^ios\/DinoApp\/GoogleService-Info\.plist$/m,
    );
    const pbxproj = read('ios/DinoApp.xcodeproj/project.pbxproj');
    const phase = pbxproj.match(
      /\/\* Copy GoogleService-Info\.plist \*\/ = \{[\s\S]*?shellScript = "([^\n]*)";/,
    );

    expect(phase).not.toBeNull();
    expect(phase[1]).toContain('if [ -f \\"$SRC\\" ]; then');
    expect(phase[1]).toContain('rm -f \\"$DEST\\"');
    // 앱 타깃의 빌드 단계 목록에 있다 (Resources 뒤)
    const phases = pbxproj.match(/buildPhases = \(([\s\S]*?)\);/)[1];
    expect(phases.indexOf('Copy GoogleService-Info.plist')).toBeGreaterThan(
      phases.indexOf('/* Resources */'),
    );
  });

  it('Firebase 는 CocoaPods 로 받고 use_frameworks 없이 필요한 pod 만 모듈로 낸다 (동적 프레임워크 없음)', () => {
    const podfile = read('ios/Podfile');

    expect(podfile).toMatch(/^\$RNFirebaseDisableSPM = true$/m);
    expect(podfile).toMatch(
      /^ {2}pod 'FirebaseCore', :modular_headers => true$/m,
    );
    expect(podfile).toMatch(
      /^ {2}pod 'GoogleUtilities\/\w+', :modular_headers => true$/m,
    );
    // USE_FRAMEWORKS 환경 변수로만 켜는 템플릿 분기 말고는 프레임워크 링크를 강제하지 않는다
    const code = podfile
      .split('\n')
      .filter(line => !line.trimStart().startsWith('#'))
      .join('\n');
    expect(code.match(/use_frameworks!/g)).toHaveLength(1);
    expect(podfile).toMatch(/if linkage != nil\n\s+.*\n\s+use_frameworks!/);
  });

  it('앱이 앞에 있어도 시스템 배너를 띄운다 (firebase.json)', () => {
    const config = JSON.parse(read('firebase.json'))['react-native'];

    expect(config.messaging_ios_foreground_presentation_options).toEqual(
      expect.arrayContaining(['banner', 'list']),
    );
  });
});

describe('앱 푸시 — Android', () => {
  it('google-services 플러그인은 google-services.json 이 있을 때만 건다', () => {
    const gradle = read('android/app/build.gradle');
    const apply = gradle.match(
      /if \(file\("google-services\.json"\)\.exists\(\)\) \{\n\s+apply plugin: "com\.google\.gms\.google-services"\n/,
    );

    expect(apply).not.toBeNull();
    expect(gradle.match(/com\.google\.gms\.google-services/g)).toHaveLength(1);
    expect(read('android/build.gradle')).toMatch(
      /classpath\("com\.google\.gms:google-services:[\d.]+"\)/,
    );
    expect(read('.gitignore')).toMatch(
      /^android\/app\/google-services\.json$/m,
    );
  });

  it('Android 13+ 런타임 알림 권한(POST_NOTIFICATIONS)을 선언한다', () => {
    expect(read('android/app/src/main/AndroidManifest.xml')).toMatch(
      /<uses-permission android:name="android\.permission\.POST_NOTIFICATIONS" \/>/,
    );
  });
});
