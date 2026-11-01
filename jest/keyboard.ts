import { act } from '@testing-library/react-native';
import { DeviceEventEmitter } from 'react-native';

// Android 네이티브(ReactRootView.checkForKeyboardEvents)가 보내는 키보드 이벤트를 흉내 낸다.
// Keyboard 모듈은 DeviceEventEmitter 로 받으므로 여기로 내보낸다.
// 화면 높이 800, 내비게이션 바 48 인 기기로 친다

const SCREEN_HEIGHT = 800;
const NAVIGATION_BAR_HEIGHT = 48;
const SCREEN_WIDTH = 360;

/** 키보드 윗변이 화면 위에서 screenY 인 채로 열린다 (다시 부르면 높이가 바뀐 것) */
export function showKeyboard(screenY: number) {
  return act(() => {
    DeviceEventEmitter.emit('keyboardDidShow', {
      duration: 0,
      easing: 'keyboard',
      endCoordinates: {
        screenX: 0,
        screenY,
        width: SCREEN_WIDTH,
        // ime.bottom − systemBars.bottom 이라 실제로 가린 높이보다 내비게이션 바만큼 작다
        height: SCREEN_HEIGHT - screenY - NAVIGATION_BAR_HEIGHT,
      },
    });
  });
}

export function hideKeyboard() {
  return act(() => {
    DeviceEventEmitter.emit('keyboardDidHide', {
      duration: 0,
      easing: 'keyboard',
      endCoordinates: {
        screenX: 0,
        screenY: SCREEN_HEIGHT,
        width: SCREEN_WIDTH,
        height: 0,
      },
    });
  });
}
