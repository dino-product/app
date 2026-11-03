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
import { SubScreenHeader } from '../../components/SubScreenHeader';
import { participationTypeLabels, type ParticipationType } from '../model';

// Figma 회사찾기 › 역할 선택 (3278:20936 고르기 전 / 3278:20974 기사 선택)
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
  organizationName,
  onBack,
  onSubmit,
  titleRef,
}: {
  organizationName: string;
  onBack: () => void;
  onSubmit: (type: ParticipationType) => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const [selected, setSelected] = useState<ParticipationType | null>(null);
  // 요청 완료로 넘어가기 전에 연달아 눌러도 같은 회사에 한 번만 요청한다
  const submitted = useRef(false);
  const submit = () => {
    if (selected === null || submitted.current) {
      return;
    }
    submitted.current = true;
    onSubmit(selected);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader
        title="조직 참여하기"
        onBack={onBack}
        titleRef={titleRef}
      />
      <ScrollView contentContainerStyle={[readableColumn, styles.content]}>
        <View style={styles.intro}>
          <Text accessibilityRole="header" variant="Body/XL/Bold">
            역할을 선택해주세요
          </Text>
          <Text variant="Caption/M/Medium" color={colors.gray[600]}>
            참여할 회사와 유형을 확인해 주세요.
          </Text>
        </View>

        <View accessible style={styles.company}>
          <Text variant="Caption/M/Medium" color={colors.gray[600]}>
            회사명
          </Text>
          <Text variant="Body/XL/Bold" color={colors.gray[800]}>
            {organizationName}
          </Text>
        </View>

        <View style={styles.types}>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            variant="Caption/M/SemiBold"
            color={colors.gray[800]}
          >
            참여 유형
          </Text>
          {/* 스크린리더는 "기사, 라디오 버튼, 선택됨, 2개 중 2번째" 처럼 읽는다 */}
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="참여 유형"
            style={styles.options}
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
                  style={[styles.option, checked && styles.optionChecked]}
                >
                  <View style={styles.optionText}>
                    <Text variant="Body/XS/SemiBold">{label}</Text>
                    <Text variant="Caption/M/Medium" color={colors.gray[600]}>
                      {option.description}
                    </Text>
                  </View>
                  <View style={[styles.radio, checked && styles.radioChecked]}>
                    {checked && <View style={styles.radioDot} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.hint}>
          <Icon name="info-circle" size={16} color={colors.gray[600]} />
          <Text
            variant="Caption/S/Medium"
            color={colors.gray[600]}
            style={styles.hintText}
          >
            선택한 유형은 희망 유형이에요. 최종 유형은 사무실에서 승인할 때
            확정돼요.
          </Text>
        </View>
      </ScrollView>

      <View style={[readableColumn, styles.actions]}>
        <CTA
          label="참여 요청하기"
          disabled={selected === null}
          onPress={submit}
        />
      </View>
    </SafeAreaView>
  );
}

const RADIO_SIZE = 22;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 16,
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
  actions: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
});
