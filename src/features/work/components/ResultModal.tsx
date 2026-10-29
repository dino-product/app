import { Modal, StyleSheet, View } from 'react-native';
import {
  colors,
  CTA,
  Icon,
  Text,
  withOpacity,
} from '../../../shared/design-system';
import type { SubmitResult } from '../model';

// 완료보고 제출 결과 모달: 제출 완료 / 작업이 취소되었습니다
export function ResultModal({
  visible,
  result,
  onConfirm,
}: {
  visible: boolean;
  result: SubmitResult;
  onConfirm: () => void;
}) {
  const submitted = result.kind === 'submitted';
  const rows = submitted
    ? [
        { label: '상태', value: '완료' },
        { label: '제출 시간', value: result.at },
      ]
    : [
        { label: '취소 사유', value: result.reason, emphasis: true },
        { label: '취소 시각', value: result.at },
      ];

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onConfirm}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View
            style={[
              styles.badge,
              submitted ? styles.badgeSuccess : styles.badgeDanger,
            ]}
          >
            <Icon
              name={submitted ? 'check' : 'close'}
              size={20}
              color={submitted ? colors.accepted[1] : colors.warning[1]}
            />
          </View>
          <Text accessibilityRole="header" variant="Body/S/Bold">
            {submitted ? '제출 완료' : '작업이 취소되었습니다'}
          </Text>
          <Text
            variant="Caption/M/Regular"
            color={colors.gray[600]}
            style={styles.description}
          >
            {submitted
              ? '작업이 완료 처리되었습니다'
              : '등록 담당자가 이 작업을\n취소했습니다'}
          </Text>
          <View style={styles.summary}>
            {rows.map(row => (
              <View key={row.label} style={styles.row}>
                <Text variant="Caption/S/Medium" color={colors.gray[600]}>
                  {row.label}
                </Text>
                <Text
                  variant="Caption/S/Medium"
                  color={
                    'emphasis' in row ? colors.warning[1] : colors.gray[900]
                  }
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
          <CTA
            type="modal"
            label="메인 화면으로"
            onPress={onConfirm}
            style={styles.cta}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withOpacity('#000000', 0.4),
  },
  card: {
    width: 262,
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.white[100],
  },
  badge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  badgeSuccess: { backgroundColor: colors.accepted[2] },
  badgeDanger: { backgroundColor: colors.warning[2] },
  description: { textAlign: 'center' },
  summary: {
    alignSelf: 'stretch',
    gap: 6,
    marginTop: 4,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.gray[50],
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cta: { alignSelf: 'stretch', marginTop: 8 },
});
