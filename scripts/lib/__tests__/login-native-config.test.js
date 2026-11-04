// #113: 카카오·Apple 로그인 네이티브 설정. 카카오 네이티브 앱 키는 저장소에 넣지 않고 빌드 때 주입하며, 없어도 빌드된다.
// scripts/lib 모듈이 아니라 실제 iOS·Android 설정 파일을 읽는다 (jest 가 ios/·android/ 아래 테스트를 무시해서 여기에 둔다)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = file =>
  fs
    .readFileSync(path.join(ROOT, file), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '');

// 최상위 <dict> 의 키 → 값 본문. 안쪽 dict 의 키와 섞이지 않게 바깥 키만 본다
function topLevelValue(plist, key) {
  const match = plist.match(
    new RegExp(
      `\\n\\t<key>${key}</key>\\n\\t(<(\\w+)[^>]*>[\\s\\S]*?</\\2>|<\\w+/>)`,
    ),
  );
  return match ? match[1] : null;
}

describe('카카오 로그인 — iOS', () => {
  const plist = read('ios/DinoApp/Info.plist');

  it('SDK 는 Info.plist 의 KAKAO_APP_KEY 를 빌드 설정 값으로 읽는다', () => {
    expect(topLevelValue(plist, 'KAKAO_APP_KEY')).toBe(
      '<string>$(KAKAO_NATIVE_APP_KEY)</string>',
    );
  });

  it('카카오톡에서 돌아오는 URL scheme kakao{앱 키} 와 카카오톡 호출 스킴을 둔다', () => {
    expect(topLevelValue(plist, 'CFBundleURLTypes')).toContain(
      '<string>kakao$(KAKAO_NATIVE_APP_KEY)</string>',
    );
    const queries = topLevelValue(plist, 'LSApplicationQueriesSchemes');
    expect(queries).toContain('<string>kakaokompassauth</string>');
    expect(queries).toContain('<string>kakaolink</string>');
  });

  it('앱 키는 gitignore 된 Secrets.xcconfig 에서 읽고, 없으면 빈 값으로 빌드된다', () => {
    const xcconfig = read('ios/Config/App.xcconfig');

    expect(xcconfig).toMatch(/^KAKAO_NATIVE_APP_KEY =\s*$/m);
    expect(xcconfig).toMatch(/^#include\? "Secrets\.xcconfig"$/m);
    // 기본값보다 뒤에서 읽어야 넣은 값이 이긴다
    expect(xcconfig.indexOf('#include?')).toBeGreaterThan(
      xcconfig.indexOf('KAKAO_NATIVE_APP_KEY ='),
    );
    expect(read('.gitignore')).toMatch(/^ios\/Config\/Secrets\.xcconfig$/m);
    expect(read('ios/Config/Secrets.example.xcconfig')).toMatch(
      /^KAKAO_NATIVE_APP_KEY = /m,
    );
  });

  it('프로젝트 Debug·Release 가 App.xcconfig 를 물려주고, 타깃은 CocoaPods 설정을 그대로 쓴다', () => {
    const pbxproj = read('ios/DinoApp.xcodeproj/project.pbxproj');
    const baseOf = name =>
      [
        ...pbxproj.matchAll(
          new RegExp(
            `/\\* ${name} \\*/ = \\{\\n\\t\\t\\tisa = XCBuildConfiguration;\\n\\t\\t\\tbaseConfigurationReference = \\w+ /\\* ([^*]+) \\*/;`,
            'g',
          ),
        ),
      ].map(match => match[1]);

    expect(baseOf('Debug').sort()).toEqual([
      'App.xcconfig',
      'Pods-DinoApp.debug.xcconfig',
    ]);
    expect(baseOf('Release').sort()).toEqual([
      'App.xcconfig',
      'Pods-DinoApp.release.xcconfig',
    ]);
  });

  it('카카오톡 로그인에서 돌아온 URL 은 카카오 SDK 가 먼저 받는다', () => {
    const scene = read('ios/DinoApp/SceneDelegate.swift');
    const handler = scene.slice(scene.indexOf('openURLContexts URLContexts'));

    expect(scene).toMatch(/^import kakao_login$/m);
    expect(handler.indexOf('isKakaoTalkLoginUrl')).toBeGreaterThan(-1);
    expect(handler.indexOf('isKakaoTalkLoginUrl')).toBeLessThan(
      handler.indexOf('RCTLinkingManager.scene'),
    );
  });
});

describe('Apple 로그인 — iOS', () => {
  it('Sign in with Apple capability 를 entitlements 로 켠다', () => {
    const entitlements = read('ios/DinoApp/DinoApp.entitlements');
    const pbxproj = read('ios/DinoApp.xcodeproj/project.pbxproj');

    expect(entitlements).toMatch(
      /<key>com\.apple\.developer\.applesignin<\/key>\s*<array>\s*<string>Default<\/string>\s*<\/array>/,
    );
    expect(
      pbxproj.match(
        /CODE_SIGN_ENTITLEMENTS = DinoApp\/DinoApp\.entitlements;/g,
      ),
    ).toHaveLength(2);
  });

  it('Android 에는 연결하지 않는다 (Apple 로그인은 Apple 기기만)', () => {
    const config = require(path.join(ROOT, 'react-native.config.js'));

    expect(
      config.dependencies['@invertase/react-native-apple-authentication'],
    ).toEqual({ platforms: { android: null } });
  });
});

describe('카카오 로그인 — Android', () => {
  const gradle = read('android/app/build.gradle');
  const manifest = read('android/app/src/main/AndroidManifest.xml');

  it('앱 키는 gradle 속성 KAKAO_NATIVE_APP_KEY 에서 읽고, 없으면 빈 값이다', () => {
    expect(gradle).toContain(
      'def kakaoNativeAppKey = findProperty("KAKAO_NATIVE_APP_KEY")?.toString()?.trim() ?: ""',
    );
  });

  it('라이브러리의 예제 키 리소스(kakao_app_key)를 앱 리소스로 덮어쓴다', () => {
    const library = read(
      'node_modules/@react-native-seoul/kakao-login/android/src/main/res/values/kakao_strings.xml',
    );

    // 라이브러리는 예제 키를 담아 배포한다. 덮어쓰지 않으면 남의 앱 키로 로그인한다
    expect(library).toMatch(/<string name="kakao_app_key">\w+<\/string>/);
    expect(gradle).toContain(
      'resValue "string", "kakao_app_key", kakaoNativeAppKey',
    );
    // 같은 이름을 앱 res/values 에 또 두면 리소스가 겹친다
    expect(read('android/app/src/main/res/values/strings.xml')).not.toContain(
      'kakao_app_key',
    );
  });

  it('카카오계정 로그인 리다이렉트 kakao{앱 키}://oauth 를 받는 액티비티를 둔다', () => {
    expect(gradle).toContain(
      'manifestPlaceholders["kakaoScheme"] = "kakao${kakaoNativeAppKey}"',
    );
    const activity = manifest.match(
      /<activity\s+android:name="com\.kakao\.sdk\.auth\.AuthCodeHandlerActivity"[\s\S]*?<\/activity>/,
    );
    expect(activity).not.toBeNull();
    expect(activity[0]).toContain('android:exported="true"');
    expect(activity[0]).toContain('android.intent.category.BROWSABLE');
    expect(activity[0]).toMatch(
      /<data android:host="oauth" android:scheme="\$\{kakaoScheme\}" \/>/,
    );
  });
});
