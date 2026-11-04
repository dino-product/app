// 테스트가 끝나면 아직 화면에 알리지 않은 서버 상태 캐시(React Query) 갱신을 act 안에서 마저 보내고, 곧바로 화면을 act 안에서 정리(unmount)한다.
// - React Query 는 조회 결과를 다음 틱(setTimeout 0)에 알린다. 테스트가 기다리지 않은 조회(숨은 화면·뒤에서 다시 받기)가 있다
// - 라이브러리 타이머는 테스트가 끝난 뒤에도 남는다: 하단 탭이 전환 뒤 앞 화면 상태를 바꾸는 타이머(약 50ms), VirtualizedList 의
//   셀 갱신 묶음(50ms), Pressable 의 놓기(pressOut) 지연. RNTL 자동 정리는 다음 매크로태스크에야 돌아 그 사이 이 타이머가
//   act 밖에서 화면을 바꿔 act 경고가 난다. 여기서 바로 정리하면 남은 타이머는 떼어진 화면에 닿아 경고 없이 버려진다
// 화면 정리보다 먼저 돌도록 맨 위에 둔다. RNTL 자동 정리는 그 뒤 빈 대기열로 돈다
const { act } = require('react');
const { cleanup } = require('@testing-library/react-native/pure');

// 가짜 타이머(setTimeout 을 바꾼 테스트)면 알림도 그 타이머에 묶여 있어 기다리지 않는다 (정리는 RNTL 자동 정리에 맡긴다)
const timersAreFake = () =>
  jest.isMockFunction(setTimeout) ||
  Object.prototype.hasOwnProperty.call(setTimeout, 'clock');

afterEach(async () => {
  if (timersAreFake()) {
    return;
  }
  for (let i = 0; i < 3; i += 1) {
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
  }
  await cleanup();
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

// QR 인식 테스트가 정한 앱 상태(AppState.currentState·change 구독)를 되돌린다 (jest/appState.ts)
const { restoreAppState } = require('./appState');

afterEach(() => {
  restoreAppState();
});

// Firebase 목도 테스트마다 기본(기본 앱 없음)으로 되돌린다
const { resetFirebaseMock } = require('./firebase');

beforeEach(() => {
  resetFirebaseMock();
});
