// 앱 저장소(MMKV)는 테스트에서 메모리 목이고, 테스트 파일 안에서는 하나를 같이 쓴다.
// 앞 테스트가 저장한 화면·초안으로 다음 테스트가 시작하지 않게 테스트마다 비운다
// Keychain 목도 같은 이유로 비운다 (지난 테스트가 저장한 로그인 세션)
const { appStorage } = require('../src/shared/storage/appStorage');
const { clearMockKeychain } = require('react-native-keychain');

afterEach(() => {
  appStorage.clearAll();
  clearMockKeychain();
});
