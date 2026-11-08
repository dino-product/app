import { NavigationContext } from '@react-navigation/native';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../tokens/colors';
import { typography, type TypographyVariant } from '../tokens/typography';

// 서버에서 불러오는 동안 그 자리의 실제 레이아웃을 닮은 회색 블록(#139).
// Figma 에 스켈레톤 디자인이 없어 토큰으로 최소 구성한 기본안이다 (Figma 미확인).
//
//   <Skeleton>                                   묶음: 함께 깜빡이고, 스크린리더는 '불러오는 중' 하나로 읽는다
//     <SkeletonBlock width={60} height={60} radius={30} />   블록: 크기·모서리가 정해진 자리 (사진·버튼·칩)
//     <SkeletonLine variant="Body/S/SemiBold" width={120} />  줄: 글자 한 줄 자리
//   </Skeleton>

export const SKELETON_LABEL = '불러오는 중';

const BLOCK_COLOR = colors.gray[100];
// 한 번 흐려졌다 돌아오는 데 걸리는 시간과 가장 흐린 불투명도
const PULSE_MS = 1600;
const DIMMEST = 0.45;

export type SkeletonProps = {
  children: ReactNode;
  /** false 면 스크린리더에서 숨긴다. 감싼 요소가 이미 '…, 불러오는 중' 으로 읽을 때 쓴다 */
  accessible?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * 스켈레톤 블록 묶음. 안의 블록이 함께 은은하게 깜빡인다.
 * 깜빡임은 UI 스레드(네이티브 드라이버) 루프라 JS 를 거치지 않고, 다시 그리지도 않는다.
 * 동작 줄이기면 정지된 블록이고, 화면을 떠나거나(blur) 앱이 background 로 가거나 사라지면 멈춘다
 */
export function Skeleton({
  children,
  accessible = true,
  style,
  testID,
}: SkeletonProps) {
  const [progress] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() =>
    progress.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, DIMMEST, 1],
    }),
  );
  usePulse(progress);
  return (
    <Animated.View
      {...(accessible ? announced : hidden)}
      style={[style, { opacity }]}
      testID={testID}
    >
      {children}
    </Animated.View>
  );
}

const announced = {
  accessible: true,
  accessibilityRole: 'progressbar',
  accessibilityLabel: SKELETON_LABEL,
} as const;
const hidden = {
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

// 루프를 돌릴지는 세 가지로 정한다: 동작 줄이기가 꺼져 있고(읽기 전에는 모른다), 앱이 앞에 있고, 화면이 보인다.
// 어느 것이 바뀌어도 다시 그리지 않고 루프만 켜고 끈다. 내비게이터 밖(화면 단위 테스트 등)에서는 늘 보이는 것으로 본다
function usePulse(progress: Animated.Value) {
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    let reduceMotion: boolean | null = null;
    let foreground = AppState.currentState !== 'background';
    let focused = navigation?.isFocused() ?? true;
    let loop: Animated.CompositeAnimation | null = null;
    let disposed = false;

    const update = () => {
      const run = !disposed && reduceMotion === false && foreground && focused;
      if (run && loop === null) {
        loop = Animated.loop(
          Animated.timing(progress, {
            toValue: 1,
            duration: PULSE_MS,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        );
        loop.start();
      } else if (!run && loop !== null) {
        loop.stop();
        loop = null;
        // 멈춘 자리에서 흐린 채로 남지 않게 처음(불투명)으로 되돌린다
        progress.setValue(0);
      }
    };

    // 읽는 사이에 설정이 바뀌었으면 이벤트로 받은 값이 최신이다 (useReduceMotion 과 같다)
    let changed = false;
    const settle = (enabled: boolean) => {
      if (!changed) {
        reduceMotion = enabled;
        update();
      }
    };
    AccessibilityInfo.isReduceMotionEnabled().then(settle, () => settle(false));
    const motion = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      enabled => {
        changed = true;
        reduceMotion = enabled;
        update();
      },
    );
    const app = AppState.addEventListener('change', state => {
      foreground = state !== 'background';
      update();
    });
    const unsubscribeFocus = navigation?.addListener('focus', () => {
      focused = true;
      update();
    });
    const unsubscribeBlur = navigation?.addListener('blur', () => {
      focused = false;
      update();
    });

    return () => {
      disposed = true;
      motion.remove();
      app.remove();
      unsubscribeFocus?.();
      unsubscribeBlur?.();
      update();
    };
  }, [navigation, progress]);
}

/** 블록 모양. 사진·버튼·칩처럼 크기가 정해진 자리 */
export function SkeletonBlock({
  width = '100%',
  height,
  radius = 8,
  style,
  testID,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View
      style={[styles.block, { width, height, borderRadius: radius }, style]}
      testID={testID}
    />
  );
}

/**
 * 줄 모양. 글자 한 줄 자리라 그 글자 스타일의 줄 높이를 차지해, 실제 글자로 바뀌어도 높이가 같다.
 * 칠하는 막대는 글자 크기만큼이고 줄 가운데에 둔다
 */
export function SkeletonLine({
  variant,
  width = '100%',
  style,
  testID,
}: {
  variant: TypographyVariant;
  width?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { fontSize, lineHeight } = typography[variant];
  return (
    <View
      style={[styles.line, { width, height: lineHeight }, style]}
      testID={testID}
    >
      <View
        style={[styles.block, styles.bar, { height: fontSize }]}
        testID={testID && `${testID}-bar`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: BLOCK_COLOR },
  line: { justifyContent: 'center' },
  bar: { borderRadius: 4 },
});
