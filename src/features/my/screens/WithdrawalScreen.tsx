import { useState, type Ref } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, CTA, Text, TextArea } from '../../../shared/design-system';
import { KeyboardAvoidingArea } from '../../../shared/keyboard/KeyboardAvoidingArea';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { SubScreenHeader } from '../components/SubScreenHeader';

// Figma 마이페이지-탈퇴 (2935:15259)
const notices = [
  {
    title: '서비스 탈퇴 유의사항',
    items: [
      '탈퇴 즉시 모든 발주사 소속이 해제됩니다.',
      '등록한 작업, 완료보고 등 업무 데이터는 발주사 기록에 남으며 개인 계정으로는 더 이상 접근할 수 없습니다.',
      '프로필 사진, 이름, 연락처 등 개인정보는 즉시 삭제됩니다.',
      // iOS 에는 Apple 로그인도 있어 문구는 디자인 확인이 필요하다 (Figma 문구 그대로)
      '탈퇴 후 동일한 카카오 계정으로 재가입할 수 있으나, 기존 데이터는 복구되지 않습니다.',
    ],
  },
  {
    title: '복구 불가 안내',
    items: [
      '탈퇴 후에는 어떠한 방법으로도 계정과 데이터를 되돌릴 수 없습니다. 신중하게 결정해 주세요.',
    ],
  },
] as const;

export function WithdrawalScreen({
  onBack,
  onWithdraw,
  titleRef,
}: {
  onBack: () => void;
  /** 사유는 선택이라 빈 문자열일 수 있다 */
  onWithdraw: (reason: string) => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const [reason, setReason] = useState('');

  // 되돌릴 수 없으니 한 번 더 묻는다. Figma 에 없는 확인창이라 문구는 기본안이다
  const confirmWithdraw = () =>
    Alert.alert(
      '정말 탈퇴할까요?',
      '탈퇴하면 계정과 데이터를 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: () => onWithdraw(reason.trim()),
        },
      ],
      { cancelable: true },
    );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader title="계정 관리" onBack={onBack} titleRef={titleRef} />

      {/* Android 는 edge-to-edge 라 키보드가 떠도 창이 줄지 않아, 가린 만큼 스크롤 영역을 줄인다 */}
      <KeyboardAvoidingArea testID="withdrawal-body">
        <ScrollView
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[readableColumn, styles.content]}
        >
          <View style={styles.intro}>
            <Text
              accessibilityRole="header"
              accessibilityLabel="정말 Orbit을 탈퇴하시겠습니까?"
              variant="Body/XL/Bold"
              style={styles.center}
            >
              정말 Orbit을{'\n'}
              <Text variant="Body/XL/Bold" color={colors.secondary}>
                탈퇴하시겠습니까?
              </Text>
            </Text>
            <Text
              variant="Body/XS/Regular"
              color={colors.gray[600]}
              style={styles.center}
            >
              탈퇴 전 꼭 확인해주세요
            </Text>
          </View>

          {notices.map(notice => (
            <View key={notice.title} style={styles.notice}>
              <Text variant="Caption/M/SemiBold">{notice.title}</Text>
              <View style={styles.items}>
                {notice.items.map(item => (
                  <View key={item} style={styles.item}>
                    <Text variant="Caption/S/Medium" color={colors.gray[600]}>
                      ·
                    </Text>
                    <Text
                      variant="Caption/S/Medium"
                      color={colors.gray[600]}
                      style={styles.itemText}
                    >
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <View style={styles.reason}>
            <Text variant="Body/XS/SemiBold">
              탈퇴 사유{' '}
              <Text variant="Caption/M/SemiBold" color={colors.gray[600]}>
                (선택)
              </Text>
            </Text>
            <TextArea
              label="탈퇴 사유 입력"
              placeholder="탈퇴 사유 입력"
              value={reason}
              onChangeText={setReason}
            />
          </View>

          <CTA label="탈퇴하기" onPress={confirmWithdraw} />
        </ScrollView>
      </KeyboardAvoidingArea>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  content: {
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  intro: { gap: 8, marginBottom: 16 },
  center: { textAlign: 'center' },
  notice: {
    gap: 12,
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.background[3],
  },
  items: { gap: 6 },
  item: { flexDirection: 'row', gap: 6 },
  itemText: { flex: 1 },
  reason: { gap: 12, marginTop: 16, marginBottom: 8 },
});
