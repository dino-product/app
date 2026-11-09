import { Modal, StyleSheet, View } from 'react-native';
import {
  colors,
  CTA,
  Icon,
  Text,
  withOpacity,
} from '../../../shared/design-system';
import type { SubmitResult } from '../model';

// 완료보고 제출 결과 모달: 제출 완료 / 작업이 취소되었습니다.
// Figma 제출 완료(2741:22853)·작업 취소(2741:26603) 의 Modal: 뒤 검정 50%, 폭 262·모서리 24·좌우 20.
// 위 24 에 아이콘 40, 16 아래 제목 → 위아래 12 안의 설명 → 요약 상자 → 위 16·아래 24 안의 버튼 (#180)
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
      {/* VoiceOver 두 손가락 Z 도 "메인 화면으로" 와 같이 닫는다. iOS 의 RN Modal 은 escape 를 처리하지 않아 모달 안의 배경 View 가 받는다.
          escape 핸들러는 Fabric 평탄화 판단에 들어가지 않아, 배경색이 빠져도 뷰가 남도록 collapsable={false} 로 둔다 */}
      <View
        collapsable={false}
        onAccessibilityEscape={onConfirm}
        style={styles.backdrop}
      >
        <View style={styles.card} testID="result-modal-card">
          <View style={styles.head}>
            <Icon
              name={submitted ? 'submit-check' : 'modal-x'}
              size={40}
              testID="result-modal-icon"
            />
            <Text
              accessibilityRole="header"
              variant="Body/S/Bold"
              style={styles.centered}
            >
              {submitted ? '제출 완료' : '작업이 취소되었습니다'}
            </Text>
          </View>
          <View style={styles.description}>
            {/* Figma 설명 글자는 라이브러리 Gray500 (#7F7F7F) */}
            <Text
              variant="Caption/M/Medium"
              color={colors.libraryGray[500]}
              style={styles.centered}
            >
              {submitted
                ? '작업이 완료 처리되었습니다'
                : '등록 담당자가 이 작업을 취소했습니다'}
            </Text>
          </View>
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
          <View style={styles.footer}>
            <CTA type="modal" label="메인 화면으로" onPress={onConfirm} />
          </View>
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
    backgroundColor: withOpacity('#000000', 0.5),
  },
  card: {
    width: 262,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: colors.white[100],
  },
  // Frame 2117905339: 위 24, 아이콘 40 ↔ 제목 16
  head: { alignItems: 'center', gap: 16, paddingTop: 24 },
  centered: { textAlign: 'center' },
  // Frame 14: 위아래 12
  description: { alignItems: 'center', paddingVertical: 12 },
  // Frame 2147239460: 모서리 8, Gray50, 안쪽 12, 줄 사이 4
  summary: {
    gap: 4,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.gray[50],
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  // Frame 10: 버튼 위 16, 아래 24
  footer: { paddingTop: 16, paddingBottom: 24 },
});
