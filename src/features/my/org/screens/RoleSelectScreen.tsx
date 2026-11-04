import { useRef, useState, type Ref } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, CTA, Icon, Text } from '../../../../shared/design-system';
import { readableColumn } from '../../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../../shared/layout/noOverscroll';
import { SubScreenHeader } from '../../components/SubScreenHeader';
import { flowLayouts } from '../components/flowLayouts';
import { InfoNotice } from '../components/InfoNotice';
import { NoticeModal } from '../components/NoticeModal';
import {
  participationTypeLabels,
  type JoinFlow,
  type JoinTarget,
  type ParticipationRequest,
  type ParticipationType,
} from '../model';
import { requestFailure, type RequestFailure } from '../notices';
import { useRequestParticipation } from '../participationQueries';

// Figma 회사찾기 › 역할 선택 (3278:20936 고르기 전 / 3278:20974 기사 선택).
// 온보딩(#85)은 역할 선택 (3255:18530 / 3255:19213) 이고 머리 제목이 '참여 요청' 이다.
// 참여 요청은 서버(POST /api/v1/participation-requests)에 보낸다 (#116). 실패 안내는 Figma 에 없어 기본안이다 (notices)
const options: readonly { type: ParticipationType; description: string }[] = [
  {
    type: 'STAFF',
    description: '사무실에서 작업을 등록하고 기사에게 배정해요',
  },
  {
    type: 'TECHNICIAN',
    description: '배정된 현장 작업을 수락하고 수행·보고해요',
  },
];

export function RoleSelectScreen({
  flow = 'my',
  target,
  onBack,
  onRequested,
  onAlreadyMember,
  onPendingExists,
  titleRef,
}: {
  flow?: JoinFlow;
  /** 참여를 요청할 회사 (회사 코드·찾은 방법) */
  target: JoinTarget;
  /** 뒤로 가기. 그사이 회사 코드가 바뀌어 요청이 거절되면 안내 뒤에도 부른다 (코드를 다시 넣는다) */
  onBack: () => void;
  /** 서버가 만든 요청. 요청 완료로 간다 */
  onRequested: (request: ParticipationRequest) => void;
  /** 이미 참여 중인 회사라 거절됐다 (이미 참여 안내를 닫은 뒤) */
  onAlreadyMember: () => void;
  /** 이 회사에 승인 대기 요청이 있어 거절됐다 (승인 대기 안내를 닫은 뒤) */
  onPendingExists: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const [selected, setSelected] = useState<ParticipationType | null>(null);
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const request = useRequestParticipation();
  // 다시 그리기 전에 연달아 눌러도 같은 회사에 한 번만 요청한다. 실패하면 다시 보낼 수 있다
  const submitting = useRef(false);
  const look = looks[flow];
  const submit = () => {
    if (selected === null || submitting.current) {
      return;
    }
    submitting.current = true;
    // 화면을 떠난 뒤 온 결과는 mutate 의 콜백을 부르지 않는다 (늦은 결과로 화면을 옮기지 않는다)
    request.mutate(
      {
        companyCode: target.companyCode,
        desiredType: selected,
        requestChannel: target.requestChannel,
      },
      {
        onSuccess: created => onRequested(created),
        onError: error => {
          submitting.current = false;
          setFailure(requestFailure(error, target.organizationName));
        },
      },
    );
  };
  // 안내를 닫으면 갈 곳으로 간다. 머무는 실패는 다시 보낼 수 있다
  const closeFailure = () => {
    const next = failure?.next;
    setFailure(null);
    if (next === 'alreadyMember') {
      onAlreadyMember();
    } else if (next === 'pending') {
      onPendingExists();
    } else if (next === 'reenterCode') {
      onBack();
    }
  };

  return (
    <SafeAreaView
      edges={flowLayouts[flow].edges}
      style={flowLayouts[flow].screen}
    >
      <SubScreenHeader
        title={flow === 'onboarding' ? '참여 요청' : '조직 참여하기'}
        onBack={onBack}
        titleRef={titleRef}
      />
      <ScrollView
        {...noOverscroll}
        contentContainerStyle={[readableColumn, look.styles.content]}
      >
        <View style={look.styles.intro}>
          <Text accessibilityRole="header" variant={look.title}>
            역할을 선택해주세요
          </Text>
          <Text variant={look.description} color={colors.gray[600]}>
            참여할 회사와 유형을 확인해 주세요.
          </Text>
        </View>

        <View accessible style={look.styles.company}>
          <Text variant="Caption/M/Medium" color={look.companyLabelColor}>
            회사명
          </Text>
          <Text variant={look.companyName} color={colors.gray[800]}>
            {target.organizationName}
          </Text>
        </View>

        <View style={look.styles.types}>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            variant={look.label}
            color={look.labelColor}
          >
            참여 유형
          </Text>
          {/* 스크린리더는 "기사, 라디오 버튼, 선택됨, 2개 중 2번째" 처럼 읽는다 */}
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="참여 유형"
            style={look.styles.options}
          >
            {options.map((option, index) => {
              const checked = selected === option.type;
              const label = participationTypeLabels[option.type];
              return (
                <Pressable
                  key={option.type}
                  accessibilityRole="radio"
                  accessibilityLabel={`${label}, ${option.description}`}
                  // RN 은 그룹 이름·위치를 플랫폼에 넘기지 않아 힌트로 읽는다
                  accessibilityHint={`참여 유형, ${options.length}개 중 ${
                    index + 1
                  }번째`}
                  accessibilityState={{ checked }}
                  onPress={() => setSelected(option.type)}
                  style={[
                    styles.option,
                    look.styles.option,
                    checked && styles.optionChecked,
                  ]}
                >
                  <View style={styles.optionText}>
                    <Text
                      variant="Body/XS/SemiBold"
                      color={look.optionTitleColor}
                    >
                      {label}
                    </Text>
                    <Text
                      variant={look.optionDescription}
                      color={look.optionDescriptionColor}
                    >
                      {option.description}
                    </Text>
                  </View>
                  {flow === 'onboarding' ? (
                    <Icon
                      name={checked ? 'radio-on' : 'radio-off'}
                      color={checked ? colors.secondary : colors.gray[200]}
                    />
                  ) : (
                    <View
                      style={[styles.radio, checked && styles.radioChecked]}
                    >
                      {checked && <View style={styles.radioDot} />}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {flow === 'onboarding' ? (
          <InfoNotice message={HINT} />
        ) : (
          <View style={styles.hint}>
            <Icon name="info-circle" size={16} color={colors.gray[600]} />
            <Text
              variant="Caption/S/Medium"
              color={colors.gray[600]}
              style={styles.hintText}
            >
              {HINT}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[readableColumn, flowLayouts[flow].actions]}>
        <CTA
          label="참여 요청하기"
          disabled={selected === null || request.isPending}
          onPress={submit}
        />
      </View>

      <NoticeModal notice={failure?.notice ?? null} onClose={closeFailure} />
    </SafeAreaView>
  );
}

const HINT =
  '선택한 유형은 희망 유형이에요. 최종 유형은 사무실에서 승인할 때 확정돼요.';

const RADIO_SIZE = 22;

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  optionChecked: {
    borderColor: colors.secondary,
    backgroundColor: colors.select[1],
  },
  optionText: { flex: 1, gap: 4 },
  radio: {
    width: RADIO_SIZE,
    height: RADIO_SIZE,
    borderRadius: RADIO_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioChecked: { borderColor: colors.secondary },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.secondary,
  },
  hint: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.background[3],
  },
  hintText: { flex: 1 },
});

// 마이(3278:20936 / 3278:20974)와 온보딩(3255:18530 / 3255:19213)의 Figma 값이 자리마다 다르다
const myStyles = StyleSheet.create({
  content: {
    gap: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  intro: { gap: 8 },
  company: {
    gap: 8,
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.background[3],
  },
  types: { gap: 12 },
  options: { gap: 12 },
  option: { padding: 20, borderRadius: 16 },
});

const onboardingStyles = StyleSheet.create({
  // 머리 아래 22 (Figma 위치 132)
  content: {
    gap: 24,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 24,
  },
  intro: { gap: 6 },
  company: {
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.background[3],
  },
  types: { gap: 8 },
  options: { gap: 10 },
  option: { paddingHorizontal: 20, paddingVertical: 16, borderRadius: 12 },
});

const looks = {
  my: {
    styles: myStyles,
    title: 'Body/XL/Bold',
    description: 'Caption/M/Medium',
    companyLabelColor: colors.gray[600],
    companyName: 'Body/XL/Bold',
    label: 'Caption/M/SemiBold',
    labelColor: colors.gray[800],
    optionTitleColor: colors.gray[900],
    optionDescription: 'Caption/M/Medium',
    optionDescriptionColor: colors.gray[600],
  },
  onboarding: {
    styles: onboardingStyles,
    title: 'Body/L/Bold',
    description: 'Body/XS/Medium',
    companyLabelColor: colors.gray[700],
    companyName: 'Body/L/Bold',
    label: 'Caption/M/Medium',
    labelColor: colors.gray[700],
    optionTitleColor: colors.gray[800],
    optionDescription: 'Caption/M/Regular',
    optionDescriptionColor: colors.optionDescription,
  },
} as const satisfies Record<JoinFlow, unknown>;
