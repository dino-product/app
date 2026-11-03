import { act, fireEvent } from '@testing-library/react-native';
import type { HostElement } from './touchTarget';

// 누르는 도중의 모양(눌림 배경 등)을 보는 테스트 헬퍼. userEvent.press 는 누름과 뗌을 한 번에 해 중간 상태를 볼 수 없다.
// Pressable 은 응답자 이벤트(Pressability)로 눌림을 알므로 손가락이 닿은 것(grant)과 뗀 것(release)을 따로 보낸다

const touchEvent = () => ({
  persist: () => {},
  // Pressability 가 누른 영역을 재려고 부른다. 테스트 렌더러에는 레이아웃이 없어 아무것도 하지 않는다
  currentTarget: { measure: () => {} },
  nativeEvent: {
    changedTouches: [],
    identifier: 0,
    locationX: 0,
    locationY: 0,
    pageX: 0,
    pageY: 0,
    target: 0,
    timestamp: Date.now(),
    touches: [],
  },
});

/** 손가락을 대고 있는 상태로 만든다 */
export function pressIn(element: HostElement) {
  return fireEvent(element, 'responderGrant', touchEvent());
}

// Pressability 는 이보다 짧게 누르면 남은 시간만큼 기다렸다가 뗀 것으로 친다 (RN DEFAULT_MIN_PRESS_DURATION)
const MIN_PRESS_DURATION_MS = 130;

/** 대고 있던 손가락을 뗀다. 가장 짧은 누름 시간이 지난 뒤에 떼어 바로 뗀 상태가 된다 */
export async function pressOut(element: HostElement) {
  await act(
    () =>
      new Promise<void>(resolve => setTimeout(resolve, MIN_PRESS_DURATION_MS)),
  );
  await fireEvent(element, 'responderRelease', touchEvent());
}
