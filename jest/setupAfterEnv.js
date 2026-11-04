// 앱 저장소(MMKV)는 테스트에서 메모리 목이고, 테스트 파일 안에서는 하나를 같이 쓴다.
// 앞 테스트가 저장한 화면·초안으로 다음 테스트가 시작하지 않게 테스트마다 비운다
// Keychain 목도 같은 이유로 비운다 (지난 테스트가 저장한 로그인 세션)
const { appStorage } = require('../src/shared/storage/appStorage');
const { clearMockKeychain } = require('react-native-keychain');

afterEach(() => {
  appStorage.clearAll();
  clearMockKeychain();
});

// 가짜 서버(src/shared/testing/fakeServer)에 응답을 정하지 않은 요청이 있었으면 그 테스트를 실패시킨다.
// 오타 난 경로가 오류 화면으로 보여 테스트가 거짓으로 통과하지 않게 한다
const { verifyFakeServers } = require('../src/shared/testing/fakeServer');

afterEach(() => {
  verifyFakeServers();
});
