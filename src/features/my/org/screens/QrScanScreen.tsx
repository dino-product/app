import { useEffect, useRef, useState, type Ref } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  Icon,
  ICON_HIT_SLOP,
  Text,
  withOpacity,
} from '../../../../shared/design-system';
import { NoticeModal } from '../components/NoticeModal';
import { QrCamera } from '../components/QrCamera';
import { companyCodeFromQr } from '../model';
import { invalidCodeNotice } from '../notices';
import { useCompanyCheck, type CompanyCheckHandlers } from '../useCompanyCheck';

// 회사 찾기 › QR 코드 인식 (#108). Figma 에 QR 스캔·권한 거부·인식 실패 화면이 없어 최소 구성이다 (Figma 에 없음):
// 전체 화면 카메라, 가운데 사각 안내, 닫기. 카메라 권한은 회사 찾기에서 받고 연다 (OrgJoinScreen).
// QR 에서 꺼낸 회사 코드(companyCodeFromQr)로 회사를 확인하고, 결과는 회사 코드 입력과 같은 갈래다 (useCompanyCheck).
// 찾은 회사는 QR 경로(QR_CODE)의 참여 대상으로 넘긴다. 문구는 기본안이다
const messages = {
  guide: '회사에서 받은 QR 코드를 사각형 안에 비춰 주세요.',
  checking: '회사를 확인하고 있어요.',
  unrecognized: '인식할 수 없는 QR 코드예요.\n회사 참여 QR 코드를 비춰 주세요.',
  cameraFailed:
    '카메라를 켜지 못했어요.\n설정에서 카메라 접근을 허용했는지 확인해 주세요.',
};

/** 가운데 사각 안내의 한 변 (기본안) */
const FRAME_SIZE = 240;

export function QrScanScreen({
  focused,
  onClose,
  onFound,
  onPending,
  onAlreadyMember,
  titleRef,
}: CompanyCheckHandlers & {
  /** 화면이 보이는지 (내비게이션 포커스). 보이고 앱이 앞에 있을 때만 카메라를 켠다 */
  focused: boolean;
  onClose: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const { check, checking, notice, showNotice, closeNotice, isBusy } =
    useCompanyCheck({ onFound, onPending, onAlreadyMember });
  const appActive = useAppActive();
  const [unrecognized, setUnrecognized] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  // 마지막으로 처리한 QR 값. QR 이 보이는 동안 프레임마다 같은 값이 와도 한 번만 처리한다
  const lastValue = useRef<string | null>(null);
  useLightStatusBar(focused);

  // 프레임마다 불린다. 확인 중·안내 중이거나 같은 QR 이면 상태를 바꾸지 않고 바로 돌아간다 (다시 그리지 않는다)
  const onScanned = async (values: string[]) => {
    if (isBusy()) {
      return;
    }
    // 한 프레임에 QR 이 여럿이면 회사 코드가 든 첫 QR 을 쓴다
    const scanned = values.map(value => ({
      value,
      code: companyCodeFromQr(value),
    }));
    const { value, code } =
      scanned.find(item => item.code !== null) ?? scanned[0];
    if (value === lastValue.current) {
      return;
    }
    lastValue.current = value;
    setUnrecognized(code === null);
    if (code === null) {
      if (Platform.OS === 'ios') {
        // accessibilityLiveRegion 은 Android 만 읽으므로 iOS 만 따로 알린다 (Android 에서 알리면 두 번 읽는다)
        AccessibilityInfo.announceForAccessibility(
          messages.unrecognized.replace('\n', ' '),
        );
      }
      return;
    }
    const kind = await check(code, 'QR_CODE');
    if (kind === 'invalid') {
      // 없는 코드·폐기된 이전 코드. 안내를 닫아도 같은 QR 은 다시 확인하지 않는다
      showNotice(invalidCodeNotice);
    } else if (kind === null) {
      // 확인하지 못했다(안내를 띄웠다). 안내를 닫은 뒤 같은 QR 로 다시 확인할 수 있다
      lastValue.current = null;
    }
  };

  const message = cameraFailed
    ? messages.cameraFailed
    : checking
    ? messages.checking
    : unrecognized
    ? messages.unrecognized
    : messages.guide;

  return (
    <View style={styles.screen}>
      {!cameraFailed && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
        >
          <QrCamera
            style={StyleSheet.absoluteFill}
            isActive={focused && appActive}
            onScanned={onScanned}
            onError={() => setCameraFailed(true)}
          />
        </View>
      )}

      {/* 가운데 사각형 밖을 어둡게 해 비출 곳을 보인다 */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.dim} />
        <View style={styles.frameRow}>
          <View style={styles.dim} />
          <View testID="qr-guide-frame" style={styles.frame} />
          <View style={styles.dim} />
        </View>
        <View style={[styles.dim, styles.below]}>
          <Text
            accessibilityLiveRegion="polite"
            variant="Body/XS/Medium"
            color={colors.white[100]}
            style={styles.message}
          >
            {message}
          </Text>
        </View>
      </View>

      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            hitSlop={ICON_HIT_SLOP}
            onPress={onClose}
            style={styles.close}
          >
            <Icon name="close-line" color={colors.white[100]} />
          </Pressable>
          <Text
            ref={titleRef}
            accessibilityRole="header"
            variant="Body/M/SemiBold"
            color={colors.white[100]}
          >
            QR 코드 인식
          </Text>
        </View>
      </SafeAreaView>

      {/* 보이지 않는 동안(다른 화면이 올라옴) 온 안내는 그 화면 위에 띄우지 않고 돌아올 때까지 미룬다 */}
      <NoticeModal notice={focused ? notice : null} onClose={closeNotice} />
    </View>
  );
}

/** 앱이 앞에 있는지 (AppState 'active'). 백그라운드·비활성(제어 센터·앱 전환기)이면 카메라를 끈다 */
function useAppActive() {
  const [active, setActive] = useState(
    () => AppState.currentState === 'active',
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  return active;
}

// 검은 카메라 화면이라 보이는 동안만 상태 표시줄 글자를 흰색으로 둔다
function useLightStatusBar(focused: boolean) {
  useEffect(() => {
    if (!focused) {
      return;
    }
    const entry = StatusBar.pushStackEntry({ barStyle: 'light-content' });
    return () => StatusBar.popStackEntry(entry);
  }, [focused]);
}

const DIM = withOpacity(colors.black, 0.5);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  dim: { flex: 1, backgroundColor: DIM },
  frameRow: { flexDirection: 'row', height: FRAME_SIZE },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderWidth: 2,
    borderColor: colors.white[100],
  },
  below: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 24 },
  message: { textAlign: 'center' },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
  headerRow: { height: 56, alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', left: 20 },
});
