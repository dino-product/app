// 테스트가 끝날 때 아직 화면에 알리지 않은 서버 상태 캐시(React Query) 갱신을 act 안에서 마저 보낸다.
// React Query 는 조회 결과를 다음 틱(setTimeout 0)에 알리므로, 테스트가 기다리지 않은 조회(숨은 화면·뒤에서 다시 받기)가
// 화면을 정리(cleanup)하기 전 act 밖에서 화면을 바꿔 act 경고가 나는 일을 막는다. 화면 정리보다 먼저 돌도록 맨 위에 둔다
const { act } = require('react');

const RealDate = Date;
// 가짜 타이머(setTimeout 을 바꾼 테스트)면 알림도 그 타이머에 묶여 있어 기다리지 않는다
const timersAreFake = () =>
  jest.isMockFunction(setTimeout) ||
  Object.prototype.hasOwnProperty.call(setTimeout, 'clock');
// Date 만 가짜로 바꾼 테스트(src/app/testing 의 fixAppTestClock)는 가짜 시계가 20ms 씩 흘러, 누른 시간을 Date.now 로 재는
// Pressable 이 마지막 누름의 놓기(pressOut)를 몇 ms 뒤로 미룰 수 있다. 그만큼 더 기다린다
const PRESS_OUT_SLACK_MS = 30;

afterEach(async () => {
  if (timersAreFake()) {
    return;
  }
  for (let i = 0; i < 3; i += 1) {
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
  }
  if (Date !== RealDate) {
    await act(
      () => new Promise(resolve => setTimeout(resolve, PRESS_OUT_SLACK_MS)),
    );
  }
});

// 앱 저장소(MMKV)는 테스트에서 메모리 목이고, 테스트 파일 안에서는 하나를 같이 쓴다.
// 앞 테스트가 저장한 화면·초안으로 다음 테스트가 시작하지 않게 테스트마다 비운다
// Keychain 목도 같은 이유로 비운다 (지난 테스트가 저장한 로그인 세션)
const { appStorage } = require('../src/shared/storage/appStorage');
const { clearMockKeychain } = require('react-native-keychain');

afterEach(() => {
  appStorage.clearAll();
  clearMockKeychain();
});

// 로그인 SDK 목은 테스트마다 기본 동작(로그인 성공)으로 되돌린다. 앞 테스트의 jest.restoreAllMocks 가 지운 동작도 다시 넣는다
const { resetLoginSdkMocks } = require('./loginSdk');

beforeEach(() => {
  resetLoginSdkMocks();
});

// 가짜 서버(src/shared/testing/fakeServer)에 응답을 정하지 않은 요청이 있었으면 그 테스트를 실패시킨다.
// 오타 난 경로가 오류 화면으로 보여 테스트가 거짓으로 통과하지 않게 한다
const { verifyFakeServers } = require('../src/shared/testing/fakeServer');

afterEach(() => {
  verifyFakeServers();
});

// React Query focusManager 는 모듈 하나를 같이 쓴다. 앞 테스트가 끈 포커스(앱 background)로 다음 테스트가 시작하지 않게 되돌린다
const { focusManager } = require('@tanstack/react-query');

afterEach(() => {
  focusManager.setFocused(undefined);
});
