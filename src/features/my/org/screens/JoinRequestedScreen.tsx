import { Fragment, useRef, useState, type Ref } from 'react';
import { ScrollView, StyleSheet, View, type TextInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, CTA, Icon, Text } from '../../../../shared/design-system';
import { readableColumn } from '../../../../shared/layout/readableColumn';
import { SubScreenHeader } from '../../components/SubScreenHeader';
import { CancelRequestSheet } from '../components/CancelRequestSheet';
import { SummaryCard } from '../components/SummaryCard';
import {
  formatRequestedAt,
  participationTypeLabels,
  requestChannelLabels,
  type ParticipationRequest,
} from '../model';

// Figma 회사찾기-요청완료 (3235:14886). 진행 표시는 첫 단계만 끝난 상태다
const steps = ['요청 완료', '사무실 검토 중', '참여 완료'] as const;

export function JoinRequestedScreen({
  request,
  onConfirm,
  onCancel,
  onBack,
  titleRef,
}: {
  request: ParticipationRequest;
  /** 마이페이지로 */
  onConfirm: () => void;
  /** 바텀시트에서 신청 취소를 확정했을 때 */
  onCancel: (requestId: string) => void;
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const [canceling, setCanceling] = useState(false);
  // 시트에서 취소를 확정했는지. 시트가 다 내려간 뒤에 취소·이동한다 (모달 아래에서 화면이 바뀌지 않게)
  const confirmed = useRef(false);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader
        title="조직 참여하기"
        onBack={onBack}
        titleRef={titleRef}
      />
      <ScrollView contentContainerStyle={[readableColumn, styles.content]}>
        <View style={styles.intro}>
          <Icon name="modal-check" size={48} />
          <Text accessibilityRole="header" variant="Body/L/Bold">
            참여 요청을 보냈어요
          </Text>
          <Text
            variant="Body/XS/Regular"
            color={colors.gray[600]}
            style={styles.center}
          >
            사무실에서 요청을 확인하면 알려드릴게요.
          </Text>
        </View>

        <View
          accessible
          accessibilityLabel={`진행 단계: ${steps[0]}, 다음은 ${steps[1]}, ${steps[2]}`}
          style={styles.steps}
        >
          {steps.map((step, index) => (
            <Fragment key={step}>
              {index > 0 && <View style={styles.stepLine} />}
              <View style={styles.step}>
                <View
                  style={[
                    styles.stepCircle,
                    index === 0 ? styles.stepDone : styles.stepTodo,
                  ]}
                >
                  {index === 0 ? (
                    <Icon name="check" size={20} color={colors.white[100]} />
                  ) : (
                    <Text variant="Body/XS/SemiBold" color={colors.white[100]}>
                      {index + 1}
                    </Text>
                  )}
                </View>
                <Text
                  variant="Caption/M/Medium"
                  color={index === 0 ? colors.gray[900] : colors.gray[500]}
                >
                  {step}
                </Text>
              </View>
            </Fragment>
          ))}
        </View>

        <SummaryCard
          rows={[
            { label: '회사', value: request.organizationName },
            {
              label: '희망 유형',
              value: participationTypeLabels[request.desiredType],
            },
            {
              label: '요청 경로',
              value: requestChannelLabels[request.requestChannel],
            },
            {
              label: '요청 일시',
              value: formatRequestedAt(request.requestedAt),
            },
          ]}
        />
        <Text
          variant="Caption/S/Medium"
          color={colors.gray[500]}
          style={styles.center}
        >
          승인 전까지 회사의 일정과 작업은 표시되지 않습니다.
        </Text>
      </ScrollView>

      <View style={[readableColumn, styles.actions]}>
        <CTA
          variant="outline"
          label="신청 취소"
          onPress={() => setCanceling(true)}
          style={styles.action}
        />
        <CTA label="확인" onPress={onConfirm} style={styles.action} />
      </View>

      <CancelRequestSheet
        request={canceling ? request : null}
        onClose={() => setCanceling(false)}
        onConfirm={() => {
          confirmed.current = true;
          setCanceling(false);
        }}
        onClosed={() => {
          if (confirmed.current) {
            confirmed.current = false;
            onCancel(request.requestId);
          }
        }}
      />
    </SafeAreaView>
  );
}

const STEP_SIZE = 36;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  content: {
    gap: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  intro: { alignItems: 'center', gap: 8 },
  center: { textAlign: 'center' },
  steps: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  step: { alignItems: 'center', gap: 8, width: 88 },
  stepCircle: {
    width: STEP_SIZE,
    height: STEP_SIZE,
    borderRadius: STEP_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDone: { backgroundColor: colors.secondary },
  stepTodo: { backgroundColor: colors.gray[200] },
  stepLine: {
    flex: 1,
    height: 2,
    marginTop: STEP_SIZE / 2 - 1,
    marginHorizontal: -16,
    backgroundColor: colors.gray[100],
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
  },
  action: { flex: 1 },
});
