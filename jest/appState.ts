import { act } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

// jest preset 의 AppState 목은 currentState 가 함수이고 change 이벤트를 내보내지 않는다.
// 앱이 앞에 있는지 보는 화면(QR 인식 카메라, #108)의 테스트가 상태를 정하고 바꾼다. 사용법:
//   mockAppState('active')        렌더하기 전에. 지금 상태를 정하고 change 구독을 받는다
//   await changeAppState('background')
// 테스트마다 jest/setupAfterEnv.js 가 restoreAppState 로 되돌린다

const original = Object.getOwnPropertyDescriptor(AppState, 'currentState');
const listeners = new Set<(state: AppStateStatus) => void>();

function setCurrentState(state: AppStateStatus) {
  Object.defineProperty(AppState, 'currentState', {
    value: state,
    configurable: true,
  });
}

export function mockAppState(state: AppStateStatus = 'active') {
  setCurrentState(state);
  jest
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
  listeners.clear();
}
