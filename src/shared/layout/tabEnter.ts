import { createContext, useContext, useMemo } from 'react';
import type { Animated } from 'react-native';

// 탭을 옮길 때 탭 화면 안의 내용이 들어오는 가로 위치 (#176). 메인 탭 내비게이터(app/navigation/TabEnterLayout)가
// 지금 들어오는 탭에만 값을 주고, 탭 첫 화면 레이아웃(AutoHideHeaderLayout)이 머리 내용·본문 내용에 건다.
// 바탕(화면 배경·머리 바탕·본문 바탕)에는 걸지 않아 제자리에 있다. 값이 없으면(전환 중이 아님·동작 줄이기) 옮기지 않는다
export const TabEnterContext = createContext<Animated.Value | null>(null);

/** 내용 뷰(Animated.View)에 거는 스타일. 같은 값이면 같은 객체라 다시 그려도 애니메이션 연결을 다시 만들지 않는다 */
export function useTabEnterStyle() {
  const shift = useContext(TabEnterContext);
  return useMemo(
    () => (shift ? { transform: [{ translateX: shift }] } : null),
    [shift],
  );
}
