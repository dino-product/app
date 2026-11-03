import { Fragment, useRef, useState, type Ref } from 'react';
import { ScrollView, StyleSheet, View, type TextInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, CTA, Icon, Text } from '../../../../shared/design-system';
import { readableColumn } from '../../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../../shared/layout/noOverscroll';
import { SubScreenHeader } from '../../components/SubScreenHeader';
import { CancelRequestModal } from '../components/CancelRequestModal';
import { flowLayouts } from '../components/flowLayouts';
import { InfoNotice } from '../components/InfoNotice';
import { SummaryCard } from '../components/SummaryCard';
import {
  formatRequestedAt,
  participationTypeLabels,
  requestChannelLabels,
  type JoinFlow,
  type ParticipationRequest,
} from '../model';

// Figma 회사찾기-요청완료 (3235:14886). 진행 표시는 첫 단계만 끝난 상태다.
// 온보딩(#85)은 승인 대기 (3227:8824) 이고 머리 제목 '승인 대기', 버튼 위 안내 상자가 더 있다
const steps = ['요청 완료', '사무실 검토 중', '참여 완료'] as const;

export function JoinRequestedScreen({
  flow = 'my',
  request,
  onConfirm,
  onCancel,
  onBack,
  titleRef,
}: {
  flow?: JoinFlow;
  request: ParticipationRequest;
  /** 마이는 마이페이지로, 온보딩은 사무실이 결정한 것으로 친다 (더미) */
  onConfirm: () => void;
  /** 신청 취소 모달에서 취소를 확정했을 때 */
  onCancel: (requestId: string) => void;
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const [canceling, setCanceling] = useState(false);
  const onboarding = flow === 'onboarding';
  const look = looks[flow];
  // 화면을 옮기기 전에 모달의 '취소' 를 연달아 눌러도 한 번만 취소한다
  const canceled = useRef(false);
  // 화면을 옮기기 전에 '확인' 을 연달아 눌러도 한 번만 알린다 (온보딩은 확인이 사무실 결정을 흉내 낸다)
  const acknowledged = useRef(false);
  const acknowledge = () => {
    if (!acknowledged.current) {
      acknowledged.current = true;
      onConfirm();
    }
  };

  return (
    <SafeAreaView
      edges={flowLayouts[flow].edges}
      style={flowLayouts[flow].screen}
    >
      <SubScreenHeader
        title={flow === 'onboarding' ? '승인 대기' : '조직 참여하기'}
        onBack={onBack}
        titleRef={titleRef}
      />
      <ScrollView
        {...noOverscroll}
        contentContainerStyle={[readableColumn, styles.content, look.content]}
      >
        <View style={[styles.intro, look.intro]}>
          <Icon name="modal-check" size={onboarding ? 40 : 48} />
          <View style={look.texts}>
            <Text
              accessibilityRole="header"
              variant="Body/L/Bold"
              style={styles.center}
            >
              참여 요청을 보냈어요
            </Text>
            <Text
              variant={onboarding ? 'Body/XS/Medium' : 'Body/XS/Regular'}
              color={colors.gray[600]}
              style={styles.center}
            >
              사무실에서 요청을 확인하면 알려드릴게요.
            </Text>
          </View>
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
                  variant={
                    onboarding ? 'Caption/M/SemiBold' : 'Caption/M/Medium'
                  }
                  color={
                    index === 0
                      ? onboarding
                        ? colors.gray[700]
                        : colors.gray[900]
                      : colors.gray[500]
                  }
                >
                  {step}
                </Text>
              </View>
            </Fragment>
          ))}
        </View>

        {/* 값 글자는 마이(3235:14886)가 Medium, 온보딩(3227:8824)이 SemiBold 다 */}
        <SummaryCard
          valueVariant={
            flow === 'onboarding' ? 'Caption/M/SemiBold' : 'Caption/M/Medium'
          }
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
          color={onboarding ? colors.libraryGray[500] : colors.gray[500]}
          style={styles.center}
        >
          승인 전까지 회사의 일정과 작업은 표시되지 않습니다.
        </Text>
      </ScrollView>

      {onboarding && (
        <View style={[readableColumn, styles.notice]}>
          <InfoNotice message="이전 코드·링크·QR을 통한 새로운 요청은 차단됩니다." />
        </View>
      )}
      <View
        style={[
          readableColumn,
          styles.actions,
          look.actions,
          flowLayouts[flow].actions,
        ]}
      >
        <CTA
          variant="outline"
          label="신청 취소"
          onPress={() => setCanceling(true)}
          style={styles.action}
        />
        <CTA label="확인" onPress={acknowledge} style={styles.action} />
      </View>

      {/* 신청 취소 확인은 화면 가운데 모달이다 (#98). 신청 현황(JoinRequestsScreen)은 바텀 시트 그대로다 */}
      <CancelRequestModal
        request={canceling ? request : null}
        onClose={() => setCanceling(false)}
        onConfirm={requestId => {
          if (canceled.current) {
            return;
          }
          canceled.current = true;
          setCanceling(false);
          onCancel(requestId);
        }}
      />
    </SafeAreaView>
  );
}

const STEP_SIZE = 36;

const styles = StyleSheet.create({
  content: { gap: 24, paddingHorizontal: 24, paddingBottom: 24 },
  intro: { alignItems: 'center' },
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
  // 안내 상자는 아래 버튼 줄 위 16 에 붙는다 (Figma 위치 684)
  notice: { paddingHorizontal: 24, paddingBottom: 16 },
  actions: { flexDirection: 'row' },
  action: { flex: 1 },
});

// 마이(3235:14886)와 온보딩(3227:8824)의 Figma 값이 자리마다 다르다.
// 온보딩: 머리 아래 42 에 아이콘(40), 아이콘과 문구 사이 24, 제목과 설명 사이 6, 버튼 사이 10
const looks = {
  my: StyleSheet.create({
    content: { paddingTop: 32 },
    intro: { gap: 8 },
    texts: { gap: 8 },
    actions: { gap: 8 },
  }),
  onboarding: StyleSheet.create({
    content: { paddingTop: 42 },
    intro: { gap: 24 },
    texts: { gap: 6 },
    actions: { gap: 10 },
  }),
} satisfies Record<JoinFlow, unknown>;
