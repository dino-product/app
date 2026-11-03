import { Modal, StyleSheet, View } from 'react-native';
import { colors, CTA, Text, withOpacity } from '../../../shared/design-system';

// 가운데 확인 모달: 제목 + 취소(테두리)·확인(검정) (Figma 마이페이지 섹션 로그아웃 확인 2975:16358).
// 취소는 버튼·Android 뒤로가기·VoiceOver 두 손가락 Z 로 한다
export function ConfirmModal({
  visible,
  title,
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      {/* iOS 의 RN Modal 은 escape 를 처리하지 않아 모달 안의 배경 View 가 받는다 (ResultModal 과 같다) */}
      <View
        collapsable={false}
        onAccessibilityEscape={onCancel}
        style={styles.backdrop}
      >
        <View style={styles.card}>
          <Text
            accessibilityRole="header"
            variant="Body/S/Bold"
            style={styles.title}
          >
            {title}
          </Text>
          <View style={styles.actions}>
            <CTA
              type="modal"
              variant="outline"
              label={cancelLabel}
              onPress={onCancel}
              style={styles.action}
            />
            <CTA
              type="modal"
              label={confirmLabel}
              onPress={onConfirm}
              style={styles.action}
            />
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
    gap: 22,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
    borderRadius: 20,
    backgroundColor: colors.white[100],
  },
  title: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
});
