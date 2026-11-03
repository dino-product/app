import type { Ref } from 'react';
import { ScrollView, StyleSheet, View, type TextInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, CTA, Icon, Text } from '../../../../shared/design-system';
import { readableColumn } from '../../../../shared/layout/readableColumn';
import { SubScreenHeader } from '../../components/SubScreenHeader';
import { SummaryCard } from '../components/SummaryCard';
import { participationTypeLabels, type ParticipationRequest } from '../model';

// Figma 회사찾기-거절 (3255:18035). 알림센터의 참여 거절 알림에서 들어온다 (디자인 확인 항목)
export function JoinRejectedScreen({
  request,
  onConfirm,
  onBack,
  titleRef,
}: {
  request: ParticipationRequest;
  /** 이전 화면으로 */
  onConfirm: () => void;
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader
        title="조직 참여하기"
        onBack={onBack}
        titleRef={titleRef}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[readableColumn, styles.section]}>
          <View style={styles.intro}>
            <Icon name="modal-x" size={48} />
            <Text accessibilityRole="header" variant="Body/L/Bold">
              참여 요청이 거절되었어요
            </Text>
            <Text
              variant="Body/XS/Regular"
              color={colors.gray[600]}
              style={styles.center}
            >
              같은 회사 코드로 다시 요청할 수 있습니다.
            </Text>
          </View>
          <SummaryCard
            rows={[
              { label: '회사', value: request.organizationName },
              {
                label: '희망 유형',
                value: participationTypeLabels[request.desiredType],
              },
            ]}
          />
        </View>

        <View style={styles.band} />

        <View style={[readableColumn, styles.section]}>
          <Text accessibilityRole="header" variant="Body/S/SemiBold">
            거절 사유
          </Text>
          <View style={styles.reason}>
            <Text variant="Caption/M/Medium" color={colors.gray[800]}>
              {request.rejectReason ?? '입력된 거절 사유가 없어요.'}
            </Text>
          </View>
          <Text
            variant="Caption/S/Medium"
            color={colors.gray[500]}
            style={styles.center}
          >
            거절 후에도 회사 코드와 참여 링크는 계속 사용할 수 있습니다.
          </Text>
        </View>
      </ScrollView>

      <View style={[readableColumn, styles.actions]}>
        <CTA label="확인" onPress={onConfirm} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  content: { paddingTop: 32, paddingBottom: 24 },
  section: { gap: 16, paddingHorizontal: 24 },
  intro: { alignItems: 'center', gap: 8, marginBottom: 8 },
  center: { textAlign: 'center' },
  // 요약과 거절 사유 사이 두꺼운 회색 띠는 화면 끝까지 칠한다
  band: {
    height: 12,
    marginVertical: 24,
    backgroundColor: colors.background[3],
  },
  reason: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.background[3],
  },
  actions: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
});
