import { useEffect, useLayoutEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * 스크린리더(VoiceOver · TalkBack)가 켜져 있는지. 스크롤 같은 이벤트에서 읽는 값이라 바뀌어도 다시 그리지 않게
 * ref 로 돌려주고, 바뀌면 onChange 로 알린다 (렌더마다 새 함수를 넘겨도 가장 최근 것을 부른다).
 * 설정을 읽기 전과 읽지 못했을 때는 꺼진 것으로 본다. 구독은 설정이 바뀔 때만 불리는 리스너다
 */
export function useScreenReaderEnabled(onChange?: (enabled: boolean) => void) {
  const enabled = useRef(false);
  const latestOnChange = useRef(onChange);
  useLayoutEffect(() => {
    latestOnChange.current = onChange;
  });
  useEffect(() => {
    const update = (next: boolean) => {
      if (next !== enabled.current) {
        enabled.current = next;
        latestOnChange.current?.(next);
      }
    };
    // 읽는 사이에 바뀌었으면 이벤트로 받은 값이 최신이고, 정리된 뒤(StrictMode 의 두 번째 실행 포함)의 결과는 버린다
    let stale = false;
    AccessibilityInfo.isScreenReaderEnabled().then(
      next => {
        if (!stale) {
          update(next);
        }
      },
      () => {},
    );
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      next => {
        stale = true;
        update(next);
      },
    );
    return () => {
      stale = true;
      subscription.remove();
    };
  }, []);
  return enabled;
}
