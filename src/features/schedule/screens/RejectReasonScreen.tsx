import { useEffect, useRef, useState, type Ref } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
  type TextInputInstance,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReduceMotion } from '../../../shared/accessibility/useReduceMotion';
import {
  colors,
  CTA,
  Icon,
  ICON_HIT_SLOP,
  Text,
  TextArea,
} from '../../../shared/design-system';
import { KeyboardAvoidingArea } from '../../../shared/keyboard/KeyboardAvoidingArea';
import { readableColumn } from '../../../shared/layout/readableColumn';
import {
  rejectReasons,
  validateRejection,
  type RejectReasonKey,
} from '../model';

// Figma 스케줄 › 거절 사유
const OTHER_TEXT_ERROR = '기타 사유를 입력해 주세요.';
// 기타 직접 입력 섹션을 펼치고 접는 시간
const EXPAND_MS = 220;

export function RejectReasonScreen({
  onBack,
  onSubmit,
  titleRef,
}: {
  /** 뒤로 가기·취소 */
  onBack: () => void;
  onSubmit: (reason: string) => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const [selected, setSelected] = useState<RejectReasonKey | null>(null);
  // 다른 선택지로 바꿔 섹션을 접어도 남겨 둔다. 다시 기타를 고르면 그대로 보인다
  const [otherText, setOtherText] = useState('');
  const [otherTextError, setOtherTextError] = useState(false);
  // 접히는 애니메이션이 끝날 때까지 섹션을 남겨 둔다
  const [otherMounted, setOtherMounted] = useState(false);
  const reduceMotion = useReduceMotion();
  const reveal = useReveal();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const otherInputRef = useRef<TextInputInstance>(null);
  const expanded = selected === 'other';

  const animateOther = (expand: boolean) => {
    // 동작 줄이기면 바로 끝 값으로 그리고, 끝났다는 알림만 다음 프레임에 받는다
    const instant = reduceMotion.current;
    if (instant) {
      reveal.progress.setValue(expand ? 1 : 0);
    }
    setOtherMounted(true);
    Animated.timing(reveal.progress, {
      toValue: expand ? 1 : 0,
      duration: instant ? 0 : EXPAND_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // 도중에 다시 누르면 새 애니메이션이 지금 값에서 이어 가고, 이 애니메이션은 finished: false 로 끝난다
      if (!finished) {
        return;
      }
      if (!expand) {
        setOtherMounted(false);
        return;
      }
      // 펼치는 중에는 입력란이 투명하고 잘려 있어 스크린리더가 건너뛸 수 있으므로 다 펼친 뒤에 옮긴다
      if (otherInputRef.current) {
        AccessibilityInfo.sendAccessibilityEvent(
          otherInputRef.current,
          'focus',
        );
      }
    });
  };

  const select = (key: RejectReasonKey) => {
    const expand = key === 'other';
    if (expand !== expanded) {
      if (expand) {
        // 접히는 중이면 입력란이 남아 있어 autoFocus 가 다시 돌지 않으므로 직접 포커스한다.
        // 새로 그릴 때는 아직 ref 가 비어 있고 autoFocus 가 맡는다
        otherInputRef.current?.focus();
      } else {
        // 선택지를 눌러도 키보드는 남으므로(keyboardShouldPersistTaps) 접을 때 내린다
        Keyboard.dismiss();
      }
      animateOther(expand);
    }
    setSelected(key);
    setOtherTextError(false);
  };

  const changeOtherText = (text: string) => {
    setOtherText(text);
    setOtherTextError(false);
  };

  // Android ScrollView 는 줄어들 때 보이던 입력칸만 따라가고, 펼치며 바로 포커스를 받은 입력란은
  // 아직 레이아웃 전이라 스크롤하지 않는다. 처음부터 화면 아래에 있으면 키보드 뒤에 남으므로 섹션이 있는 끝까지 내린다.
  // iOS 는 automaticallyAdjustKeyboardInsets 가 포커스된 입력칸을 키보드 위로 올린다
  const revealOtherInput =
    Platform.OS === 'android'
      ? () => scrollRef.current?.scrollToEnd()
      : undefined;

  const submit = () => {
    const result = validateRejection(selected, otherText);
    if (result.ok) {
      onSubmit(result.reason);
    } else if (result.error === 'otherText') {
      setOtherTextError(true);
      // accessibilityLiveRegion 은 Android 만 읽으므로 iOS 도 알린다
      AccessibilityInfo.announceForAccessibility(OTHER_TEXT_ERROR);
    }
    // 사유를 고르기 전에는 버튼이 비활성이라 'select' 오류로는 오지 않는다
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={[readableColumn, styles.header]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={ICON_HIT_SLOP}
          onPress={onBack}
          style={styles.back}
        >
          <Icon name="chevron-left" />
        </Pressable>
        <Text
          ref={titleRef}
          accessibilityRole="header"
          variant="Body/M/SemiBold"
          color={colors.mainText}
        >
          거절 사유
        </Text>
      </View>

      {/* Android 는 edge-to-edge 라 키보드가 떠도 창이 줄지 않아, 가린 만큼 스크롤 영역을 줄인다.
          아래 버튼 줄은 iOS 처럼 키보드 뒤에 남는다 */}
      <KeyboardAvoidingArea testID="reject-reason-body">
        <ScrollView
          ref={scrollRef}
          testID="reject-reason-scroll"
          // 끌어내리면 키보드가 손가락을 따라 내려간다. Android 는 interactive 가 없어 끌기 시작할 때 내린다
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[readableColumn, styles.content]}
        >
          <View style={styles.intro}>
            <Text variant="Body/XL/Bold">작업을 거절할까요?</Text>
            <Text variant="Caption/M/Regular" color={colors.gray[600]}>
              거절 사유를 선택해 주세요. 사유는 등록 담당자에게 전달됩니다.
            </Text>
          </View>

          <View>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {rejectReasons.map(reason => {
                const checked = selected === reason.key;
                const isOther = reason.key === 'other';
                return (
                  <Pressable
                    key={reason.key}
                    accessibilityRole="radio"
                    accessibilityLabel={
                      isOther ? '기타 (직접 입력)' : reason.label
                    }
                    // 기타는 고르면 직접 입력 섹션을 펼친다
                    accessibilityState={
                      isOther ? { checked, expanded: checked } : { checked }
                    }
                    onPress={() => select(reason.key)}
                    style={[styles.option, checked && styles.optionChecked]}
                  >
                    <Text variant="Body/XS/Medium">
                      {reason.label}
                      {isOther && (
                        <Text variant="Body/XS/Medium" color={colors.gray[500]}>
                          {' (직접 입력)'}
                        </Text>
                      )}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {otherMounted && (
              // 위로 옮긴 잘라 내는 영역이 선택지를 덮어도 터치는 선택지로 가게 한다
              <Animated.View
                testID="reject-other-clip"
                pointerEvents="box-none"
                style={[styles.otherClip, reveal.clipStyle]}
              >
                {/* 접히는 동안에는 스크린리더에서 빼고 터치도 받지 않는다 */}
                <Animated.View
                  testID="reject-other-content"
                  onLayout={reveal.onContentLayout}
                  accessibilityElementsHidden={!expanded}
                  importantForAccessibility={
                    expanded ? 'auto' : 'no-hide-descendants'
                  }
                  pointerEvents={expanded ? 'auto' : 'none'}
                  style={reveal.contentStyle}
                >
                  <OtherReason
                    inputRef={otherInputRef}
                    value={otherText}
                    onChangeText={changeOtherText}
                    onFocus={revealOtherInput}
                    error={otherTextError}
                  />
                </Animated.View>
              </Animated.View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingArea>

      <View style={[readableColumn, styles.actions]}>
        <CTA
          size="M"
          variant="outline"
          label="취소"
          onPress={onBack}
          style={styles.action}
        />
        <CTA
          size="M"
          label="거절 제출"
          onPress={submit}
          disabled={selected === null}
          style={styles.action}
        />
      </View>
    </SafeAreaView>
  );
}

// 기타 직접 입력 섹션. 펼칠 때 새로 마운트되어 입력란이 포커스를 받고 키보드가 올라온다
function OtherReason({
  inputRef,
  value,
  onChangeText,
  onFocus,
  error,
}: {
  inputRef: Ref<TextInputInstance>;
  value: string;
  onChangeText: (text: string) => void;
  onFocus?: () => void;
  error: boolean;
}) {
  return (
    <View style={styles.other}>
      <Text variant="Body/XS/SemiBold">기타 사유를 직접 입력해 주세요</Text>
      <TextArea
        ref={inputRef}
        label="기타 거절 사유 입력"
        placeholder="거절 사유를 입력해 주세요."
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        error={error}
        autoFocus
      />
      {error && (
        <Text
          accessibilityLiveRegion="polite"
          variant="Caption/M/Medium"
          color={colors.warning[1]}
          style={styles.error}
        >
          {OTHER_TEXT_ERROR}
        </Text>
      )}
    </View>
  );
}

// 섹션을 위에서부터 드러낸다 (progress 0 → 1). 네이티브 드라이버는 높이를 바꾸지 못하므로
// 잘라 내는 View 는 내용 높이만큼 위로, 내용은 같은 만큼 아래로 옮겨 내용은 제자리에 두고 보이는 영역만 자라게 한다.
// 섹션이 스크롤 내용의 맨 끝이라 레이아웃 높이는 한 번에 바뀌어도 밀려나는 내용이 없다.
// 높이도 Animated.Value 로 두어 재도 다시 그리지 않는다
function useReveal() {
  const [reveal] = useState(() => {
    const progress = new Animated.Value(0);
    const height = new Animated.Value(0);
    return {
      progress,
      onContentLayout: (event: LayoutChangeEvent) =>
        height.setValue(event.nativeEvent.layout.height),
      clipStyle: {
        transform: [
          { translateY: Animated.multiply(Animated.add(progress, -1), height) },
        ],
      },
      contentStyle: {
        opacity: progress,
        transform: [
          {
            translateY: Animated.multiply(
              Animated.subtract(1, progress),
              height,
            ),
          },
        ],
      },
    };
  });
  // 화면을 닫으면 도는 애니메이션을 멈춘다 (완료 콜백은 finished: false 라 아무것도 하지 않는다)
  useEffect(() => () => reveal.progress.stopAnimation(), [reveal]);
  return reveal;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 20 },
  content: {
    gap: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  intro: { gap: 8 },
  options: { gap: 10 },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  optionChecked: {
    borderColor: colors.secondary,
    backgroundColor: colors.select[1],
  },
  otherClip: { overflow: 'hidden' },
  // 선택지와의 간격(28)도 섹션에 넣어, 접히면 간격까지 함께 사라진다
  other: { gap: 12, paddingTop: 28 },
  error: { textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  action: { flex: 1 },
});
