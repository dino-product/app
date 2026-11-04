import { useEffect } from 'react';
import { StatusBar } from 'react-native';

/**
 * 어두운 배경의 화면(로그인 보라, QR 코드 인식 카메라 검정)이 보이는 동안만 상태 표시줄 글자를 흰색으로 둔다.
 * 위에 다른 화면을 쌓아도 아래 화면은 남아 있으므로 마운트가 아니라 보이는지(내비게이션 포커스)로 켜고 끈다
 */
export function useLightStatusBar(visible: boolean) {
  useEffect(() => {
    if (!visible) {
      return;
    }
    const entry = StatusBar.pushStackEntry({ barStyle: 'light-content' });
    return () => StatusBar.popStackEntry(entry);
  }, [visible]);
}
