import { AppState } from 'react-native';
import { changeAppState, mockAppState, restoreAppState } from './appState';

// 프리셋이 둔 목 (테스트가 바꾸기 전)
const presetState = Object.getOwnPropertyDescriptor(AppState, 'currentState');

describe('AppState 목 (jest/appState)', () => {
  it('정한 상태를 읽고, 바꾸면 구독한 쪽에 알린다', async () => {
    mockAppState('active');
    const listener = jest.fn();
    AppState.addEventListener('change', listener);

    await changeAppState('background');

    expect(AppState.currentState).toBe('background');
    expect(listener).toHaveBeenCalledWith('background');
  });

  // 프리셋의 addEventListener 는 이미 목이라 spyOn 이 같은 함수의 동작만 바꾼다. restoreAllMocks 를 부르지 않는 테스트 파일에서도
  // 다음 테스트가 프리셋의 동작(구독을 기록하지 않고 remove 를 주는)으로 시작해야 한다
  it('restoreAppState 는 currentState 와 addEventListener 동작을 되돌린다', async () => {
    mockAppState('background');

    restoreAppState();
    const listener = jest.fn();
    const subscription = AppState.addEventListener('change', listener);
    await changeAppState('active');

    expect(listener).not.toHaveBeenCalled();
    expect(subscription.remove).toEqual(expect.any(Function));
    restoreAppState();
    expect(Object.getOwnPropertyDescriptor(AppState, 'currentState')).toEqual(
      presetState,
    );
  });
});
