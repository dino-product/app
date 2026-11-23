import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, touchSlop, withOpacity } from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { isBeforeMonth, monthOf, type YearMonth } from '../model';
import {
  BOX_INSET,
  BOX_PADDING,
  clampPickerMonth,
  pickerBoxGeometry,
  pickerKeyframes,
  pickerYears,
  WHEEL_HEIGHT,
} from '../monthPicker';
import { MonthWheel, type MonthWheelHandle } from './MonthWheel';
import { useTapResponder } from './useTapResponder';

// 날짜 선택 상자의 누르는 자리와 휠 (#203, Figma 50867:5275 › wheelPicker 51030:18401).
// 화면이 상단 바 위 층에 겹쳐 그린다. 흰 바탕(MonthPickerBox)은 바 안에 있고, 이 층은 그 위에 휠만 그린다.
// - 상자 바깥: 누르면 고른 달을 적용하며 닫는다. 배경은 어둡게 하지 않는다 (Figma 에 없음)
// - 상자 안: 눌러도 아무 일 없다. 머리 글자 자리는 누르면 닫는다
// - 누르는 자리는 모두 닿자마자 응답자가 되고 놓아 주지 않아, 열린 동안 탭 밀기·월 밀기·목록 스크롤이 터치를 받지 못한다
// - 스크린리더는 연·월 열(조절 요소)만 읽는다. 닫기는 월 글자 버튼·닫기 동작(iOS 두 손가락 문지르기)·Android 뒤로 가기다
export type MonthPickerOverlayProps = {
  /** 열림 진행도 */
  progress: Animated.Value;
  /** 열려 있는지. 닫는 동안은 터치를 받지 않는다 */
  open: boolean;
  today: Date;
  /** 고른 달 */
  month: YearMonth;
  /** 펼친 바 안 월 줄 자리 */
  monthRow: { y: number; height: number };
  onSelect: (month: YearMonth) => void;
  /** 휠이 도는지(손가락·관성). 멈출 때는 멈춘 달을 onSelect 로 먼저 준다 */
  onMovingChange: (moving: boolean) => void;
  onClose: () => void;
};

const formatYear = (year: number) => `${year}년`;
const formatMonth = (month: number) => `${month + 1}월`;
const MONTHS = Array.from({ length: 12 }, (_, index) => index);

export function MonthPickerOverlay({
  progress,
  open,
  today,
  month,
  monthRow,
  onSelect,
  onMovingChange,
  onClose,
}: MonthPickerOverlayProps) {
  const geometry = pickerBoxGeometry(monthRow);
  const years = useMemo(() => pickerYears(today), [today]);
  const yearWheel = useRef<MonthWheelHandle>(null);
  const monthWheel = useRef<MonthWheelHandle>(null);
  // 휠은 열 때 고른 달에서 시작한다 (다시 그려도 처음 자리는 바꾸지 않는다)
  const [initial] = useState(month);

  // 휠이 멈추면 그 달을 고른다. 이번 달 뒤면 이번 달로 되돌아간다 (iOS 날짜 선택의 최대 날짜와 같음).
  // 고른 달은 두 휠이 잇달아 멈춰도 잃지 않게 바로 적어 둔다
  const latest = useRef({ month, years, today });
  useLayoutEffect(() => {
    latest.current = { month, years, today };
  }, [month, years, today]);
  const choose = useCallback(
    (next: YearMonth) => {
      const { years: list, today: now } = latest.current;
      const clamped = clampPickerMonth(next, now);
      if (clamped.year !== next.year) {
        yearWheel.current?.scrollToIndex(list.indexOf(clamped.year));
      }
      if (clamped.month !== next.month) {
        monthWheel.current?.scrollToIndex(clamped.month);
      }
      latest.current.month = clamped;
      onSelect(clamped);
    },
    [onSelect],
  );
  // 손가락으로 굴리기 시작한 휠. 모두 멈추면 알린다 (닫는 중이면 상자가 멈춘 달을 적용한다)
  const moving = useRef(new Set<'year' | 'month'>());
  const startMoving = useCallback(
    (column: 'year' | 'month') => {
      if (moving.current.size === 0) {
        onMovingChange(true);
      }
      moving.current.add(column);
    },
    [onMovingChange],
  );
  const stopMoving = useCallback(
    (column: 'year' | 'month') => {
      if (moving.current.delete(column) && moving.current.size === 0) {
        onMovingChange(false);
      }
    },
    [onMovingChange],
  );
  const onYearMoveStart = useCallback(() => startMoving('year'), [startMoving]);
  const onMonthMoveStart = useCallback(
    () => startMoving('month'),
    [startMoving],
  );
  const onYearSettle = useCallback(
    (index: number) => {
      choose({
        year: latest.current.years[index],
        month: latest.current.month.month,
      });
      stopMoving('year');
    },
    [choose, stopMoving],
  );
  const onMonthSettle = useCallback(
    (index: number) => {
      choose({ year: latest.current.month.year, month: index });
      stopMoving('month');
    },
    [choose, stopMoving],
  );
  // 스크린리더 조절: 한 줄씩, 끝에서 이어지지 않는다. 월은 이번 달 뒤로 가지 않고, 연도를 올해로 올리면 월이 이번 달로 맞춰진다
  const onYearAdjust = useCallback(
    (delta: 1 | -1) => {
      const { month: current, years: list } = latest.current;
      const index = list.indexOf(current.year) + delta;
      if (index < 0 || index >= list.length) {
        return;
      }
      yearWheel.current?.scrollToIndex(index);
      choose({ year: list[index], month: current.month });
    },
    [choose],
  );
  const onMonthAdjust = useCallback(
    (delta: 1 | -1) => {
      const { month: current, today: now } = latest.current;
      const next = { year: current.year, month: current.month + delta };
      if (
        next.month < 0 ||
        next.month > 11 ||
        isBeforeMonth(monthOf(now), next)
      ) {
        return;
      }
      monthWheel.current?.scrollToIndex(next.month);
      choose(next);
    },
    [choose],
  );

  const backdrop = useTapResponder({ onTap: onClose });
  const panel = useTapResponder({ onTap: () => {} });
  const head = useTapResponder({ onTap: onClose });

  const slotStyle = useMemo(
    () => [styles.slot, { top: geometry.top, height: geometry.height }],
    [geometry.top, geometry.height],
  );
  const headStyle = useMemo(
    () => [styles.head, { height: monthRow.height }],
    [monthRow.height],
  );
  const headSlop = touchSlop(monthRow.height);
  const wheelStyle = useMemo(
    () => [
      styles.wheel,
      {
        top: geometry.wheelTop,
        opacity: progress.interpolate(pickerKeyframes.contentOpacity),
      },
    ],
    [geometry.wheelTop, progress],
  );

  return (
    <View
      testID="work-history-month-picker"
      style={[styles.overlay, !open && styles.inert]}
      onAccessibilityEscape={onClose}
    >
      <View
        testID="work-history-month-picker-backdrop"
        style={styles.backdrop}
        {...backdrop}
      />
      <View style={slotStyle}>
        <View style={[readableColumn, styles.column]}>
          <View
            testID="work-history-month-picker-panel"
            style={styles.panel}
            {...panel}
          >
            <View
              testID="work-history-month-picker-head"
              style={headStyle}
              hitSlop={{ top: headSlop, bottom: headSlop }}
              {...head}
            />
            <Animated.View
              testID="work-history-month-picker-wheel"
              style={wheelStyle}
            >
              <View
                testID="work-history-month-picker-band"
                style={styles.band}
              />
              <MonthWheel
                ref={yearWheel}
                column="year"
                values={years}
                initialIndex={Math.max(0, years.indexOf(initial.year))}
                selectedIndex={Math.max(0, years.indexOf(month.year))}
                accessibilityLabel="연도"
                format={formatYear}
                onMoveStart={onYearMoveStart}
                onSettle={onYearSettle}
                onAdjust={onYearAdjust}
              />
              <MonthWheel
                ref={monthWheel}
                column="month"
                values={MONTHS}
                initialIndex={initial.month}
                selectedIndex={month.month}
                accessibilityLabel="월"
                format={formatMonth}
                onMoveStart={onMonthMoveStart}
                onSettle={onMonthSettle}
                onAdjust={onMonthAdjust}
              />
              <View
                testID="work-history-month-picker-fade-top"
                style={styles.fadeTop}
              />
              <View
                testID="work-history-month-picker-fade-bottom"
                style={styles.fadeBottom}
              />
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}

const HEAD_INSET = 29.5;
const WHITE = withOpacity(colors.white[100], 1);
const WHITE_42 = withOpacity(colors.white[100], 0.42);

const styles = StyleSheet.create({
  // 상단 바(zIndex 1) 위
  overlay: { ...StyleSheet.absoluteFill, zIndex: 2 },
  inert: { pointerEvents: 'none' },
  backdrop: StyleSheet.absoluteFill,
  slot: { position: 'absolute', left: 0, right: 0, pointerEvents: 'box-none' },
  column: { flex: 1, paddingHorizontal: BOX_INSET, pointerEvents: 'box-none' },
  panel: { flex: 1 },
  // 머리 줄 (Figma 50867:5276, 상자 안 위 24 · 286 폭 가운데 = 좌우 29.5). 글자는 상단 바의 월 글자다
  head: {
    position: 'absolute',
    top: BOX_PADDING,
    left: HEAD_INSET,
    right: HEAD_INSET,
  },
  // Figma 51030:18401: 상자 안 좌우 24, 높이 174. 3 줄 밖은 잘린다
  wheel: {
    position: 'absolute',
    left: BOX_PADDING,
    right: BOX_PADDING,
    height: WHEEL_HEIGHT,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  // Figma selected 51030:18402: 위 70.85 · 높이 32.31 · 반경 7.60 · 검정 4% (변수 없음, 값은 Background/4 와 같다)
  band: {
    position: 'absolute',
    top: 70.85,
    height: 32.31,
    left: 0.07,
    right: 0.86,
    borderRadius: 7.6,
    backgroundColor: colors.background[4],
  },
  // Figma 51030:17834 · 51030:17835: 가운데(-0.5) 좁은 띠에 흰색 → 42% 흰색 흐림 (아래는 뒤집힘)
  fadeTop: {
    position: 'absolute',
    top: 6,
    height: 13,
    width: 98,
    left: '50%',
    marginLeft: -49.5,
    backgroundImage: `linear-gradient(to bottom, ${WHITE}, ${WHITE_42})`,
    pointerEvents: 'none',
  },
  fadeBottom: {
    position: 'absolute',
    top: 152,
    height: 14,
    width: 108,
    left: '50%',
    marginLeft: -54.5,
    backgroundImage: `linear-gradient(to bottom, ${WHITE_42}, ${WHITE})`,
    pointerEvents: 'none',
  },
});
