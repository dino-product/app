import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * 동작 줄이기(iOS) · 애니메이션 제거(Android) 설정. 애니메이션을 시작할 때 읽는 값이라
 * 바뀌어도 다시 그리지 않게 ref 로 돌려준다. 설정을 읽기 전과 읽지 못했을 때는 꺼진 것으로 본다.
 * 구독은 설정이 바뀔 때만 불리는 리스너라 화면이 가만히 있을 때 하는 일은 없다
 */
export function useReduceMotion() {
  const reduceMotion = useRef(false);
  useEffect(() => {
    // 읽는 사이에 바뀌었으면 이벤트로 받은 값이 최신이고, 정리된 뒤(StrictMode 의 두 번째 실행 포함)의 결과는 버린다
    let stale = false;
    AccessibilityInfo.isReduceMotionEnabled().then(
      enabled => {
        if (!stale) {
          reduceMotion.current = enabled;
        }
      },
      () => {},
    );
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      enabled => {
        stale = true;
        reduceMotion.current = enabled;
      },
    );
    return () => {
      stale = true;
      subscription.remove();
    };
  }, []);
  return reduceMotion;
}
