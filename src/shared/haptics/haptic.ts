import { Platform } from 'react-native';
import RNHapticFeedback from 'react-native-haptic-feedback';

type Kind =
  | 'notificationSuccess'
  | 'notificationWarning'
  | 'selection'
  | 'confirm'
  | 'reject'
  | 'segmentTick'
  | 'toggleOn'
  | 'toggleOff'
  | 'virtualKey'
  | 'longPress'
  | 'contextClick'
  | 'clockTick';

// 옵션은 넘기지 않는다: enableVibrateFallback·ignoreAndroidSystemSettings 기본값(false)으로
// 시스템 햅틱·터치 진동 설정을 그대로 따른다. 햅틱이 없는 기기에서는 라이브러리가 아무것도 하지 않는다
function fire(kind: Kind) {
  try {
    RNHapticFeedback.trigger(kind);
  } catch {
    // 햅틱은 보조 피드백이다. 실패해도 동작을 막지 않는다
  }
}

const isIOS = () => Platform.OS === 'ios';

// 라이브러리 Android 구현은 View 상수 맵에 있는 종류만 performHapticFeedback(시스템 터치 진동 설정 준수)으로 보낸다.
// 맵에 없는 종류는 Vibrator 폴백이라 설정을 무시하므로, 그 API 레벨의 맵에 있는 종류만 고른다.
// CONFIRM·REJECT·SEGMENT_TICK 은 API 30+, TOGGLE_ON/OFF 는 API 34+ 에서만 맵에 있다 (minSdk 24)
const androidAtLeast = (api: number) => Number(Platform.Version) >= api;

function pick(ios: Kind, android30: Kind, androidOld: Kind): Kind {
  if (isIOS()) {
    return ios;
  }
  return androidAtLeast(30) ? android30 : androidOld;
}

/**
 * 앱이 쓰는 햅틱의 단일 창구. 화면은 라이브러리를 직접 부르지 않는다.
 * iOS 는 UIKit 알림·선택 생성기, Android 는 View.performHapticFeedback 상수
 */
export const haptic = {
  /** 완료 보고 제출 성공, 요청 수락 */
  success: () => fire(pick('notificationSuccess', 'confirm', 'virtualKey')),
  /** 요청 거절 */
  warning: () => fire(pick('notificationWarning', 'reject', 'longPress')),
  /** 결제 방식·거절 사유 선택 */
  selection: () => fire(pick('selection', 'segmentTick', 'contextClick')),
  /** 토글. iOS 는 켬/끔 구분이 없다 */
  toggle: (on: boolean) => {
    if (isIOS()) {
      fire('selection');
    } else if (androidAtLeast(34)) {
      fire(on ? 'toggleOn' : 'toggleOff');
    } else {
      fire(on ? 'contextClick' : 'clockTick');
    }
  },
};
