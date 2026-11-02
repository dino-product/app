import { useRef, useState, type Ref } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Text } from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { MenuRow } from '../components/MenuRow';
import { SubScreenHeader } from '../components/SubScreenHeader';
import {
  canWithdraw,
  type WithdrawalBlock,
  type WithdrawalEligibility,
} from '../model';

// Figma 마이페이지-계정 관리 화면 (2889:14188). 확인 알림창 문구는 Figma 에 없어 기본안이다
export function AccountScreen({
  onBack,
  onLogout,
  checkWithdrawal,
  onOpenWithdrawal,
  onOpenWithdrawalBlocked,
  titleRef,
}: {
  onBack: () => void;
  onLogout: () => void;
  /** 지금 탈퇴할 수 있는지 서버에 묻는다 (withdrawal-eligibility) */
  checkWithdrawal: () => Promise<WithdrawalEligibility>;
  onOpenWithdrawal: () => void;
  onOpenWithdrawalBlocked: (blocks: readonly WithdrawalBlock[]) => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const [checking, setChecking] = useState(false);
  // 다시 그리기 전에 연달아 눌러도 한 번만 묻는다
  const checkingRef = useRef(false);

  const confirmLogout = () =>
    Alert.alert(
      '로그아웃할까요?',
      undefined,
      [
        { text: '취소', style: 'cancel' },
        { text: '로그아웃', onPress: onLogout },
      ],
      { cancelable: true },
    );

  const withdraw = async () => {
    if (checkingRef.current) {
      return;
    }
    checkingRef.current = true;
    setChecking(true);
    try {
      const eligibility = await checkWithdrawal();
      if (canWithdraw(eligibility)) {
        onOpenWithdrawal();
      } else {
        onOpenWithdrawalBlocked(eligibility.blocks);
      }
    } catch {
      Alert.alert(
        '탈퇴할 수 있는지 확인하지 못했어요',
        '잠시 후 다시 시도해 주세요.',
      );
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader title="계정 관리" onBack={onBack} titleRef={titleRef} />
      <ScrollView contentContainerStyle={[readableColumn, styles.content]}>
        {/* 화면 제목과 같은 이름이라 스크린리더에서는 한 번만 읽게 뺀다 */}
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          variant="Body/S/SemiBold"
        >
          계정 관리
        </Text>
        <View style={styles.rows}>
          <MenuRow label="로그아웃" onPress={confirmLogout} />
          <MenuRow
            label="계정 탈퇴"
            tone="danger"
            disabled={checking}
            onPress={withdraw}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  content: {
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
  },
  rows: { gap: 12 },
});
