import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '../../accessibility/useReduceMotion';
import { readableColumn } from '../../layout/readableColumn';
import { colors, withOpacity } from '../tokens/colors';

// 화면 아래에서 올라오는 시트. 모양은 Figma 시트마다 다르다 (variant).
// confirm: 마이페이지-신청 취소 (2889:13197) — 손잡이, 위 모서리 24, 좌우 여백 24
// document: 온보딩 약관 동의 (3569:7702) — 손잡이 없음, 위 모서리 28, 좌우 여백은 내용이 정한다 (제목 16, 본문 24)
// 닫기 요청(onClose)은 배경 누르기, 아래로 끌기, Android 뒤로가기, VoiceOver 두 손가락 Z 로 온다.
// 바깥이 visible 을 false 로 바꾸면 내려가는 애니메이션이 끝난 뒤 모달을 내린다.
// RN Modal 이라 열려 있는 동안 스크린리더 포커스는 시트 안에 머문다 (iOS 는 모달 화면, Android 는 별도 창)
// 동작 줄이기 설정은 마운트한 뒤 비동기로 읽는다. 처음부터 visible 로 마운트하면 설정을 읽기 전이라
// 애니메이션이 돌 수 있으니, 화면에 늘 두고 visible 만 바꿔 쓴다
export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** 다 내려가 모달을 내린 뒤. 화면을 옮기거나 스크린리더 포커스를 옮기는 일은 여기서 한다 */
  onClosed?: () => void;
  children: ReactNode;
  variant?: 'confirm' | 'document';
  testID?: string;
};

const OPEN_MS = 250;
const CLOSE_MS = 200;
/** 이만큼 끌어내리거나 빠르게 튕기면 닫는다 */
const CLOSE_DISTANCE = 100;
const CLOSE_VELOCITY = 1;
/** 세로로 이만큼 움직이기 전에는 시트 안 버튼의 탭으로 둔다 */
const DRAG_SLOP = 8;

export function BottomSheet({
  visible,
  onClose,
  onClosed,
  children,
  variant = 'confirm',
  testID,
}: BottomSheetProps) {
  const reduceMotion = useReduceMotion();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // 내려가는 애니메이션 동안에도 그려야 하므로 visible 과 따로 둔다
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) {
    setMounted(true);
  }
  // 0 은 화면 아래로 내려간 상태, 1 은 다 올라온 상태
  const [progress] = useState(() => new Animated.Value(0));
  // 손가락으로 끌어내린 거리
  const [dragY] = useState(() => new Animated.Value(0));
  // 바깥이 렌더마다 새 함수를 넘겨도 끄는 중인 응답자·애니메이션을 다시 만들지 않게 최신 값만 담아 둔다
  const callbacks = useRef({ onClose, onClosed });
  useEffect(() => {
    callbacks.current = { onClose, onClosed };
  });

  useEffect(() => {
    if (!mounted) {
      return;
    }
    // 다 내려가면 모달을 내리고 알린다
    const settle = () => {
      if (!visible) {
        setMounted(false);
        callbacks.current.onClosed?.();
      }
    };
    // 동작 줄이기(iOS)·애니메이션 제거(Android) 설정이면 애니메이션 없이 바로 옮긴다
    if (reduceMotion.current) {
      progress.setValue(visible ? 1 : 0);
      if (visible) {
        dragY.setValue(0);
      }
      settle();
      return;
    }
    // 열 때는 끌어내렸던 거리(끌어서 닫히던 중에 다시 연 경우)도 함께 되돌린다.
    // JS 에서 setValue 하면 아직 네이티브로 옮기기 전의 값이라 한 번 더 그리게 되므로 네이티브 애니메이션으로 한다
    const animation = visible
      ? Animated.parallel([
          Animated.timing(progress, {
            toValue: 1,
            duration: OPEN_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(dragY, {
            toValue: 0,
            duration: OPEN_MS,
            useNativeDriver: true,
          }),
        ])
      : Animated.timing(progress, {
          toValue: 0,
          duration: CLOSE_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        });
    // 내려가는 중에 다시 열면 멈춘 애니메이션은 finished: false 로 끝나 모달을 내리지 않는다
    animation.start(({ finished }) => {
      if (finished) {
        settle();
      }
    });
    return () => animation.stop();
  }, [visible, mounted, progress, dragY, reduceMotion]);

  // 아래로 끄는 세로 움직임만 받는다. 위로 끌기·가로 밀기·탭은 시트 안 버튼과 스크롤 몫이다
  const panResponder = useMemo(() => {
    const springBack = () =>
      Animated.spring(dragY, {
        toValue: 0,
        bounciness: 0,
        useNativeDriver: true,
      }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > DRAG_SLOP && gesture.dy > Math.abs(gesture.dx) * 1.5,
      onPanResponderMove: (_, gesture) =>
        dragY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > CLOSE_DISTANCE || gesture.vy > CLOSE_VELOCITY) {
          callbacks.current.onClose();
        } else {
          springBack();
        }
      },
      onPanResponderTerminate: springBack,
    });
  }, [dragY]);

  const translateY = useMemo(
    () =>
      Animated.add(
        progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }),
        dragY,
      ),
    [progress, dragY, height],
  );

  if (!mounted) {
    return null;
  }
  // 내려가는 동안에는 누르지 못하게 한다 ('닫기' 뒤 '취소', 같은 버튼 두 번 누르기)
  const touchable = visible ? 'auto' : 'none';
  const shape = shapes[variant];

  return (
    <Modal
      transparent
      visible
      animationType="none"
      // Android edge-to-edge: 상태·내비게이션 바 뒤까지 배경을 깔고, 아래 여백은 안전 영역으로 준다
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* 배경은 스크린리더에서 뺀다. 닫기는 시트 안 버튼·두 손가락 Z·뒤로가기로 한다 */}
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents={touchable}
          style={[styles.backdrop, { opacity: progress }]}
        >
          <Pressable
            onPress={onClose}
            style={styles.fill}
            testID={testID && `${testID}-backdrop`}
          />
        </Animated.View>
        {/* escape 핸들러는 Fabric 평탄화 판단에 들어가지 않아 collapsable={false} 로 뷰를 남긴다.
            끌기 응답자는 안쪽 뷰에 둔다 (같은 뷰에 두면 탭을 받지 않는 응답자가 escape 판정을 가린다) */}
        <Animated.View
          accessibilityViewIsModal
          collapsable={false}
          onAccessibilityEscape={onClose}
          pointerEvents={touchable}
          style={[
            readableColumn,
            styles.sheet,
            shape.sheet,
            { transform: [{ translateY }] },
          ]}
          testID={testID}
        >
          <View
            style={[
              shape.content,
              { paddingBottom: shape.bottomPadding(insets.bottom) },
            ]}
            testID={testID && `${testID}-content`}
            {...panResponder.panHandlers}
          >
            {shape.handle && (
              <View
                style={styles.handle}
                testID={testID && `${testID}-handle`}
              />
            )}
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: withOpacity('#000000', 0.4),
  },
  fill: { flex: 1 },
  sheet: { backgroundColor: colors.white[100] },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginBottom: 24,
    borderRadius: 2,
    backgroundColor: colors.gray[300],
  },
});

const shapeStyles = StyleSheet.create({
  confirmSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  confirmContent: { paddingHorizontal: 24, paddingTop: 12 },
  documentSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  documentContent: { paddingHorizontal: 0, paddingTop: 24 },
});

// 아래 여백: confirm 은 안전 영역 위로 16 을 더 띄운다. document 는 Figma 의 36(홈 인디케이터 포함)이고 안전 영역이 더 크면 그만큼 둔다
const shapes = {
  confirm: {
    sheet: shapeStyles.confirmSheet,
    content: shapeStyles.confirmContent,
    handle: true,
    bottomPadding: (inset: number) => inset + 16,
  },
  document: {
    sheet: shapeStyles.documentSheet,
    content: shapeStyles.documentContent,
    handle: false,
    bottomPadding: (inset: number) => Math.max(inset, 36),
  },
} as const;
