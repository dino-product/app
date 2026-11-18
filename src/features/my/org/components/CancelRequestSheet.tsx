import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BottomSheet,
  colors,
  CTA,
  Text,
} from '../../../../shared/design-system';
import type { ParticipationRequest } from '../model';
import {
  cancelRequestMessage,
  cancelRequestTitle,
  cancelRequestTitleLabel,
} from './cancelRequestCopy';

// Figma 마이페이지-신청 취소 바텀시트 (2889:13197). 제목 Heading/XS, 설명 Caption/M/Regular (#200)
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
          accessibilityLabel={cancelRequestTitleLabel(name)}
          variant="Heading/XS"
          color={colors.gray[900]}
          style={styles.center}
        >
          {cancelRequestTitle(name)}
        </Text>
        <Text
          variant="Caption/M/Regular"
          color={colors.gray[600]}
          style={styles.center}
        >
          {cancelRequestMessage}
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

// Figma 2889:13037: 제목–설명 12(제목 칸 아래 여백), 설명 아래 24 + 버튼 줄 위 10, 버튼 사이 10.
// 시트 틀(모서리·손잡이·위아래 여백)은 공용 BottomSheet confirm 모양을 그대로 쓴다
const styles = StyleSheet.create({
  body: { gap: 12, marginBottom: 24 + 10 },
  center: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
