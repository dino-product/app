import { useEffect, useRef, useState, type Ref } from 'react';
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
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import { ConfirmModal } from '../components/ConfirmModal';
import { MenuRow } from '../components/MenuRow';
import { SubScreenHeader } from '../components/SubScreenHeader';
import {
  canWithdraw,
  type WithdrawalBlock,
  type WithdrawalEligibility,
} from '../model';

// Figma 마이페이지-계정 관리 화면 (2889:14188). 탈퇴 확인 실패 알림창 문구는 Figma 에 없어 기본안이다
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
  // 확인하는 동안 화면을 떠났으면(뒤로 가기) 늦게 온 결과로 이동하지 않는다
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Figma 로그아웃 확인 모달 (2975:16358)
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const withdraw = async () => {
    if (checkingRef.current) {
      return;
    }
    checkingRef.current = true;
    setChecking(true);
    try {
      const eligibility = await checkWithdrawal();
      if (!mounted.current) {
        return;
      }
      if (canWithdraw(eligibility)) {
        onOpenWithdrawal();
      } else {
        onOpenWithdrawalBlocked(eligibility.blocks);
      }
    } catch {
      if (!mounted.current) {
        return;
      }
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
      <ScrollView
        {...noOverscroll}
        contentContainerStyle={[readableColumn, styles.content]}
      >
        {/* 화면 제목과 같은 이름이라 스크린리더에서는 한 번만 읽게 뺀다 */}
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          variant="Body/S/SemiBold"
        >
          계정 관리
        </Text>
        <View style={styles.rows}>
          <MenuRow label="로그아웃" onPress={() => setConfirmingLogout(true)} />
          <MenuRow
            label="계정 탈퇴"
            tone="danger"
            disabled={checking}
            onPress={withdraw}
          />
        </View>
      </ScrollView>

      <ConfirmModal
        visible={confirmingLogout}
        title="로그아웃 할까요?"
        onCancel={() => setConfirmingLogout(false)}
        onConfirm={() => {
          setConfirmingLogout(false);
          onLogout();
        }}
      />
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
