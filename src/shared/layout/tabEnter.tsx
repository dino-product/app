import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

// 탭을 옮길 때 탭 화면 안의 내용이 들어오는 가로 위치 (#176). 메인 탭 내비게이터(app/navigation/TabEnterLayout)가
// 지금 들어오는 탭에만 값을 주고, 탭 첫 화면이 머리 내용·본문 내용을 TabEnterView 로 감싼다
// (AutoHideHeaderLayout, 작업 이력 HistoryHeaderBar·목록). 바탕(화면 배경·머리 바탕·본문 바탕)은 감싸지 않아 제자리에 있다.
// 값이 없으면(전환 중이 아님·동작 줄이기) 옮기지 않는다
export const TabEnterContext = createContext<Animated.Value | null>(null);

/** 내용 뷰(Animated.View)에 거는 스타일. 같은 값이면 같은 객체라 다시 그려도 애니메이션 연결을 다시 만들지 않는다 */
export function useTabEnterStyle() {
  const shift = useContext(TabEnterContext);
  return useMemo(
    () => (shift ? { transform: [{ translateX: shift }] } : null),
    [shift],
  );
}

/**
 * 탭을 옮길 때 옆에서 들어오는 내용. header 는 머리 내용(상단 바 글자·하위 탭·월 선택), body 는 본문 내용(리스트)이다.
 * style 은 늘 같은 객체(StyleSheet)를 넘긴다 (바뀌면 애니메이션 연결을 다시 만든다)
 */
export function TabEnterView({
  part,
  style,
  children,
}: {
  part: 'header' | 'body';
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const enterStyle = useTabEnterStyle();
  const animatedStyle = useMemo(() => [style, enterStyle], [style, enterStyle]);
  return (
    <Animated.View testID={`tab-enter-${part}`} style={animatedStyle}>
      {/* 자식을 요소 하나(Fragment)로 넘긴다. Animated.View 는 배열 props(여러 자식)를 참조로 비교해,
          다시 그려질 때마다 네이티브 애니메이션 연결을 새로 만든다 */}
      <>{children}</>
    </Animated.View>
  );
}
