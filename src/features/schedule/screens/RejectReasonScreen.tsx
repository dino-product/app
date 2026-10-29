import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  CTA,
  Icon,
  Text,
  TextArea,
} from '../../../shared/design-system';
import {
  rejectReasons,
  validateRejection,
  type RejectReasonKey,
} from '../model';

// Figma 스케줄 › 거절 사유
const errorMessages = {
  select: '거절 사유를 선택해 주세요.',
  otherText: '기타 사유를 입력해 주세요.',
} as const;

export function RejectReasonScreen({
  onBack,
  onSubmit,
}: {
  /** 뒤로 가기·취소 */
  onBack: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [selected, setSelected] = useState<RejectReasonKey | null>(null);
  const [otherText, setOtherText] = useState('');
  const [error, setError] = useState<keyof typeof errorMessages | null>(null);

  const select = (key: RejectReasonKey) => {
    setSelected(key);
    setError(null);
  };

  const submit = () => {
    const result = validateRejection(selected, otherText);
    if (result.ok) {
      onSubmit(result.reason);
    } else {
      setError(result.error);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={10}
          onPress={onBack}
          style={styles.back}
        >
          <Icon name="chevron-left" />
        </Pressable>
        <Text
          accessibilityRole="header"
          variant="Body/M/SemiBold"
          color={colors.mainText}
        >
          거절 사유
        </Text>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
      >
        <View style={styles.intro}>
          <Text variant="Body/XL/Bold">작업을 거절할까요?</Text>
          <Text variant="Caption/M/Regular" color={colors.gray[600]}>
            거절 사유를 선택해 주세요. 사유는 등록 담당자에게 전달됩니다.
          </Text>
        </View>

        <View accessibilityRole="radiogroup" style={styles.options}>
          {rejectReasons.map(reason => {
            const checked = selected === reason.key;
            const isOther = reason.key === 'other';
            return (
              <Pressable
                key={reason.key}
                accessibilityRole="radio"
                accessibilityLabel={isOther ? '기타 (직접 입력)' : reason.label}
                accessibilityState={{ checked }}
                onPress={() => select(reason.key)}
                style={[styles.option, checked && styles.optionChecked]}
              >
                <Text variant="Body/XS/Medium">
                  {reason.label}
                  {isOther && (
                    <Text variant="Body/XS/Medium" color={colors.gray[500]}>
                      {' (직접 입력)'}
                    </Text>
                  )}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.other}>
          <Text variant="Body/XS/SemiBold">기타 사유를 직접 입력해 주세요</Text>
          <TextArea
            label="기타 거절 사유 입력"
            placeholder="거절 사유를 입력해 주세요."
            value={otherText}
            onChangeText={text => {
              setOtherText(text);
              setError(null);
            }}
            error={error === 'otherText'}
          />
          {error && (
            <Text
              accessibilityLiveRegion="polite"
              variant="Caption/M/Medium"
              color={colors.warning[1]}
              style={styles.error}
            >
              {errorMessages[error]}
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <CTA
          size="M"
          variant="outline"
          label="취소"
          onPress={onBack}
          style={styles.action}
        />
        <CTA
          size="M"
          label="거절 제출"
          onPress={submit}
          style={styles.action}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 20 },
  content: {
    gap: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  intro: { gap: 8 },
  options: { gap: 10 },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  optionChecked: {
    borderColor: colors.secondary,
    backgroundColor: colors.select[1],
  },
  other: { gap: 12 },
  error: { textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  action: { flex: 1 },
});
