import type { Ref } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type TextInstance,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, CTA, Text } from '../../../../shared/design-system';
import { readableColumn } from '../../../../shared/layout/readableColumn';
import { SubScreenHeader } from '../../components/SubScreenHeader';
import type { JoinFlow } from '../model';
import { flowLayouts } from './flowLayouts';

// 서버에서 받는 동안·받지 못했을 때의 자리 (#116). Figma 에 없는 상태라 기존 컴포넌트(Text·CTA)로 최소 구성했다 (Figma 미확인)
export function LoadState({
  failed,
  failedTitle,
  onRetry,
  style,
}: {
  /** 받지 못했다. 아니면 받는 중이다 */
  failed: boolean;
  /** 받지 못했을 때의 제목 ('신청 현황을 불러오지 못했어요' 등) */
  failedTitle: string;
  onRetry: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.box, style]}>
      {failed ? (
        <>
          <Text
            accessibilityRole="header"
            variant="Body/S/Bold"
            style={styles.center}
          >
            {failedTitle}
          </Text>
          <Text
            variant="Caption/M/Medium"
            color={colors.gray[600]}
            style={styles.center}
          >
            잠시 후 다시 시도해 주세요.
          </Text>
          <CTA
            size="M"
            label="다시 시도"
            onPress={onRetry}
            style={styles.retry}
          />
        </>
      ) : (
        <ActivityIndicator
          accessibilityLabel="불러오는 중"
          color={colors.secondary}
          size="large"
        />
      )}
    </View>
  );
}

/** 참여 요청 하나를 보여 줄 화면(요청 완료·거절·참여 완료)이 그 요청을 받는 동안·받지 못했을 때 */
export function LoadStateScreen({
  flow = 'my',
  title,
  onBack,
  titleRef,
  ...state
}: {
  flow?: JoinFlow;
  /** 머리 제목 (그 화면의 제목) */
  title: string;
  onBack: () => void;
  titleRef?: Ref<TextInstance>;
} & Omit<Parameters<typeof LoadState>[0], 'style'>) {
  return (
    <SafeAreaView
      edges={flowLayouts[flow].edges}
      style={flowLayouts[flow].screen}
    >
      <SubScreenHeader title={title} onBack={onBack} titleRef={titleRef} />
      <LoadState {...state} style={readableColumn} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  center: { textAlign: 'center' },
  retry: { alignSelf: 'stretch', marginTop: 20 },
});
