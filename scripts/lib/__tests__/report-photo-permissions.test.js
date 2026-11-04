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
