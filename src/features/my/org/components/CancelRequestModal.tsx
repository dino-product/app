import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  CTA,
  Icon,
  ICON_HIT_SLOP,
  Text,
  withOpacity,
} from '../../../../shared/design-system';
import type { ParticipationRequest } from '../model';
import {
  cancelRequestMessage,
  cancelRequestTitle,
  cancelRequestTitleLabel,
} from './cancelRequestCopy';

// 참여 요청을 보냈어요 › 신청 취소 확인 (#98). 화면 가운데 모달이고 문구는 신청 현황의 바텀 시트와 같다.
// Figma 프레임이 없어 모양은 NoticeModal(3159:13440) 계열의 기본안이다: 카드 반경 20, 위 28·옆 20 여백, 배경 검정 40%.
// 닫기는 오른쪽 위 X·닫기 버튼·Android 뒤로가기·VoiceOver 두 손가락 Z 로 한다 (신청은 그대로)
export function CancelRequestModal({
  request,
  onClose,
  onConfirm,
}: {
  /** 취소할 신청. null 이면 닫혀 있다 */
  request: ParticipationRequest | null;
  onClose: () => void;
  onConfirm: (requestId: string) => void;
}) {
  // 닫히며 흐려지는 동안에도 방금 보던 회사 이름을 그대로 보여 준다
  const [shown, setShown] = useState(request);
  if (request !== null && request !== shown) {
    setShown(request);
  }
  const name = shown?.organizationName ?? '';

  return (
    <Modal
      transparent
      animationType="fade"
      visible={request !== null}
      onRequestClose={onClose}
    >
      {/* iOS 의 RN Modal 은 escape 를 처리하지 않아 모달 안의 배경 View 가 받는다 (NoticeModal 과 같다) */}
      <View
        collapsable={false}
        onAccessibilityEscape={onClose}
        style={styles.backdrop}
        testID="cancel-request-modal-backdrop"
      >
        <View style={styles.card} testID="cancel-request-modal">
          <View style={styles.texts}>
            <Text
              accessibilityRole="header"
              accessibilityLabel={cancelRequestTitleLabel(name)}
              variant="Body/S/Bold"
              style={styles.title}
            >
              {cancelRequestTitle(name)}
            </Text>
            <Text
              variant="Caption/M/Medium"
              color={colors.gray[600]}
              style={styles.center}
            >
              {cancelRequestMessage}
            </Text>
          </View>
          <View style={styles.actions}>
            <CTA
              type="modal"
              variant="outline"
              label="닫기"
              onPress={onClose}
              style={styles.action}
            />
            <CTA
              type="modal"
              variant="reject"
              label="취소"
              onPress={() => shown && onConfirm(shown.requestId)}
              style={styles.action}
            />
          </View>
          {/* 스크린리더가 제목부터 읽도록 X 는 마지막에 둔다 */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            hitSlop={ICON_HIT_SLOP}
            onPress={onClose}
            style={styles.close}
            testID="cancel-request-modal-close"
          >
            <Icon name="close-line" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const CARD_PADDING = 20;
const CLOSE_INSET = 12;
const CLOSE_SIZE = 24;

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
    gap: 24,
    paddingHorizontal: CARD_PADDING,
    paddingTop: 28,
    paddingBottom: CARD_PADDING,
    borderRadius: 20,
    backgroundColor: colors.white[100],
  },
  texts: { gap: 8 },
  center: { textAlign: 'center' },
  // 가운데 맞춘 긴 회사 이름이 X 밑으로 들어가지 않게 X 자리(+4)만큼 양옆을 비운다
  title: {
    textAlign: 'center',
    paddingHorizontal: CLOSE_INSET + CLOSE_SIZE + 4 - CARD_PADDING,
  },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  close: { position: 'absolute', top: CLOSE_INSET, right: CLOSE_INSET },
});
