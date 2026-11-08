import { useEffect, useMemo, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  colors,
  CTA,
  Skeleton,
  SKELETON_LABEL,
  SkeletonLine,
  Text,
} from '../design-system';

// 서버에서 불러오는 화면의 로딩·오류(다시 시도) 자리. Figma 에 없어 기존 컴포넌트로 최소 구성한 기본안이다 (Figma 미확인).
// 불러오는 동안은 그 자리의 실제 레이아웃을 닮은 스켈레톤을 보인다 (#139). 화면마다 skeleton 으로 주고, 없으면 글 몇 줄 모양이다.
// 빈 상태는 화면마다 Figma 의 빈 상태를 그대로 쓴다

export type LoadState =
  | { status: 'ready' }
  | { status: 'loading' }
  | { status: 'error'; message: string; onRetry: () => void };

/**
 * 화면에 줄 로딩·오류 상태: 상태·문구가 같으면 같은 객체라 화면(memo)이 다시 그려지지 않는다 (#114·#115 탭 전환 렌더 0).
 * 다시 시도는 retry 로 한다 (같은 함수를 주어야 한다. React Query 의 refetch 는 같은 함수다)
 */
export function useStableLoadState(
  state: LoadState,
  retry: () => Promise<unknown>,
): LoadState {
  const { status } = state;
  const message = state.status === 'error' ? state.message : undefined;
  return useMemo(
    () =>
      status === 'error'
        ? {
            status,
            message: message ?? '',
            onRetry: () => {
              retry();
            },
          }
        : { status },
    [status, message, retry],
  );
}

export const LOADING_LABEL = SKELETON_LABEL;
export const RETRY_LABEL = '다시 시도';

export function LoadStateView({
  state,
  style,
  skeleton,
}: {
  state: Exclude<LoadState, { status: 'ready' }>;
  /** 오류 자리와 기본 스켈레톤에 준다. 화면이 준 skeleton 은 자기 레이아웃 그대로 그린다 */
  style?: StyleProp<ViewStyle>;
  /** 불러오는 동안 이 자리의 실제 레이아웃을 닮은 스켈레톤. 받은 내용으로 바뀔 때 높이가 크게 튀지 않게 실제 높이에 맞춘다 */
  skeleton?: ReactNode;
}) {
  // 오류 문구는 accessibilityLiveRegion(Android 만 읽는다)과 함께 iOS 에도 알린다. 문구가 바뀔 때만 알린다
  const errorMessage = state.status === 'error' ? state.message : null;
  useEffect(() => {
    if (errorMessage !== null) {
      AccessibilityInfo.announceForAccessibility(errorMessage);
    }
  }, [errorMessage]);

  if (state.status === 'loading') {
    return skeleton ?? <DefaultSkeleton style={style} />;
  }
  return (
    <View style={[styles.box, style]}>
      <Text
        accessibilityLiveRegion="polite"
        variant="Body/XS/Medium"
        color={colors.gray[600]}
        style={styles.message}
      >
        {state.message}
      </Text>
      <CTA
        size="M"
        variant="outline"
        label={RETRY_LABEL}
        onPress={state.onRetry}
      />
    </View>
  );
}

// 화면이 skeleton 을 주지 않은 자리: 제목 한 줄과 글 세 줄
function DefaultSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <Skeleton style={[styles.skeleton, style]} testID="load-state-skeleton">
      <SkeletonLine variant="Body/S/SemiBold" width="50%" />
      <View>
        <SkeletonLine variant="Caption/M/Medium" />
        <SkeletonLine variant="Caption/M/Medium" width="90%" />
        <SkeletonLine variant="Caption/M/Medium" width="70%" />
      </View>
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  skeleton: { gap: 12, paddingHorizontal: 24, paddingVertical: 24 },
  box: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 80,
  },
  message: { textAlign: 'center' },
});
