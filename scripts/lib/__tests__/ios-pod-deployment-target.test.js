// Xcode 27 의 iOS SDK 는 배포 타깃 15.0 미만을 받지 않는다 (iPhoneOS.sdk/SDKSettings.json 의 MinimumDeploymentTarget).
// 일부 pod 는 podspec 의 낮은 값을 그대로 들고 와 그 타깃(리소스 번들 포함)에서 빌드가 깨진다:
// react-native-image-picker·PromisesObjC 9.0, Alamofire 10.0, GoogleUtilities·GoogleDataTransport·nanopb 12.0, KakaoSDKCommon 13.0.
// Podfile post_install 이 앱 최소 버전(min_ios_version_supported)보다 낮은 pod 타깃만 그 값으로 올린다
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');

// 주석 줄을 뺀 Podfile 코드
const podfileCode = fs
  .readFileSync(path.join(ROOT, 'ios/Podfile'), 'utf8')
  .replace(/\r\n/g, '\n')
  .split('\n')
  .filter(line => !line.trim().startsWith('#'))
  .join('\n');

// post_install 블록부터 끝까지
const postInstall = podfileCode.slice(
  Math.max(podfileCode.indexOf('post_install do |installer|'), 0),
);

describe('iOS — pod 배포 타깃', () => {
  it('앱 최소 버전은 한 곳(min_ios_version_supported)에서 정한다', () => {
    expect(podfileCode).toMatch(/^platform :ios, min_ios_version_supported$/m);
  });

  it('post_install 이 모든 pod 타깃의 빌드 설정에서 배포 타깃을 앱 최소 버전으로 올린다', () => {
    expect(podfileCode).toContain('post_install do |installer|');
    expect(postInstall).toMatch(
      /installer\.pods_project\.targets\.each do \|(\w+)\|[\s\S]*?\1\.build_configurations\.each do \|(\w+)\|[\s\S]*?\2\.build_settings\['IPHONEOS_DEPLOYMENT_TARGET'\] = min_ios_version_supported/,
    );
  });

  it('앱 최소 버전보다 낮을 때만 바꾼다 (더 높게 잡은 pod 는 그대로)', () => {
    expect(postInstall).toMatch(
      /if [\s\S]*?Gem::Version\.new\(\w+\) < Gem::Version\.new\(min_ios_version_supported\)/,
    );
  });
});
