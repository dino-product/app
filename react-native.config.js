// 네이티브 모듈 자동 연결 설정
module.exports = {
  dependencies: {
    // Apple 로그인은 Apple 기기에서만 보인다 (#113, 프로젝트 결정). Android 웹 로그인 모듈은 연결하지 않는다
    '@invertase/react-native-apple-authentication': {
      platforms: { android: null },
    },
    // QR 인식(#108)은 iOS 가 vision-camera core 의 AVFoundation 으로 하고(QrCamera.ios.tsx), Android 만 ML Kit 바코드 스캐너를 쓴다.
    // 이 패키지의 iOS pod 는 iOS 15.5 이상과 GoogleMLKit 을 요구해 iOS 에는 연결하지 않는다
    'react-native-vision-camera-barcode-scanner': {
      platforms: { ios: null },
    },
  },
};
