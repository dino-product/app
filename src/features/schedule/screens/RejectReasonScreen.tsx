import { useEffect, useEffectEvent, useRef, useState, type Ref } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type KeyboardEvent,
  type LayoutChangeEvent,
  type ScrollEvent,
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
  typography,
} from '../../../shared/design-system';
import { haptic } from '../../../shared/haptics';
import { KeyboardAvoidingArea } from '../../../shared/keyboard/KeyboardAvoidingArea';
import { offsetToRevealAboveKeyboard } from '../../../shared/keyboard/revealAboveKeyboard';
import { offsetAfterShrink } from '../../../shared/layout/offsetAfterShrink';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import {
  REJECTION_NOTE_MAX_LENGTH,
  rejectReasons,
  validateRejection,
  type Rejection,
  type RejectReasonDraft,
  type RejectReasonKey,
} from '../model';

// Figma 스케줄 › 거절 사유: 처음 3239:9164, 선택 2714:12181, 기타 펼침 3227:8674, 입력 중 3239:9238
const OTHER_TEXT_ERROR = '기타 사유를 입력해 주세요.';
// 기타 직접 입력 섹션을 펼치고 접는 시간
const EXPAND_MS = 220;
// 키보드가 올라오면 입력란 아래 끝과 키보드 사이에 이만큼 남긴다.
// 키보드가 뜬 Figma 프레임이 없어 섹션 아래 내용 여백(styles.content 의 paddingBottom)과 같게 둔다
const KEYBOARD_GAP = 24;
// 스크롤 위치는 소수점으로 오므로 이만큼 차이는 같은 위치로 본다
const SCROLL_TOLERANCE = 1;

export function RejectReasonScreen({
  onBack,
  onSubmit,
  titleRef,
  initialDraft,
  onDraftChange,
}: {
  /** 뒤로 가기·취소 */
  onBack: () => void;
  /** 거절을 보낸다. 보내는 동안(약속이 끝날 때까지) 거절 제출을 잠근다. 실패 안내는 부른 쪽이 한다 */
  onSubmit: (rejection: Rejection) => void | Promise<void>;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
  /** 이어 고를 사유 (앱이 종료되기 전에 고르던 초안). 처음 열 때만 쓴다 */
  initialDraft?: RejectReasonDraft;
  /** 고른 사유나 쓴 글이 바뀔 때마다 알린다. 바깥에서 초안으로 남길 때 쓴다 */
  onDraftChange?: (draft: RejectReasonDraft) => void;
}) {
  const [selected, setSelected] = useState<RejectReasonKey | null>(
    initialDraft?.selected ?? null,
  );
  // 다른 선택지로 바꿔 섹션을 접어도 남겨 둔다. 다시 기타를 고르면 그대로 보인다
  const [otherText, setOtherText] = useState(initialDraft?.otherText ?? '');
  const [otherTextError, setOtherTextError] = useState(false);
  // 기타를 고른 초안이면 처음부터 펼쳐 둔다
  const restoredExpanded = initialDraft?.selected === 'other';
  // 접히는 애니메이션이 끝날 때까지 섹션을 남겨 둔다
  const [otherMounted, setOtherMounted] = useState(restoredExpanded);
  // 사용자가 펼칠 때만 입력란이 포커스를 받아 키보드가 올라온다. 이어 고르는 화면은 열자마자 키보드를 올리지 않는다
  const [focusOnOpen, setFocusOnOpen] = useState(!restoredExpanded);
  const reduceMotion = useReduceMotion();
  const reveal = useReveal(restoredExpanded);
  // 보내는 동안 거절 제출을 잠근다. disabled 가 반영되기 전 같은 프레임의 두 번째 탭도 막는다
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollMetrics = useScrollMetrics();
  // 다 접혔지만 스크롤이 줄어들 끝까지 오기를 기다리는 중이다. 오면 섹션을 내린다
  const unmountWhenScrolledIn = useRef(false);
  const otherInputRef = useRef<TextInputInstance>(null);
  const expanded = selected === 'other';

  const notifyDraft = useEffectEvent((draft: RejectReasonDraft) =>
    onDraftChange?.(draft),
  );
  useEffect(() => {
    notifyDraft({ selected, otherText });
  }, [selected, otherText]);

  // 섹션은 스크롤 내용의 맨 끝이라, 내리면 내용이 줄어 끝 근처의 스크롤이 한 번에 당겨진다(뚝 끊김, #152).
  // 접히는 동안 줄어들 끝까지 스크롤로 따라간다. 높이는 네이티브 드라이버로 바꿀 수 없어 스크롤이 내용을 끌어내린다.
  // Android 는 키보드가 내려간 뒤 스크롤 영역이 다시 커지므로 키보드가 없을 때의 높이로 계산한다
  const followCollapse = (instant: boolean) => {
    const { offset, contentHeight, fullHeight } = scrollMetrics.current;
    const to = offsetAfterShrink({
      scrollOffset: offset,
      contentHeight,
      viewportHeight: fullHeight,
      shrinkBy: reveal.sectionHeight(),
    });
    if (to < offset) {
      scrollRef.current?.scrollTo({ y: to, animated: !instant });
    }
  };

  // 다 접힌 섹션을 내려도 스크롤이 당겨지지 않는 위치면 내리고, 아니면 스크롤이 올 때까지 남겨 둔다
  const unmountOtherIfScrolledIn = () => {
    const { offset, contentHeight, height } = scrollMetrics.current;
    const pulledBy =
      offset -
      offsetAfterShrink({
        scrollOffset: offset,
        contentHeight,
        viewportHeight: height,
        shrinkBy: reveal.sectionHeight(),
      });
    unmountWhenScrolledIn.current = pulledBy > SCROLL_TOLERANCE;
    if (!unmountWhenScrolledIn.current) {
      setOtherMounted(false);
    }
  };

  const onScroll = (event: ScrollEvent) => {
    scrollMetrics.onScroll(event);
    if (unmountWhenScrolledIn.current) {
      unmountOtherIfScrolledIn();
    }
  };

  const animateOther = (expand: boolean) => {
    // 동작 줄이기면 바로 끝 값으로 그리고, 끝났다는 알림만 다음 프레임에 받는다
    const instant = reduceMotion.current;
    if (instant) {
      reveal.progress.setValue(expand ? 1 : 0);
    }
    setOtherMounted(true);
    unmountWhenScrolledIn.current = false;
    if (!expand) {
      followCollapse(instant);
    }
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
        unmountOtherIfScrolledIn();
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
    // 고른 사유를 다시 누르면 선택을 푼다 (#101). 기타면 입력란도 접는다
    haptic.selection();
    const next = key === selected ? null : key;
    const expand = next === 'other';
    if (expand !== expanded) {
      if (expand) {
        setFocusOnOpen(true);
        // 접히는 중이면 입력란이 남아 있어 autoFocus 가 다시 돌지 않으므로 직접 포커스한다.
        // 새로 그릴 때는 아직 ref 가 비어 있고 autoFocus 가 맡는다
        otherInputRef.current?.focus();
      } else {
        // 선택지를 눌러도 키보드는 남으므로(keyboardShouldPersistTaps) 접을 때 내린다
        Keyboard.dismiss();
      }
      animateOther(expand);
    }
    setSelected(next);
    setOtherTextError(false);
  };

  const changeOtherText = (text: string) => {
    setOtherText(text);
    setOtherTextError(false);
  };

  // 키보드가 올라오면 입력란 아래 끝까지 키보드 위로 스크롤한다 (#152). 여러 줄 입력칸은 네이티브가 커서 줄만
  // 올려 아래쪽이 가리고, Android ScrollView 는 줄어들 때 이미 보이던 입력칸만 따라간다.
  // 키보드 윗변(화면 기준)과 입력란 포커스가 둘 다 있어야 한다. iOS 의 autoFocus 는 네이티브가 처리해
  // 포커스 이벤트가 keyboardWillShow 보다 늦게 JS 에 올 수 있으므로, 둘 중 나중에 오는 쪽에서 스크롤한다
  const keyboardTop = useRef<number | null>(null);
  const revealOtherInput = () => {
    const top = keyboardTop.current;
    const input = otherInputRef.current;
    const scroll = scrollRef.current;
    const content = scroll?.getInnerViewRef();
    if (top === null || !input?.isFocused() || !scroll || !content) {
      return;
    }
    // 위치는 레이아웃 값으로 잰다(펼치는 중의 transform 은 잘라 내는 View 와 내용이 서로 상쇄한다)
    scroll.measureInWindow((_x, viewportTop, _width, viewportHeight) =>
      input.measureLayout(content, (_left, inputTop, _inputWidth, height) => {
        const { offset } = scrollMetrics.current;
        const to = offsetToRevealAboveKeyboard({
          scrollOffset: offset,
          viewportTop,
          viewportHeight,
          keyboardTop: top,
          targetTop: inputTop,
          targetBottom: inputTop + height,
          gap: KEYBOARD_GAP,
        });
        if (to !== offset) {
          scroll.scrollTo({ y: to, animated: !reduceMotion.current });
        }
      }),
    );
  };
  const onKeyboardShow = useEffectEvent((event: KeyboardEvent) => {
    keyboardTop.current = event.endCoordinates.screenY;
    revealOtherInput();
  });
  // 기타를 펼친 동안만 듣는다. iOS 는 키보드와 함께 움직이게 올라오기 시작할 때, Android 는 다 올라온 뒤에 알린다.
  // 키보드 높이가 바뀌어도(이모지 패널 등) 다시 온다. 접히는 중에 다시 펼치면 키보드가 아직 떠 있을 수 있다
  useEffect(() => {
    if (!expanded) {
      return;
    }
    keyboardTop.current = Keyboard.isVisible()
      ? Keyboard.metrics()?.screenY ?? null
      : null;
    const subscriptions = [
      Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        onKeyboardShow,
      ),
      Keyboard.addListener('keyboardDidHide', () => {
        keyboardTop.current = null;
      }),
    ];
    return () => {
      subscriptions.forEach(subscription => subscription.remove());
      keyboardTop.current = null;
    };
  }, [expanded]);

  const send = async (rejection: Rejection) => {
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSubmit(rejection);
      // 햅틱은 결과다: 서버가 거절을 받았을 때만 울린다 (#32)
      haptic.warning();
    } catch {
      // 실패 안내는 부른 쪽이 한다. 고른 사유를 둔 채 다시 보낼 수 있게 한다
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const submit = () => {
    const result = validateRejection(selected, otherText);
    if (result.ok) {
      send({ key: result.key, note: result.note });
    } else if (result.error === 'otherText') {
      setOtherTextError(true);
      // accessibilityLiveRegion 은 Android 만 읽으므로 iOS 도 알린다
      AccessibilityInfo.announceForAccessibility(OTHER_TEXT_ERROR);
    }
    // 사유를 고르기 전에는 버튼이 비활성이라 'select' 오류로는 오지 않는다
  };

  return (
    <SafeAreaView edges={SCREEN_EDGES} style={styles.screen}>
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
          {...noOverscroll}
          ref={scrollRef}
          testID="reject-reason-scroll"
          // 끌어내리면 키보드가 손가락을 따라 내려간다. Android 는 interactive 가 없어 끌기 시작할 때 내린다
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          keyboardShouldPersistTaps="handled"
          // iOS 는 키보드가 가린 만큼 아래 인셋을 넣어 입력란을 키보드 위까지 스크롤할 수 있게 한다
          automaticallyAdjustKeyboardInsets
          onScroll={onScroll}
          onLayout={scrollMetrics.onLayout}
          onContentSizeChange={scrollMetrics.onContentSizeChange}
          contentContainerStyle={[readableColumn, styles.content]}
        >
          <View style={styles.intro}>
            <Text variant="Body/XL/Bold">작업을 거절할까요?</Text>
            <Text variant="Caption/M/Medium" color={colors.gray[600]}>
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
                    <Text variant="Body/XS/SemiBold" color={colors.gray[800]}>
                      {reason.label}
                      {isOther && (
                        <Text
                          variant="Body/XS/SemiBold"
                          color={colors.gray[500]}
                        >
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
                    autoFocus={focusOnOpen}
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
          variant="outline"
          label="취소"
          onPress={onBack}
          style={styles.action}
        />
        <CTA
          label="거절 제출"
          onPress={submit}
          disabled={selected === null || submitting}
          style={styles.action}
        />
      </View>
    </SafeAreaView>
  );
}

// 기타 직접 입력 섹션. 펼칠 때 새로 마운트되어 입력란이 포커스를 받고(autoFocus) 키보드가 올라온다
function OtherReason({
  inputRef,
  autoFocus,
  value,
  onChangeText,
  onFocus,
  error,
}: {
  inputRef: Ref<TextInputInstance>;
  autoFocus: boolean;
  value: string;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  error: boolean;
}) {
  return (
    <View style={styles.other}>
      <Text variant="Body/XS/Medium">기타 사유를 직접 입력해 주세요</Text>
      {/* Figma 에서 디자인 시스템 TextArea 가 아닌 이 화면의 입력칸이라 값을 그대로 둔다 */}
      <TextInput
        ref={inputRef}
        accessibilityLabel="기타 거절 사유 입력"
        autoFocus={autoFocus}
        multiline
        maxLength={REJECTION_NOTE_MAX_LENGTH}
        placeholder="거절 사유를 입력해 주세요."
        placeholderTextColor={colors.gray[600]}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        style={[styles.input, error && styles.inputError]}
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
// 다만 끝 근처까지 스크롤해 두었으면 내릴 때 스크롤 끝이 당겨지므로 화면이 스크롤로 따라간다 (followCollapse).
// 높이도 Animated.Value 로 두어 재도 다시 그리지 않는다. 펼친 채로 열면 1 에서 시작한다
function useReveal(initiallyExpanded: boolean) {
  const [reveal] = useState(() => {
    const progress = new Animated.Value(initiallyExpanded ? 1 : 0);
    const height = new Animated.Value(0);
    let sectionHeight = 0;
    return {
      progress,
      /** 다 펼쳤을 때 섹션 높이 (위 간격 포함). 내리면 스크롤 내용이 이만큼 준다 */
      sectionHeight: () => sectionHeight,
      onContentLayout: (event: LayoutChangeEvent) => {
        sectionHeight = event.nativeEvent.layout.height;
        height.setValue(sectionHeight);
      },
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

// 스크롤 위치·크기. 네이티브가 이벤트로 알린 값을 ref 에만 두어 다시 그리지 않는다
function useScrollMetrics() {
  const [metrics] = useState(() => {
    const current = { offset: 0, height: 0, fullHeight: 0, contentHeight: 0 };
    return {
      current,
      onScroll: (event: ScrollEvent) => {
        current.offset = event.nativeEvent.contentOffset.y;
      },
      onLayout: (event: LayoutChangeEvent) => {
        current.height = event.nativeEvent.layout.height;
        // Android 는 키보드가 떠 있는 동안 KeyboardAvoidingArea 가 스크롤 영역을 줄인다.
        // 키보드가 없을 때의 높이를 따로 둔다. iOS 는 키보드로 스크롤 영역이 줄지 않는다.
        // 키보드가 뜬 채 처음 재면 아직 모르므로 지금 높이로 둔다
        if (
          Platform.OS === 'ios' ||
          !Keyboard.isVisible() ||
          current.fullHeight === 0
        ) {
          current.fullHeight = current.height;
        }
      },
      onContentSizeChange: (_width: number, height: number) => {
        current.contentHeight = height;
      },
    };
  });
  return metrics;
}

// 아래 버튼 밑 32 는 홈 인디케이터 자리다. 안전 영역이 더 크면 그만큼, 없는 기기도 32 를 둔다 (styles.screen)
const SCREEN_EDGES = { top: 'additive', bottom: 'maximum' } as const;

const styles = StyleSheet.create({
  screen: { flex: 1, paddingBottom: 32, backgroundColor: colors.white[100] },
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 20 },
  // 소개 묶음(위아래 여백 24)과 선택지 사이 24 를 합쳐 48 이다
  content: {
    gap: 48,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  intro: { gap: 12 },
  options: { gap: 8 },
  option: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  optionChecked: {
    borderColor: colors.secondary,
    backgroundColor: colors.select[1],
  },
  otherClip: { overflow: 'hidden' },
  // 선택지와의 간격(24)도 섹션에 넣어, 접히면 간격까지 함께 사라진다
  other: { gap: 12, paddingTop: 24 },
  input: {
    ...typography['Body/XS/Medium'],
    height: 136,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
    color: colors.gray[800],
    textAlignVertical: 'top',
  },
  inputError: { borderColor: colors.warning[1] },
  error: { textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  action: { flex: 1 },
});
