// #108 회사 찾기 QR 인식의 카메라 설정.
// scripts/lib 모듈이 아니라 실제 설정 파일을 읽어 검사한다. jest 가 ios/·android/ 아래 테스트를 무시해서 여기에 둔다.
// 카메라 권한 선언(Android CAMERA, 하드웨어 필수 아님)은 완료 보고 사진(#111)과 같이 쓴다 (report-photo-permissions.test)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const infoPlist = fs
  .readFileSync(path.join(ROOT, 'ios', 'DinoApp', 'Info.plist'), 'utf8')
  .replace(/<!--[\s\S]*?-->/g, '');
const rnConfig = require(path.join(ROOT, 'react-native.config.js'));

const plistString = key =>
  infoPlist.match(
    new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`),
  )?.[1];

/** src 아래 앱 코드(테스트 제외) 전부 */
function appSources(dir = path.join(ROOT, 'src')) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return appSources(file);
    }
    return /\.tsx?$/.test(entry.name) &&
      !/\.(test|perf-test)\./.test(entry.name)
      ? [fs.readFileSync(file, 'utf8')]
      : [];
  });
}

describe('QR 인식 카메라 설정 (#108)', () => {
  // 앱 지역 설정이 ko 뿐이라(#22) 이 문구가 그대로 권한 대화상자에 나온다. 카메라를 쓰는 일을 모두 적어야 심사에서 거절되지 않는다
  it('iOS 카메라 권한 문구에 완료 보고 사진과 QR 인식을 모두 적는다', () => {
    const text = plistString('NSCameraUsageDescription');

    expect(text).toMatch(/사진/);
    expect(text).toMatch(/QR/);
  });

  // iOS 는 vision-camera core 의 객체 출력(AVFoundation)으로 QR 을 읽는다.
  // 바코드 스캐너의 iOS pod 는 iOS 15.5 이상과 GoogleMLKit 을 요구해 연결하지 않는다 (Android 만 ML Kit)
  it('ML Kit 바코드 스캐너는 Android 에만 연결한다', () => {
    expect(
      rnConfig.dependencies['react-native-vision-camera-barcode-scanner'],
    ).toEqual({ platforms: { ios: null } });
  });

  // vision-camera 5.2.4 iOS 는 녹화용 마이크 코드(AVCaptureDevice.requestAccess(for: .audio), 마이크 입력 추가)를 늘 컴파일하고,
  // 빼는 빌드 플래그(podspec·Podfile 변수)가 없다. 문구가 없으면 App Store 업로드가 Missing Purpose String(ITMS-90683)으로 거절될 수 있다
  it('vision-camera 가 참조하는 마이크 권한 문구를 한국어로 둔다', () => {
    const text = plistString('NSMicrophoneUsageDescription');

    expect(text).toMatch(/[가-힣]/);
    expect(text).toMatch(/마이크/);
  });

  // 그래서 마이크 권한 대화상자는 뜨지 않는다. 녹음이 필요해지면 문구와 함께 다시 본다
  it('앱 코드는 마이크 권한을 묻거나 소리를 녹음하지 않는다', () => {
    const sources = appSources().join('\n');

    expect(sources).not.toMatch(
      /requestMicrophonePermission|useMicrophonePermission|enableAudio/,
    );
  });
});
