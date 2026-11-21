import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import {
  colors,
  CTA,
  Text,
  withOpacity,
} from '../../../../shared/design-system';

// 가운데 확인 모달 (Figma 마이페이지 › 회사찾기 - 이미 참여 51028:17074 의 Modal 51028:17133). 확인·Android 뒤로가기·두 손가락 Z 로 닫는다.
// 뒤 검정 50%, 폭 262·모서리 24(변수 모달)·좌우 20. 위 24 의 제목 → 위아래 12 안의 설명 → 위 16·아래 24 안의 확인 (ResultModal 과 같은 틀)
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
          <View style={styles.card} testID="notice-modal-card">
            {/* 제목 글자색은 변수 Gray800(#222222) 로, 로컬 Gray900 과 같은 값이라 Text 기본색을 쓴다 */}
            <View style={styles.head}>
              <Text
                accessibilityRole="header"
                variant="Body/S/Bold"
                style={styles.centered}
              >
                {shown.title}
              </Text>
            </View>
            <View style={styles.description}>
              {/* Figma 설명 글자는 라이브러리 Gray500 (#7F7F7F) */}
              <Text
                variant="Caption/M/Medium"
                color={colors.libraryGray[500]}
                style={styles.centered}
              >
                {shown.message}
              </Text>
            </View>
            <View style={styles.footer}>
              <CTA type="modal" label="확인" onPress={onClose} />
            </View>
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
    backgroundColor: withOpacity('#000000', 0.5),
  },
  card: {
    width: 262,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: colors.white[100],
  },
  // Frame 2117905339: 위 24
  head: { alignItems: 'center', paddingTop: 24 },
  centered: { textAlign: 'center' },
  // Frame 14: 위아래 12
  description: { alignItems: 'center', paddingVertical: 12 },
  // Frame 10: 버튼 위 16, 아래 24
  footer: { paddingTop: 16, paddingBottom: 24 },
});
