// 앱 버전 (iOS MARKETING_VERSION = CFBundleShortVersionString, Android versionName).
// RN 기본 API 에는 앱 버전이 없다. 네이티브 모듈을 더하는 대신 상수로 두고, scripts/lib/__tests__/app-version.test.js 가
// 네이티브 빌드 설정과 같은지 확인한다. 코드 푸시(OTA)를 쓰지 않아 JS 번들은 늘 같은 바이너리와 함께 나간다
export const APP_VERSION = '1.0';
