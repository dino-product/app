import { useMemo, type ReactNode } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { AutoHideHeader } from './useAutoHideHeader';

// 탭 첫 화면의 머리(상단 바 + 늘 보이는 부분)를 스크롤 뷰 위에 겹쳐 그리고 스크롤에 따라 숨긴다 (#148).
// 쓰는 법: SafeAreaView(edges top) 안에 두고, children 으로 스크롤 뷰 하나(또는 그것만 감싼 뷰 하나, 예: 작업 이력의
// 월 넘김 목록 영역 #153)를 넘긴다. 스크롤 뷰에는
// autoHide.scrollProps 를 펼쳐 넣고 내용 위 여백에 autoHide.height 를 더한다 (useAutoHideHeader 참고).
//
// 머리는 읽는 순서를 위해 스크롤 뷰 앞에 두고 zIndex 로 위에 그린다. 바깥 영역이 잘라 내므로 숨은 상단 바가
// 상태 표시줄(안전 영역)을 가리지 않고, 그 자리는 화면 배경(SafeAreaView)이 그대로 보인다.
// 머리의 빈 곳은 터치를 받지 않아 끌면 아래 리스트가 스크롤된다
export type AutoHideHeaderLayoutProps = {
  autoHide: AutoHideHeader;
  /** 아래로 스크롤하면 숨는 상단 바 (TabHeader) */
  header: ReactNode;
  /** 상단 바 아래에 붙어 늘 보이는 부분 (내 일정 하위 탭). 상단 바가 숨으면 화면 맨 위로 올라간다 */
  sticky?: ReactNode;
  /** 머리 배경(·그림자). 내용이 아래로 지나가므로 화면 배경과 같은 불투명한 색을 준다 */
  style: StyleProp<ViewStyle>;
  /** 스크롤 뷰 하나 (또는 그것만 감싼 뷰 하나) */
  children: ReactNode;
};

export function AutoHideHeaderLayout({
  autoHide,
  header,
  sticky,
  style,
  children,
}: AutoHideHeaderLayoutProps) {
  const { translateY, onHeaderLayout, onCollapsibleLayout } = autoHide;
  // 화면이 다시 그려져도 같은 스타일을 넘겨 애니메이션 값의 연결을 다시 만들지 않는다
  const headerStyle = useMemo(
    () => [styles.header, style, { transform: [{ translateY }] }],
    [style, translateY],
  );
  return (
    <View style={styles.body}>
      <Animated.View
        testID="auto-hide-header"
        onLayout={onHeaderLayout}
        style={headerStyle}
      >
        {/* 자식을 요소 하나(Fragment)로 넘긴다. Animated.View 는 배열 props(여러 자식)를 참조로 비교해,
            화면이 다시 그려질 때마다 네이티브 애니메이션 연결을 새로 만든다 */}
        <>
          <View
            testID="auto-hide-header-collapsible"
            onLayout={onCollapsibleLayout}
            style={styles.passThrough}
          >
            {header}
          </View>
          {sticky}
        </>
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, overflow: 'hidden' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    pointerEvents: 'box-none',
  },
  passThrough: { pointerEvents: 'box-none' },
});
