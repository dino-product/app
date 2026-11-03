import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import {
  colors,
  CTA,
  Text,
  withOpacity,
} from '../../../../shared/design-system';

// 가운데 확인 모달 (Figma 회사찾기-이미참여 3159:13440). 확인·Android 뒤로가기·두 손가락 Z 로 닫는다
export type Notice = { title: string; message: string };

export function NoticeModal({
  notice,
  onClose,
}: {
  /** null 이면 닫혀 있다 */
  notice: Notice | null;
  onClose: () => void;
}) {
  // 닫히며 흐려지는 동안에도 방금 보던 내용을 그대로 보여 준다
  const [shown, setShown] = useState(notice);
  if (notice !== null && notice !== shown) {
    setShown(notice);
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={notice !== null}
      onRequestClose={onClose}
    >
      {/* iOS 의 RN Modal 은 escape 를 처리하지 않아 모달 안의 배경 View 가 받는다 (ResultModal 과 같다) */}
      <View
        collapsable={false}
        onAccessibilityEscape={onClose}
        style={styles.backdrop}
      >
        {shown && (
          <View style={styles.card}>
            <Text accessibilityRole="header" variant="Body/S/Bold">
              {shown.title}
            </Text>
            <Text
              variant="Caption/M/Medium"
              color={colors.gray[600]}
              style={styles.message}
            >
              {shown.message}
            </Text>
            <CTA
              type="modal"
              label="확인"
              onPress={onClose}
              style={styles.cta}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: withOpacity('#000000', 0.4),
  },
  card: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: 8,
    padding: 20,
    paddingTop: 28,
    borderRadius: 20,
    backgroundColor: colors.white[100],
  },
  message: { textAlign: 'center' },
  cta: { alignSelf: 'stretch', marginTop: 16 },
});
