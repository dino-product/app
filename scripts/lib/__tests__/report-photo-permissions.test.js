// #111 완료 보고 사진(촬영·앨범)의 권한 설정.
// scripts/lib 모듈이 아니라 실제 iOS·Android 설정 파일을 읽어 검사한다. jest 가 ios/·android/ 아래 테스트를 무시해서 여기에 둔다.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = (...segments) =>
  fs.readFileSync(path.join(ROOT, ...segments), 'utf8').replace(/\r\n/g, '\n');
const withoutComments = xml => xml.replace(/<!--[\s\S]*?-->/g, '');

const infoPlist = withoutComments(read('ios', 'DinoApp', 'Info.plist'));
const manifest = withoutComments(
  read('android', 'app', 'src', 'main', 'AndroidManifest.xml'),
);

const HANGUL = /[가-힣]/;

function plistString(key) {
  return infoPlist.match(
    new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`),
  )?.[1];
}

const usesPermissions = () =>
  [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map(
    match => match[1],
  );

// <uses-feature android:name="..." android:required="..." /> 를 이름 → required 로 모은다
const usesFeatures = () =>
  Object.fromEntries(
    [...manifest.matchAll(/<uses-feature\s[^>]*>/g)].map(([tag]) => [
      tag.match(/android:name="([^"]+)"/)?.[1],
      tag.match(/android:required="([^"]+)"/)?.[1],
    ]),
  );

describe('iOS 권한 문구 (#111)', () => {
  // 앱 지역 설정이 ko 뿐이라(#22) Info.plist 문구가 그대로 권한 대화상자에 나온다.
  // 앨범(PHPicker)은 권한을 묻지 않지만 라이브러리가 사진 보관함 권한 API 를 링크해 문구가 없으면 심사에서 거절된다
  it.each(['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription'])(
    '%s 를 한국어로 둔다',
    key => {
      const text = plistString(key);

      expect(text).toBeDefined();
      expect(text).toMatch(HANGUL);
    },
  );
});

describe('Android 카메라 권한 (#111)', () => {
  // 선언하지 않은 권한은 런타임으로 요청해도 묻지 않고 바로 거부된다.
  // 선언하면 react-native-image-picker 는 허용받기 전까지 카메라 앱을 열지 않으므로 촬영 전에 받는다 (photoPicker)
  it('CAMERA 를 선언해 촬영 전에 런타임으로 받을 수 있게 한다', () => {
    expect(usesPermissions()).toContain('android.permission.CAMERA');
  });

  // CAMERA 권한은 Google Play 에서 카메라 하드웨어(후면·자동 초점) 필수로 읽힌다. 앨범만으로도 보고를 쓸 수 있다
  it('카메라가 없는 기기도 설치할 수 있게 카메라 하드웨어를 필수로 두지 않는다', () => {
    expect(usesFeatures()).toEqual(
      expect.objectContaining({
        'android.hardware.camera': 'false',
        'android.hardware.camera.autofocus': 'false',
      }),
    );
  });

  it('앨범은 Photo Picker 라 저장소·미디어 읽기 권한을 두지 않는다', () => {
    expect(usesPermissions()).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /\.(READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|READ_MEDIA_IMAGES|READ_MEDIA_VISUAL_USER_SELECTED)$/,
        ),
      ]),
    );
  });
});

// minSdk 24 라 시스템 Photo Picker 가 없는(Android 11 미만) 기기가 있다. Google Play 서비스가 백포트 모듈을 설치하게 알린다.
// https://developer.android.com/training/data-storage/shared/photopicker#device-availability
describe('Android Photo Picker 백포트 (#111)', () => {
  const service = () =>
    mustMatchService(
      /<service\s[^>]*android:name="com\.google\.android\.gms\.metadata\.ModuleDependencies"[^>]*>([\s\S]*?)<\/service>/,
    );

  function mustMatchService(pattern) {
    const application = manifest.match(
      /<application[\s>][\s\S]*<\/application>/,
    )?.[0];
    const match = application?.match(pattern);
    if (!match) {
      throw new Error(
        '<application> 안의 ModuleDependencies 서비스를 찾지 못했다',
      );
    }
    return { tag: match[0].match(/<service\s[^>]*>/)[0], body: match[1] };
  }

  it('앱 안에서 실행되지 않는 표시용 서비스로 둔다', () => {
    const { tag } = service();

    expect(tag).toMatch(/android:enabled="false"/);
    expect(tag).toMatch(/android:exported="false"/);
    // 앱에 없는 클래스라 lint 의 MissingClass 를 끈다. tools 네임스페이스가 매니페스트에 있어야 한다
    expect(tag).toMatch(/tools:ignore="MissingClass"/);
    expect(manifest).toMatch(
      /<manifest\s[^>]*xmlns:tools="http:\/\/schemas\.android\.com\/tools"/,
    );
  });

  it('Google Play 서비스에 Photo Picker 모듈이 필요하다고 알린다', () => {
    const { body } = service();

    expect(body).toMatch(
      /<action\s+android:name="com\.google\.android\.gms\.metadata\.MODULE_DEPENDENCIES"\s*\/>/,
    );
    expect(body).toMatch(
      /<meta-data\s+android:name="photopicker_activity:0:required"\s+android:value=""\s*\/>/,
    );
  });
});
