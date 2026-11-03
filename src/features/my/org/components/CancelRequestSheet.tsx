import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BottomSheet,
  colors,
  CTA,
  Text,
} from '../../../../shared/design-system';
import type { ParticipationRequest } from '../model';

// Figma 마이페이지-신청 취소 바텀시트 (2889:13197)
export function CancelRequestSheet({
  request,
  onClose,
  onClosed,
  onConfirm,
}: {
  /** 취소할 신청. null 이면 시트가 닫혀 있다 */
  request: ParticipationRequest | null;
  onClose: () => void;
  /** 시트가 다 내려간 뒤 */
  onClosed?: () => void;
  onConfirm: (requestId: string) => void;
}) {
  // 시트가 내려가는 동안에도 방금 보던 회사 이름을 그대로 보여 준다
  const [shown, setShown] = useState(request);
  if (request !== null && request !== shown) {
    setShown(request);
  }
  const name = shown?.organizationName ?? '';

  return (
    <BottomSheet
      visible={request !== null}
      onClose={onClose}
      onClosed={onClosed}
      testID="cancel-request-sheet"
    >
      <View style={styles.body}>
        <Text
          accessibilityRole="header"
          accessibilityLabel={`${name} 참여 신청을 취소할까요?`}
          variant="Body/M/SemiBold"
          style={styles.center}
        >
          {`${name} 참여 신청을\n취소할까요?`}
        </Text>
        <Text
          variant="Caption/M/Medium"
          color={colors.gray[600]}
          style={styles.center}
        >
          {
            '취소하면 사무실의 승인 대기 목록에서도 사라져요.\n같은 회사 코드로 언제든 다시 신청할 수 있어요.'
          }
        </Text>
      </View>
      <View style={styles.actions}>
        <CTA
          size="M"
          variant="outline"
          label="닫기"
          onPress={onClose}
          style={styles.action}
        />
        <CTA
          size="M"
          variant="reject"
          label="취소"
          onPress={() => shown && onConfirm(shown.requestId)}
          style={styles.action}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, marginBottom: 28 },
  center: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
});
