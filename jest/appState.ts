import { act } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

// jest preset 의 AppState 목은 currentState 가 함수이고 change 이벤트를 내보내지 않는다.
// 앱이 앞에 있는지 보는 화면(QR 인식 카메라, #108)의 테스트가 상태를 정하고 바꾼다. 사용법:
//   mockAppState('active')        렌더하기 전에. 지금 상태를 정하고 change 구독을 받는다
//   await changeAppState('background')
// 테스트마다 jest/setupAfterEnv.js 가 restoreAppState 로 되돌린다

const original = Object.getOwnPropertyDescriptor(AppState, 'currentState');
const listeners = new Set<(state: AppStateStatus) => void>();
// 프리셋의 addEventListener 는 이미 목이라 spyOn 이 새 spy 를 만들지 않고 그 목의 동작만 바꾼다. 되돌릴 동작을 남겨 둔다
const listen = AppState.addEventListener;
const presetListen = jest.isMockFunction(listen)
  ? listen.getMockImplementation()
  : undefined;
let listenSpy: jest.SpyInstance | undefined;

function setCurrentState(state: AppStateStatus) {
  Object.defineProperty(AppState, 'currentState', {
    value: state,
    configurable: true,
  });
}

export function mockAppState(state: AppStateStatus = 'active') {
  setCurrentState(state);
  listenSpy = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((type, handler) => {
      const listener = handler as (next: AppStateStatus) => void;
      if (type === 'change') {
        listeners.add(listener);
      }
      return { remove: () => listeners.delete(listener) };
    });
}

export function changeAppState(state: AppStateStatus) {
  return act(async () => {
    setCurrentState(state);
    listeners.forEach(listener => listener(state));
  });
}

export function restoreAppState() {
  if (original) {
    Object.defineProperty(AppState, 'currentState', original);
  }
  if (listenSpy) {
    if (presetListen) {
      listenSpy.mockImplementation(presetListen);
    } else {
      listenSpy.mockRestore();
    }
    listenSpy = undefined;
  }
  listeners.clear();
}
