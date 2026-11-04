import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { isApiError, useApiClient } from '../../../shared/api';
import { colors, CTA, Text, TextArea } from '../../../shared/design-system';
import { KeyboardAvoidingArea } from '../../../shared/keyboard/KeyboardAvoidingArea';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import {
  currentAccountId,
  ProfileErrorCode,
} from '../../onboarding/profileApi';
import { SubScreenHeader } from '../components/SubScreenHeader';
import {
  WITHDRAWAL_REASON_MAX_LENGTH,
  withdrawAccount,
  withdrawalEligibilityQueryKey,
  withdrawalMutationKey,
} from '../withdrawalApi';

// Figma 마이페이지-탈퇴 (2935:15259). 최종 확인 뒤 POST /profiles/{accountId}/withdrawals 로 사유와 함께 탈퇴한다 (#115).
// 204 면 onWithdrawn(세션을 끝내고 로그인 화면), 탈퇴 직전에 막는 사유가 생겼으면(PROFILE-006) onBlocked(탈퇴 불가 화면),
// 그 밖의 실패는 머물러 알린다. 실패 알림창은 Figma 에 없어 기본안이다 (Figma 미확인)
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
  onWithdrawn,
  onBlocked,
  titleRef,
}: {
  onBack: () => void;
  /** 서버가 탈퇴를 마쳤다(204). 계정이 닫혀 모든 토큰이 무효다 */
  onWithdrawn: () => void;
  /** 탈퇴 직전에 막는 사유가 생겼다(PROFILE-006). 탈퇴 불가 화면이 가능 여부를 다시 묻는다 */
  onBlocked: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  // 본인 accountId 는 기기 세션에서 읽는다. 사유는 선택이라 빈 문자열일 수 있다
  // 탈퇴를 마치면 세션 종료(onWithdrawn)는 useMutation 옵션에서 한다. mutate 에 넘긴 콜백은 화면을 떠나면
  // 불리지 않아(TanStack v5) 204 를 받고도 로그인해 둔 채가 된다. 보내는 동안 떠나지 못하게 경로가 키로 막는다
  const withdrawal = useMutation({
    mutationKey: withdrawalMutationKey,
    mutationFn: async (text: string) =>
      withdrawAccount(api, await currentAccountId(api), text),
    onSuccess: () => onWithdrawn(),
  });
  // 보내는 동안과, 탈퇴를 마치고 로그인 화면으로 가는 동안에는 다시 보내거나 뒤로 가지 않는다
  const locked = withdrawal.isPending || withdrawal.isSuccess;

  const withdraw = () => {
    if (locked) {
      return;
    }
    withdrawal.mutate(reason, {
      onError: error => {
        if (isApiError(error, ProfileErrorCode.withdrawalBlocked)) {
          // 계정 관리에서 받아 둔 '탈퇴 가능' 은 더 맞지 않다. 탈퇴 불가 화면이 새로 받는다
          queryClient.removeQueries({
            queryKey: withdrawalEligibilityQueryKey,
          });
          onBlocked();
          return;
        }
        Alert.alert('탈퇴하지 못했어요', '잠시 후 다시 시도해 주세요.');
      },
    });
  };

  // 되돌릴 수 없으니 한 번 더 묻는다. Figma 에 없는 확인창이라 문구는 기본안이다
  const confirmWithdraw = () =>
    Alert.alert(
      '정말 탈퇴할까요?',
      '탈퇴하면 계정과 데이터를 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '탈퇴', style: 'destructive', onPress: withdraw },
      ],
      { cancelable: true },
    );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader
        title="계정 관리"
        onBack={onBack}
        backDisabled={locked}
        titleRef={titleRef}
      />

      {/* Android 는 edge-to-edge 라 키보드가 떠도 창이 줄지 않아, 가린 만큼 스크롤 영역을 줄인다 */}
      <KeyboardAvoidingArea testID="withdrawal-body">
        <ScrollView
          {...noOverscroll}
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
              maxLength={WITHDRAWAL_REASON_MAX_LENGTH}
            />
          </View>

          <CTA label="탈퇴하기" onPress={confirmWithdraw} disabled={locked} />
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
