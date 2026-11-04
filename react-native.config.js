// 네이티브 모듈 자동 연결 설정
module.exports = {
  dependencies: {
    // Apple 로그인은 Apple 기기에서만 보인다 (#113, 프로젝트 결정). Android 웹 로그인 모듈은 연결하지 않는다
    '@invertase/react-native-apple-authentication': {
      platforms: { android: null },
    },
  },
};
