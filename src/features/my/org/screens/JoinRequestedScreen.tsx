import { Fragment, useEffect, useRef, useState, type Ref } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, CTA, Icon, Text } from '../../../../shared/design-system';
import { readableColumn } from '../../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../../shared/layout/noOverscroll';
import { MembershipChip } from '../../components/MembershipChip';
import { SubScreenHeader } from '../../components/SubScreenHeader';
import { CancelRequestModal } from '../components/CancelRequestModal';
import { flowLayouts } from '../components/flowLayouts';
import { InfoNotice } from '../components/InfoNotice';
import { SummaryCard, type SummaryRow } from '../components/SummaryCard';
import {
  formatRequestedAt,
  participationTypeLabels,
  requestChannelLabels,
  type JoinFlow,
  type ParticipationRequest,
} from '../model';
import { cancelFailure } from '../notices';
import { useCancelParticipationRequest } from '../participationQueries';

// Figma 회사찾기-요청완료. 마이는 3235:14886, 온보딩(#85)은 승인 대기 3227:8824 이고 머리 제목 '승인 대기', 버튼 위 안내 상자가 더 있다.
// 마이페이지 소속 카드의 검토 줄에서 연 요청(stage 'reviewing', #199)은 같은 화면에 맥락에 맞는 제목을 달고,
// 진행 표시를 '사무실 검토 중' 단계까지 칠하고, 요약 첫 줄에 상태 칩(마이페이지의 검토 칩)을 더한다. 이 셋은 Figma 에 없다.
// 칠한 단계만 다르고 진행 표시 모양(선·원)은 Figma 그대로다 (#219)
// 신청 취소는 서버(POST /participation-requests/{requestId}/cancel)에 보낸다 (#116). 실패 안내는 Figma 에 없어 기본안이고,
// 취소 모달이 닫히는 중에도 뜨도록 시스템 알림(Alert)으로 띄운다 (RN Modal 두 개를 겹쳐 띄우지 않는다)

/**
 * 요청을 어디서 열었는지. sent: 방금 보낸 요청 (조직 참여·온보딩), reviewing: 마이페이지 소속 카드의 검토 줄 (#199).
 * reviewing 은 마이(flow 'my')에서만 쓴다
 */
export type JoinRequestStage = 'sent' | 'reviewing';

// 첫 단계 이름은 마이·온보딩 모두 '요청 완료' 다 (#219, 사용자 확인 · 온보딩 Figma 3227:8846).
// 마이 Figma 3235:14908 의 '검토 중' 은 쓰지 않는다
const STEP_LABELS = ['요청 완료', '사무실 검토 중', '참여 완료'] as const;

/**
 * 머리 제목. 마이페이지 검토 줄에서 연 요청은 보낸 직후가 아니라 승인을 기다리는 요청을 보러 온 것이라,
 * 같은 화면 온보딩 Figma(3227:8827)의 이 상태 제목 '승인 대기' 를 쓴다 (신청 현황 화면 '참여 신청 현황' 과 헷갈리지 않게)
 */
export function joinRequestedTitle(
  flow: JoinFlow,
  stage: JoinRequestStage = 'sent',
): string {
  if (flow === 'onboarding' || stage === 'reviewing') {
    return '승인 대기';
  }
  return '조직 참여하기';
}

export function JoinRequestedScreen({
  flow = 'my',
  stage = 'sent',
  request,
  onConfirm,
  onCanceled,
  onAlreadyDecided,
  onBack,
  titleRef,
}: {
  flow?: JoinFlow;
  stage?: JoinRequestStage;
  request: ParticipationRequest;
  /** 마이는 마이페이지로, 온보딩은 서버에서 사무실의 결정을 확인해 그 화면으로 간다. 실패하면(던지면) 알리고 다시 누를 수 있다 */
  onConfirm: () => void | Promise<void>;
  /** 서버가 신청 취소를 받았다 */
  onCanceled: () => void;
  /** 사무실이 이미 결정했거나(-017) 없는·다른 계정의 요청(-016)이라 취소하지 못했다 (안내를 닫은 뒤). 지금 상태의 화면으로 보낸다 */
  onAlreadyDecided: () => void;
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const [canceling, setCanceling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const cancel = useCancelParticipationRequest();
  const onboarding = flow === 'onboarding';
  const reviewing = !onboarding && stage === 'reviewing';
  const look = looks[flow];
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // 서버가 답하기 전에 모달의 '취소' 를 연달아 눌러도 한 번만 취소한다. 실패하면 다시 취소할 수 있다
  const canceled = useRef(false);
  const cancelRequest = () => {
    if (canceled.current) {
      return;
    }
    canceled.current = true;
    setCanceling(false);
    cancel.mutate(request.requestId, {
      onSuccess: () => onCanceled(),
      onError: error => {
        canceled.current = false;
        const { outdated, title, message } = cancelFailure(error);
        if (outdated) {
          Alert.alert(title, message, [
            { text: '확인', onPress: onAlreadyDecided },
          ]);
        } else {
          Alert.alert(title, message);
        }
      },
    });
  };
  // 화면을 옮기기 전에 '확인' 을 연달아 눌러도 한 번만 알린다. 결과를 기다리면(온보딩) 그동안 버튼을 잠근다
  const acknowledged = useRef(false);
  const acknowledge = async () => {
    if (acknowledged.current) {
      return;
    }
    acknowledged.current = true;
    setConfirming(true);
    try {
      await onConfirm();
    } catch {
      acknowledged.current = false;
      Alert.alert('결과를 확인하지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      if (mounted.current) {
        setConfirming(false);
      }
    }
  };
  const busy = confirming || cancel.isPending;

  const summary: SummaryRow[] = [
    // 상태 칩 값은 마이페이지 소속 카드의 검토 칩(Figma 3235:17157)과 같다 (#199)
    ...(reviewing
      ? [
          {
            label: '상태',
            value: '검토',
            accessory: (
              <MembershipChip status="review" testID="join-request-status" />
            ),
          },
        ]
      : []),
    { label: '회사', value: request.organizationName },
    {
      label: '희망 유형',
      value: participationTypeLabels[request.desiredType],
    },
    // 서버는 요청 경로를 돌려주지 않아 이 앱이 방금 보낸 요청만 안다
    ...(request.requestChannel
      ? [
          {
            label: '요청 경로',
            value: requestChannelLabels[request.requestChannel],
          },
        ]
      : []),
    {
      label: '요청 일시',
      value: formatRequestedAt(request.requestedAt),
    },
  ];

  return (
    <SafeAreaView
      edges={flowLayouts[flow].edges}
      style={flowLayouts[flow].screen}
    >
      <SubScreenHeader
        title={joinRequestedTitle(flow, stage)}
        onBack={onBack}
        titleRef={titleRef}
      />
      <ScrollView
        {...noOverscroll}
        contentContainerStyle={[readableColumn, styles.content, look.content]}
      >
        <View style={look.top}>
          <View style={[styles.intro, look.intro]}>
            <Icon name="modal-check" size={40} />
            <View style={look.texts}>
              <Text
                accessibilityRole="header"
                variant="Body/L/Bold"
                style={styles.center}
              >
                참여 요청을 보냈어요
              </Text>
              <Text
                variant="Body/XS/Medium"
                color={colors.gray[600]}
                style={styles.center}
              >
                사무실에서 요청을 확인하면 알려드릴게요.
              </Text>
            </View>
          </View>
          <Steps flow={flow} reached={reviewing ? 2 : 1} />
        </View>

        <View style={look.summary}>
          {/* 값 글자는 마이(3235:14886)가 Medium, 온보딩(3227:8824)이 SemiBold 다 */}
          <SummaryCard
            valueVariant={
              onboarding ? 'Caption/M/SemiBold' : 'Caption/M/Medium'
            }
            rows={summary}
          />
          <Text
            variant="Caption/S/Medium"
            color={colors.libraryGray[500]}
            style={styles.center}
          >
            승인 전까지 회사의 일정과 작업은 표시되지 않습니다.
          </Text>
        </View>
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
          disabled={busy}
          style={styles.action}
        />
        <CTA
          label="확인"
          onPress={acknowledge}
          disabled={busy}
          style={styles.action}
        />
      </View>

      {/* 신청 취소 확인은 화면 가운데 모달이다 (#98). 신청 현황(JoinRequestsScreen)은 바텀 시트 그대로다 */}
      <CancelRequestModal
        request={canceling ? request : null}
        onClose={() => setCanceling(false)}
        onConfirm={cancelRequest}
      />
    </SafeAreaView>
  );
}

/**
 * 3단계 진행 표시. reached 단계까지 Secondary 로 칠한다 (첫 단계는 체크, 나머지는 번호).
 * 스크린리더는 칠한 단계와 다음 단계를 한 줄로 읽는다
 */
function Steps({ flow, reached }: { flow: JoinFlow; reached: 1 | 2 }) {
  const labels = STEP_LABELS;
  const label = `진행 단계: ${labels
    .slice(0, reached)
    .join(', ')}, 다음은 ${labels.slice(reached).join(', ')}`;
  const items = labels.map((step, index) => {
    const done = index < reached;
    const circle = (
      <View
        style={[
          flow === 'my' ? myStepStyles.circle : onboardingStepStyles.circle,
          done ? styles.stepDone : styles.stepTodo,
        ]}
        testID={`join-step-${index + 1}-circle`}
      >
        {index === 0 ? (
          <Icon
            name="check"
            size={flow === 'my' ? MY_CHECK_SIZE : ONBOARDING_CHECK_SIZE}
            color={colors.white[100]}
          />
        ) : (
          <Text
            variant={flow === 'my' ? 'Body/S/SemiBold' : 'Body/XS/SemiBold'}
            color={colors.white[100]}
          >
            {index + 1}
          </Text>
        )}
      </View>
    );
    return (
      <View
        key={step}
        style={flow === 'my' ? myStepStyles.step : onboardingStepStyles.step}
      >
        {flow === 'my' ? (
          <View style={myStepStyles.disc}>{circle}</View>
        ) : (
          circle
        )}
        <Text
          variant="Caption/M/SemiBold"
          color={done ? colors.gray[700] : colors.gray[500]}
        >
          {step}
        </Text>
      </View>
    );
  });

  if (flow === 'onboarding') {
    // 온보딩은 #85 의 모양 그대로다 (원 36, 단계 폭 88, 단계 사이 선 Gray100 2)
    return (
      <View
        accessible
        accessibilityLabel={label}
        style={onboardingStepStyles.steps}
        testID="join-steps"
      >
        {items.map((item, index) => (
          <Fragment key={labels[index]}>
            {index > 0 && <View style={onboardingStepStyles.line} />}
            {item}
          </Fragment>
        ))}
      </View>
    );
  }
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={myStepStyles.bleed}
      testID="join-steps"
    >
      <View style={myStepStyles.row}>
        <View style={myStepStyles.line} testID="join-steps-line" />
        {items}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingBottom: 24 },
  intro: { alignItems: 'center' },
  center: { textAlign: 'center' },
  stepDone: { backgroundColor: colors.secondary },
  stepTodo: { backgroundColor: colors.gray[200] },
  // 안내 상자는 아래 버튼 줄 위 16 에 붙는다 (Figma 위치 684)
  notice: { paddingHorizontal: 24, paddingBottom: 16 },
  actions: { flexDirection: 'row' },
  action: { flex: 1 },
});

// 온보딩(#85) 진행 표시. 이 작업에서 바꾸지 않는다
const ONBOARDING_STEP_SIZE = 36;
const ONBOARDING_CHECK_SIZE = 20;
const onboardingStepStyles = StyleSheet.create({
  steps: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { alignItems: 'center', gap: 8, width: 88 },
  circle: {
    width: ONBOARDING_STEP_SIZE,
    height: ONBOARDING_STEP_SIZE,
    borderRadius: ONBOARDING_STEP_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    flex: 1,
    height: 2,
    marginTop: ONBOARDING_STEP_SIZE / 2 - 1,
    marginHorizontal: -16,
    backgroundColor: colors.gray[100],
  },
});

// 마이 진행 표시 (Figma 3235:14903). 원은 40 이고 둘레 6 은 배경(흰색)과 같은 색이라 보이지 않는다.
// 그 6 이 뒤의 선을 가려 선이 원에 닿지 않는다. 테두리(borderWidth)로 그리면 둥근 가장자리에 원 색이 번져
// Figma 에 없는 테두리가 보이므로(#219), 원 뒤에 배경색 원판(52)을 따로 둔다.
// 단계는 폭 51·77·51 이 285 안에 놓여 가운데 사이가 117 이다 → 117 칸 셋(351)에 가운데 정렬한다.
// 콘텐츠 폭(345)보다 6 넓어 좌우로 3 씩 내민다. 좁은 화면에서는 칸이 같이 줄어든다
const MY_STEP_SIZE = 40;
const MY_STEP_RING = 6;
const MY_STEP_PITCH = 117;
const MY_STEPS_BLEED = (MY_STEP_PITCH * 3 - 345) / 2;
// Figma 체크는 원 안에서 Modal-check 와 같은 그림이다. 공용 체크 아이콘(24)을 원 크기에 맞춰 쓴다
const MY_CHECK_SIZE = 24;
const CENTER_OF_FIRST = `${100 / 6}%` as const;
const myStepStyles = StyleSheet.create({
  bleed: { marginHorizontal: -MY_STEPS_BLEED },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MY_STEP_PITCH * 3,
  },
  step: { flex: 1, alignItems: 'center', gap: 10 },
  // 원 둘레 6 을 칠한 배경색 원판. 자리는 원(40)만큼만 차지한다
  disc: {
    width: MY_STEP_SIZE + MY_STEP_RING * 2,
    height: MY_STEP_SIZE + MY_STEP_RING * 2,
    borderRadius: MY_STEP_SIZE / 2 + MY_STEP_RING,
    margin: -MY_STEP_RING,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white[100],
  },
  circle: {
    width: MY_STEP_SIZE,
    height: MY_STEP_SIZE,
    borderRadius: MY_STEP_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Figma Line 67: 1 두께 Gray200 실선 한 줄. 노드는 원 위쪽에서 20 이고 선은 그 위 19–20 에 그린다.
  // 첫 원 가운데에서 마지막 원 가운데까지 원 뒤로 지나가, 원판 밖으로 나온 부분만 보인다
  line: {
    position: 'absolute',
    top: MY_STEP_SIZE / 2 - 1,
    left: CENTER_OF_FIRST,
    right: CENTER_OF_FIRST,
    height: 1,
    backgroundColor: colors.gray[200],
  },
});

// 마이(3235:14886)와 온보딩(3227:8824)의 Figma 값이 자리마다 다르다.
// 마이: 머리 아래 36 에 아이콘(40), 아이콘과 문구 사이 24, 제목과 설명(Body/XS/Medium) 사이 6, 안내–진행 24,
//       진행–요약 42, 요약–아래 문구(라이브러리 Gray500) 12, 버튼 사이 10
// 온보딩(#85, 그대로): 머리 아래 42 에 아이콘(40), 아이콘과 문구 사이 24, 제목과 설명 사이 6, 안내–진행 32, 나머지 24, 버튼 사이 10
// 아이콘(40)·설명 글자(Body/XS/Medium Gray600)·아래 문구 색(라이브러리 Gray500)은 두 Figma 가 같다
const looks = {
  my: StyleSheet.create({
    content: { paddingTop: 36, gap: 42 },
    top: { gap: 24 },
    intro: { gap: 24 },
    texts: { gap: 6 },
    summary: { gap: 12 },
    actions: { gap: 10 },
  }),
  onboarding: StyleSheet.create({
    content: { paddingTop: 42, gap: 24 },
    top: { gap: 32 },
    intro: { gap: 24 },
    texts: { gap: 6 },
    summary: { gap: 24 },
    actions: { gap: 10 },
  }),
} satisfies Record<JoinFlow, unknown>;
