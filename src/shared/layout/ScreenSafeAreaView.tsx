import { Platform, StyleSheet, type PlatformOSType } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
  type SafeAreaViewProps,
} from 'react-native-safe-area-context';

// 화면 틀의 위 여백 (#236). iPhone 은 다이내믹 아일랜드 때문에 위 안전 영역이 59 (Figma iPhone 16 상태 표시줄 60)인데,
// Android 는 edge-to-edge 라 상태 표시줄(24dp 안팎)만 비워 머리가 30 가까이 위로 붙고 상단 바가 얇아 보인다.
// Android 는 상태 표시줄과 Figma 상태 표시줄 60 중 큰 값을 비워, 남는 자리를 화면 배경으로 채우고 머리를 iPhone 과
// 같은 자리에 둔다. 상태 표시줄이 더 높은 기기는 그 높이를 그대로 쓴다. iOS 는 안전 영역 그대로다

/** Figma(iPhone 16) 상태 표시줄 높이 */
export const FIGMA_STATUS_BAR_HEIGHT = 60;

/** 화면 위 여백의 최솟값. Android 만 Figma 상태 표시줄 높이다 */
export const minScreenTop = (os: PlatformOSType) =>
  os === 'android' ? FIGMA_STATUS_BAR_HEIGHT : 0;

export const MIN_SCREEN_TOP = minScreenTop(Platform.OS);

/** 위 안전 영역(상태 표시줄)에서 화면 위 여백을 낸다 */
export const screenTopOf = (
  safeAreaTop: number,
  os: PlatformOSType = Platform.OS,
) => Math.max(safeAreaTop, minScreenTop(os));

/** 화면 틀 밖에서 위 여백을 알아야 할 때 쓴다 (상단 바 배경을 상태 표시줄 자리까지 덮을 때 등) */
export function useScreenTop() {
  return screenTopOf(useSafeAreaInsets().top);
}

const TOP_EDGES = { top: 'maximum' } as const;
const TOP_BOTTOM_EDGES = { top: 'maximum', bottom: 'maximum' } as const;

export type ScreenSafeAreaViewProps = Omit<
  SafeAreaViewProps,
  'edges' | 'mode'
> & {
  /** 하단 탭 없이 여는 화면: 아래도 홈 인디케이터와 style 의 paddingBottom 중 큰 값만큼 띄운다 */
  bottom?: boolean;
};

/**
 * 화면 틀. 위는 안전 영역과 MIN_SCREEN_TOP 중 큰 값만큼 띄운다 (top: 'maximum' 이 안전 영역과 style 의 paddingTop 을
 * 견준다). 그래서 이 틀의 paddingTop 은 이 틀이 정한다. 머리 아래 여백 같은 것은 안쪽 View 에 준다
 */
export function ScreenSafeAreaView({
  bottom = false,
  style,
  ...props
}: ScreenSafeAreaViewProps) {
  return (
    <SafeAreaView
      {...props}
      edges={bottom ? TOP_BOTTOM_EDGES : TOP_EDGES}
      style={[style, Platform.OS === 'android' ? minTop.android : minTop.ios]}
    />
  );
}

// 운영체제는 그릴 때 본다 (테스트가 Platform.OS 를 바꿔 Android 틀을 그려 볼 수 있다)
const minTop = StyleSheet.create({
  android: { paddingTop: minScreenTop('android') },
  ios: { paddingTop: minScreenTop('ios') },
});
