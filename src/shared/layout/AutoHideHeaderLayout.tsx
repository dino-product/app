import { useMemo, type ReactNode } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { TabEnterView } from './tabEnter';
import type { AutoHideHeader } from './useAutoHideHeader';

// 탭 첫 화면의 머리(상단 바 + 늘 보이는 부분)를 스크롤 뷰 위에 겹쳐 그리고 스크롤에 따라 숨긴다 (#148).
// 쓰는 법: SafeAreaView(edges top) 안에 두고, children 으로 스크롤 뷰 하나(또는 그것만 감싼 뷰 하나)를 넘긴다. 스크롤 뷰에는
// autoHide.scrollProps 를 펼쳐 넣고 내용 위 여백에 autoHide.height 를 더한다 (useAutoHideHeader 참고).
//
// 머리는 읽는 순서를 위해 스크롤 뷰 앞에 두고 zIndex 로 위에 그린다. 바깥 영역이 잘라 내므로 숨은 상단 바가
// 상태 표시줄(안전 영역)을 가리지 않고, 그 자리는 화면 배경(SafeAreaView)이 그대로 보인다.
// 머리의 빈 곳은 터치를 받지 않아 끌면 아래 리스트가 스크롤된다.
//
// 탭을 옮길 때는 머리 내용(상단 바·sticky)과 본문 내용(children)만 옆에서 들어온다 (#176, tabEnter.ts).
// 머리 바탕(style)과 본문 바탕(bodyStyle), 화면 배경은 제자리라, 스크롤 뷰에는 바탕색을 주지 않고 bodyStyle 에 준다
export type AutoHideHeaderLayoutProps = {
  autoHide: AutoHideHeader;
  /** 아래로 스크롤하면 숨는 상단 바 (TabHeader) */
  header: ReactNode;
  /** 상단 바 아래에 붙어 늘 보이는 부분 (내 일정 하위 탭). 상단 바가 숨으면 화면 맨 위로 올라간다 */
  sticky?: ReactNode;
  /** 머리 배경(·그림자). 내용이 아래로 지나가므로 화면 배경과 같은 불투명한 색을 준다 */
  style: StyleProp<ViewStyle>;
  /** 본문 바탕(머리 아래 리스트 영역의 바탕색). 탭을 옮길 때 움직이지 않는다. 화면 배경과 다를 때만 준다 */
  bodyStyle?: StyleProp<ViewStyle>;
  /** 스크롤 뷰 하나 (또는 그것만 감싼 뷰 하나) */
  children: ReactNode;
};

export function AutoHideHeaderLayout({
  autoHide,
  header,
  sticky,
  style,
  bodyStyle,
  children,
}: AutoHideHeaderLayoutProps) {
  const { translateY, onHeaderLayout, onCollapsibleLayout } = autoHide;
  // 화면이 다시 그려져도 같은 스타일을 넘겨 애니메이션 값의 연결을 다시 만들지 않는다
  const headerStyle = useMemo(
    () => [styles.header, style, { transform: [{ translateY }] }],
    [style, translateY],
  );
  return (
    <View style={[styles.body, bodyStyle]}>
      <Animated.View
        testID="auto-hide-header"
        onLayout={onHeaderLayout}
        style={headerStyle}
      >
        <TabEnterView part="header" style={styles.passThrough}>
          <View
            testID="auto-hide-header-collapsible"
            onLayout={onCollapsibleLayout}
            style={styles.passThrough}
          >
            {header}
          </View>
          {sticky}
        </TabEnterView>
      </Animated.View>
      <TabEnterView part="body" style={styles.bodyContent}>
        {children}
      </TabEnterView>
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
  bodyContent: { flex: 1 },
});
