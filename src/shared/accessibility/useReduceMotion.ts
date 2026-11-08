import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * 동작 줄이기 설정을 읽고 바뀔 때마다 알린다. 돌려주는 함수로 구독을 푼다.
 * 읽는 사이에 바뀌었으면 이벤트로 받은 값이 최신이고, 정리된 뒤(StrictMode 의 두 번째 실행 포함)의 결과는 버린다.
 * 읽지 못하면 알리지 않는다 (꺼진 것으로 둔다)
 */
function watchReduceMotion(onChange: (enabled: boolean) => void) {
  let stale = false;
  AccessibilityInfo.isReduceMotionEnabled().then(
    enabled => {
      if (!stale) {
        onChange(enabled);
      }
    },
    () => {},
  );
  const subscription = AccessibilityInfo.addEventListener(
    'reduceMotionChanged',
    enabled => {
      stale = true;
      onChange(enabled);
    },
  );
  return () => {
    stale = true;
    subscription.remove();
  };
}

/**
 * 동작 줄이기(iOS) · 애니메이션 제거(Android) 설정. 애니메이션을 시작할 때 읽는 값이라
 * 바뀌어도 다시 그리지 않게 ref 로 돌려준다. 설정을 읽기 전과 읽지 못했을 때는 꺼진 것으로 본다.
 * 구독은 설정이 바뀔 때만 불리는 리스너라 화면이 가만히 있을 때 하는 일은 없다
 */
export function useReduceMotion() {
  const reduceMotion = useRef(false);
  useEffect(
    () =>
      watchReduceMotion(enabled => {
        reduceMotion.current = enabled;
      }),
    [],
  );
  return reduceMotion;
}

/**
 * 같은 설정을 그리는 값으로 돌려준다. 설정에 따라 그리는 것이 달라지는 곳(탭 전환 설정 등)에 쓴다.
 * 설정이 바뀔 때만 다시 그린다 (켜 둔 기기는 처음 읽은 뒤 한 번)
 */
export function useReduceMotionEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => watchReduceMotion(setEnabled), []);
  return enabled;
}
