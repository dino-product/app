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
  | 'toggleOff';

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

/**
 * 앱이 쓰는 햅틱의 단일 창구. 화면은 라이브러리를 직접 부르지 않는다.
 * iOS 는 UIKit 알림·선택 생성기, Android 는 View.performHapticFeedback 상수(CONFIRM·REJECT·SEGMENT_TICK·TOGGLE_*)
 */
export const haptic = {
  /** 완료 보고 제출 성공, 요청 수락 */
  success: () => fire(isIOS() ? 'notificationSuccess' : 'confirm'),
  /** 요청 거절 */
  warning: () => fire(isIOS() ? 'notificationWarning' : 'reject'),
  /** 결제 방식·거절 사유 선택 */
  selection: () => fire(isIOS() ? 'selection' : 'segmentTick'),
  /** 토글. iOS 는 켬/끔 구분이 없다 */
  toggle: (on: boolean) =>
    fire(isIOS() ? 'selection' : on ? 'toggleOn' : 'toggleOff'),
};
