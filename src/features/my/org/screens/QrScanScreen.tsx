import { useEffect, useRef, useState, type Ref } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  CTA,
  Icon,
  ICON_HIT_SLOP,
  Text,
  withOpacity,
} from '../../../../shared/design-system';
import { RETRY_LABEL } from '../../../../shared/layout/LoadStateView';
import { useLightStatusBar } from '../../../../shared/layout/useLightStatusBar';
import { QrCamera } from '../components/QrCamera';
import { companyCodeFromQr } from '../model';

// 회사 찾기 › QR 코드 인식 (#108). Figma 에 QR 스캔·권한 거부·인식 실패 화면이 없어 최소 구성이다 (Figma 에 없음):
// 전체 화면 카메라, 가운데 사각 안내, 닫기. 카메라 권한은 회사 찾기에서 받고 연다 (OrgJoinScreen).
// QR 에서 회사 코드(companyCodeFromQr)를 읽으면 카메라를 끄고 그 코드만 넘긴다. 바깥은 이 화면을 닫고 회사 찾기로 돌아가
// 거기서 QR 경로(QR_CODE)로 회사를 확인하고 결과(역할 선택·안내 모달)를 앱 화면 위에 보인다 (#195).
// 회사 코드가 없는 QR 은 돌아갈 결과가 없어 카메라에 머물러 다른 QR 을 비추게 한다. 문구는 기본안이다
const messages = {
  guide: '회사에서 받은 QR 코드를 사각형 안에 비춰 주세요.',
  unrecognized: '인식할 수 없는 QR 코드예요.\n회사 참여 QR 코드를 비춰 주세요.',
  cameraFailed:
    '카메라를 켜지 못했어요.\n설정에서 카메라 접근을 허용했는지 확인해 주세요.',
};

/** 가운데 사각 안내의 한 변 (기본안) */
const FRAME_SIZE = 240;

export function QrScanScreen({
  focused,
  onClose,
  onScanned,
  titleRef,
}: {
  /** 화면이 보이는지 (내비게이션 포커스). 보이고 앱이 앞에 있을 때만 카메라를 켠다 */
  focused: boolean;
  onClose: () => void;
  /** QR 에서 읽은 회사 코드. 한 번만 부른다 (바깥이 이 화면을 닫고 회사를 확인한다) */
  onScanned: (companyCode: string) => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const appActive = useAppActive();
  const [unrecognized, setUnrecognized] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  // 회사 코드를 읽었다. 카메라를 끄고 더는 읽지 않는다.
  // 카메라를 끄는 렌더가 반영되기 전에 온 프레임도 넘기지 않게 ref 로 바로 막는다
  const [scanned, setScanned] = useState(false);
  const scannedRef = useRef(false);
  // 마지막으로 처리한 QR 값. QR 이 보이는 동안 프레임마다 같은 값이 와도 한 번만 처리한다
  const lastValue = useRef<string | null>(null);
  // 검은 카메라 화면이라 보이는 동안만 상태 표시줄 글자를 흰색으로 둔다
  useLightStatusBar(focused);

  // 프레임마다 불린다. 이미 읽었거나 같은 QR 이면 상태를 바꾸지 않고 바로 돌아간다 (다시 그리지 않는다)
  const onFrameScanned = (values: string[]) => {
    if (scannedRef.current) {
      return;
    }
    // 한 프레임에 QR 이 여럿이면 회사 코드가 든 첫 QR 을 쓴다
    const items = values.map(value => ({
      value,
      code: companyCodeFromQr(value),
    }));
    const { value, code } = items.find(item => item.code !== null) ?? items[0];
    if (value === lastValue.current) {
      return;
    }
    lastValue.current = value;
    if (code === null) {
      setUnrecognized(true);
      if (Platform.OS === 'ios') {
        // accessibilityLiveRegion 은 Android 만 읽으므로 iOS 만 따로 알린다 (Android 에서 알리면 두 번 읽는다)
        AccessibilityInfo.announceForAccessibility(
          messages.unrecognized.replace('\n', ' '),
        );
      }
      return;
    }
    // 닫히는 동안 방금 비춘 일반 QR 의 '인식할 수 없다' 가 남지 않게 기본 안내로 돌린다
    scannedRef.current = true;
    setUnrecognized(false);
    setScanned(true);
    onScanned(code);
  };

  const message = cameraFailed
    ? messages.cameraFailed
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
            isActive={focused && appActive && !scanned}
            onScanned={onFrameScanned}
            onError={() => setCameraFailed(true)}
          />
        </View>
      )}

      {/* 가운데 사각형 밖을 어둡게 해 비출 곳을 보인다. 다시 시도(카메라 실패) 버튼만 누를 수 있다 */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View pointerEvents="none" style={styles.dim} />
        <View pointerEvents="none" style={styles.frameRow}>
          <View style={styles.dim} />
          <View testID="qr-guide-frame" style={styles.frame} />
          <View style={styles.dim} />
        </View>
        <View pointerEvents="box-none" style={[styles.dim, styles.below]}>
          <Text
            accessibilityLiveRegion="polite"
            variant="Body/XS/Medium"
            color={colors.white[100]}
            style={styles.message}
          >
            {message}
          </Text>
          {cameraFailed && (
            <CTA
              size="M"
              label={RETRY_LABEL}
              onPress={() => setCameraFailed(false)}
            />
          )}
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
    // 첫 렌더에서 읽은 뒤 구독하기 전에 바뀌었으면(이벤트를 놓침. iOS 첫 권한 대화상자가 닫힐 때) 지금 값으로 맞춘다
    setActive(AppState.currentState === 'active');
    return () => subscription.remove();
  }, []);
  return active;
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
  below: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  message: { textAlign: 'center' },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
  headerRow: { height: 56, alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', left: 20 },
});
