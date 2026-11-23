import {
  memo,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useReduceMotion } from '../../../shared/accessibility/useReduceMotion';
import { colors, fonts, Text } from '../../../shared/design-system';
import { measureElement } from '../../../shared/gesture/TabSwipeArea';
import {
  WHEEL_FONT_SIZE,
  WHEEL_HEIGHT,
  WHEEL_PADDING,
  WHEEL_ROW,
  WHEEL_ROW_TEXT_HEIGHT,
  WHEEL_ROW_TOP,
  wheelIndexAt,
  wheelRowKeyframes,
  wheelRowAt,
  yearRowKeyframes,
} from '../monthPicker';
import { useTapResponder } from './useTapResponder';

// 날짜 선택 휠 한 열 (#203, Figma .atm_wheelPicker 51030:18404 연도 · 51030:18405 월).
// 투명한 네이티브 스크롤 뷰가 손가락·관성·한 줄(32) 붙기를 맡고, 줄 글자는 그 아래에 겹쳐 그린다.
// 줄마다 스크롤 위치를 UI 스레드에서 보간해 가운데에서 멀수록 작아지고·흐려지고·기울게 한다 (Animated.event 네이티브 드라이버).
// 그래서 굴리는 동안 React 는 다시 그리지 않고, 멈췄을 때만 onSettle 로 알린다. iOS·Android 같은 모양이다 (플랫폼 피커를 쓰지 않는다)
export type MonthWheelHandle = {
  /** index 줄로 굴린다. 멈출 때를 기다리지 않고 바로 그 줄을 고른 것으로 본다 */
  scrollToIndex: (index: number) => void;
};

export type MonthWheelProps = {
  column: 'year' | 'month';
  values: readonly number[];
  /** 처음 가운데에 둘 줄 */
  initialIndex: number;
  /** 지금 고른 줄 (스크린리더가 읽는 값) */
  selectedIndex: number;
  /** 스크린리더 이름 ('연도' · '월') */
  accessibilityLabel: string;
  /** 줄 글자 ('2026년' · '9월') */
  format: (value: number) => string;
  /** 손가락으로 굴리기 시작했다 */
  onMoveStart: () => void;
  /** 휠이 멈춰 index 줄이 가운데에 왔다 */
  onSettle: (index: number) => void;
  /** 스크린리더 조절 동작 (+1 다음 값, -1 이전 값) */
  onAdjust: (delta: 1 | -1) => void;
  ref?: Ref<MonthWheelHandle>;
};

export const MonthWheel = memo(function MonthWheelView({
  column,
  values,
  initialIndex,
  selectedIndex,
  accessibilityLabel,
  format,
  onMoveStart,
  onSettle,
  onAdjust,
  ref,
}: MonthWheelProps) {
  const reduceMotion = useReduceMotion();
  const scrollRef = useRef<ScrollViewInstance>(null);
  // 스크롤 위치 (네이티브 값). 처음 자리에서 시작한다
  const [scrollY] = useState(
    () =>
      new Animated.Value(initialIndex * WHEEL_ROW, { useNativeDriver: true }),
  );
  const [initialOffset] = useState(() => ({
    x: 0,
    y: initialIndex * WHEEL_ROW,
  }));
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  );

  // 핸들러는 늘 최신 값을 읽는다 (휠은 굴리는 동안 다시 그리지 않는다)
  const latest = useRef({ values, onSettle, selectedIndex });
  useLayoutEffect(() => {
    latest.current = { values, onSettle, selectedIndex };
  });

  const scrollToIndex = (index: number) => {
    scrollRef.current?.scrollTo({
      x: 0,
      y: index * WHEEL_ROW,
      animated: !reduceMotion.current,
    });
  };
  useImperativeHandle(ref, () => ({ scrollToIndex }));

  const report = (offset: number) => {
    latest.current.onSettle(wheelIndexAt(offset, latest.current.values.length));
  };
  const onScrollEndDrag = ({
    nativeEvent,
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    // 줄 위에서 멈춘 채 손을 떼면 관성 없이 그 줄에서 멈춘다 (iOS). 튕기며 떼면(속도가 있으면) 그 줄은 지나가는 줄이고,
    // 줄 사이면 붙을 줄까지 간다. 둘 다 관성이 끝날 때 onMomentumScrollEnd 가 온다
    const offset = nativeEvent.contentOffset.y;
    const still = (nativeEvent.velocity?.y ?? 0) === 0;
    if (
      still &&
      Math.abs(offset - Math.round(offset / WHEEL_ROW) * WHEEL_ROW) < 0.5
    ) {
      report(offset);
    }
  };
  const onMomentumScrollEnd = ({
    nativeEvent,
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    report(nativeEvent.contentOffset.y);
  };

  // 줄을 누르면 그 줄로 굴러간다 (시안). 누른 자리에서 가장 가까운 줄을 Figma 줄 자리로 찾는다
  const tap = useTapResponder({
    onTap: (point: { y: number } | null) => {
      if (point === null) {
        return;
      }
      const { values: current, selectedIndex: selected } = latest.current;
      const index = Math.max(
        0,
        Math.min(current.length - 1, selected + wheelRowAt(point.y)),
      );
      if (index !== selected) {
        scrollToIndex(index);
        latest.current.onSettle(index);
      }
    },
    locate: (event: GestureResponderEvent) => {
      const rect = measureElement(event.currentTarget);
      return rect === null ? null : { y: event.nativeEvent.pageY - rect.y };
    },
  });

  const contentStyle = useMemo(
    () => ({ height: values.length * WHEEL_ROW + WHEEL_PADDING * 2 }),
    [values.length],
  );

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: format(values[selectedIndex]) }}
      accessibilityActions={ADJUST_ACTIONS}
      onAccessibilityAction={(event: AccessibilityActionEvent) => {
        if (event.nativeEvent.actionName === 'increment') {
          onAdjust(1);
        } else if (event.nativeEvent.actionName === 'decrement') {
          onAdjust(-1);
        }
      }}
      style={styles.column}
      {...tap}
    >
      <View style={styles.rows}>
        {values.map((value, index) => (
          <WheelRow
            key={value}
            column={column}
            index={index}
            label={format(value)}
            plain={String(value)}
            scrollY={scrollY}
          />
        ))}
      </View>
      <Animated.ScrollView
        ref={scrollRef}
        testID={`month-picker-${column}-wheel`}
        style={StyleSheet.absoluteFill}
        contentOffset={initialOffset}
        snapToInterval={WHEEL_ROW}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => onMoveStart()}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <View style={contentStyle} />
      </Animated.ScrollView>
    </View>
  );
});

const ADJUST_ACTIONS = [
  { name: 'increment' as const },
  { name: 'decrement' as const },
];

// 한 줄. 연도는 가운데 줄에서만 '년' 을 붙인다: 같은 자리에 '2023년' 과 '2023' 을 겹쳐 두고 반 줄 경계에서 바꿔 보인다
const WheelRow = memo(function WheelRowView({
  column,
  index,
  label,
  plain,
  scrollY,
}: {
  column: 'year' | 'month';
  index: number;
  label: string;
  plain: string;
  scrollY: Animated.Value;
}) {
  const animated = useMemo(() => {
    const frames = wheelRowKeyframes(index, column);
    const transform = [
      { translateY: scrollY.interpolate({ ...frames.translateY, ...CLAMP }) },
      { scale: scrollY.interpolate({ ...frames.scale, ...CLAMP }) },
      { skewX: scrollY.interpolate({ ...frames.skewX, ...CLAMP }) },
    ];
    if (column === 'month') {
      return {
        row: [
          styles.row,
          styles.monthRow,
          {
            opacity: scrollY.interpolate({ ...frames.opacity, ...CLAMP }),
            transform,
          },
        ],
        withSuffix: null,
        plain: null,
      };
    }
    const year = yearRowKeyframes(index);
    return {
      row: [styles.row, styles.yearRow, { transform }],
      withSuffix: [
        styles.yearText,
        { opacity: scrollY.interpolate({ ...year.withSuffix, ...CLAMP }) },
      ],
      plain: [
        styles.yearText,
        { opacity: scrollY.interpolate({ ...year.plain, ...CLAMP }) },
      ],
    };
  }, [column, index, scrollY]);

  if (animated.withSuffix === null) {
    return (
      <Animated.View style={animated.row}>
        <Text style={[styles.text, styles.monthText]} allowFontScaling={false}>
          {label}
        </Text>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={animated.row}>
      <>
        <Animated.View style={animated.withSuffix}>
          <Text style={styles.text} allowFontScaling={false}>
            {label}
          </Text>
        </Animated.View>
        <Animated.View style={animated.plain}>
          <Text style={styles.text} allowFontScaling={false}>
            {plain}
          </Text>
        </Animated.View>
      </>
    </Animated.View>
  );
});

const CLAMP = { extrapolate: 'clamp' } as const;

// 연도 글자 오른쪽 끝은 휠 가운데(148.5) + 4.86 (Figma 휠 x 153.36), 월 글자 왼쪽 끝은 휠 가운데 + 14.33 (휠 x 162.83).
// 두 열은 휠을 반씩 나눠 갖는다
const ROW_TOP = WHEEL_ROW_TOP;
const ROW_HEIGHT = WHEEL_ROW_TEXT_HEIGHT;
const YEAR_TEXT_PAST_CENTER = 4.86;
const MONTH_TEXT_PAST_CENTER = 14.33;

const styles = StyleSheet.create({
  column: { flex: 1, height: WHEEL_HEIGHT },
  rows: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  row: { position: 'absolute', top: ROW_TOP, height: ROW_HEIGHT },
  // 오른쪽 맞춤 · 오른쪽 가운데를 축으로 줄고 기운다
  yearRow: {
    left: 0,
    right: -YEAR_TEXT_PAST_CENTER,
    transformOrigin: 'right',
  },
  yearText: { position: 'absolute', top: 0, right: 0 },
  // 왼쪽 맞춤 · 왼쪽 가운데를 축으로 줄고 기운다.
  // Figma 는 ±2·±3 월 줄만 가운데 맞춤·자간 0 이다 ('6월'·'10월' 이 가운데를 맞춤). 한 줄은 굴리는 동안 이 자리들을 지나므로
  // 맞춤을 바꾸면 두 자리 달이 옆으로 미끄러지고, 자간은 UI 스레드에서 보간할 수 없어 모든 줄을 왼쪽 맞춤·자간 -0.95 하나로 둔다
  // (왼쪽 끝 차이: 6월 0.7 · 5월 1.7 · 10월 4.3)
  monthRow: { left: MONTH_TEXT_PAST_CENTER, right: 0, transformOrigin: 'left' },
  // Figma SF Pro Text Regular 22.17 #000. iOS 는 시스템 글꼴(SF Pro), Android 는 SF Pro 를 넣을 수 없어(라이선스) Pretendard Regular.
  // 휠은 줄 높이 32 고정이라 iOS 기본 휠처럼 글자 크기 설정을 따르지 않는다
  text: {
    fontFamily: Platform.select({ ios: 'System', default: fonts.regular }),
    fontWeight: Platform.select({ ios: '400', default: undefined }),
    fontSize: WHEEL_FONT_SIZE,
    lineHeight: ROW_HEIGHT,
    letterSpacing: 0,
    color: colors.black,
  },
  // Figma 월 줄 자간 -0.95
  monthText: { letterSpacing: -0.95 },
});
