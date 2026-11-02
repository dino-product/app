import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  Icon,
  MIN_TOUCH_TARGET,
  Text,
  touchSlop,
} from '../../../shared/design-system';
import { GestureExclusionArea } from '../../../shared/native/GestureExclusionArea';
import {
  formatMonthTitle,
  isSameDay,
  monthGrid,
  toDateKey,
  WEEKDAYS,
} from '../model';
import { dayA11yLabel, dayColor, weekdayHeaderColor } from './calendarDay';
import { useHorizontalSwipe } from './useHorizontalSwipe';

// Figma 내 일정 › 달력 펼침 (Calendar Contents). 선택일은 Primary 둥근 사각형, 일정은 날짜 아래 점 1~3개로 표시한다.
// 왼쪽으로 밀면 다음 달, 오른쪽으로 밀면 이전 달. 이전·다음 달 버튼과 같은 콜백을 부른다.
export function MonthCalendar({
  year,
  month,
  selected,
  eventCounts,
  onSelect,
  onPrev,
  onNext,
  edgeInset = 0,
}: {
  year: number;
  month: number;
  selected: Date;
  /** 날짜(YYYY-MM-DD)별 일정 개수 */
  eventCounts: ReadonlyMap<string, number>;
  onSelect: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
  /** 부모가 화면 가장자리에서 들어간 거리. Android 에서 이만큼 바깥까지 가장자리 밀기를 받는다 */
  edgeInset?: number;
}) {
  const swipeHandlers = useHorizontalSwipe({
    onSwipeLeft: onNext,
    onSwipeRight: onPrev,
  });
  const weeks = useMemo(() => monthGrid(year, month), [year, month]);
  const gridHeight =
    weeks.length * CELL_HEIGHT + (weeks.length - 1) * styles.weeks.gap;

  return (
    <View
      testID="month-calendar"
      hitSlop={ROOT_HIT_SLOP}
      style={styles.container}
      {...swipeHandlers}
    >
      <View style={styles.titleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          hitSlop={PREV_HIT_SLOP}
          onPress={onPrev}
        >
          <Icon
            name="triangle-left"
            size={ARROW_SIZE}
            color={colors.gray[300]}
          />
        </Pressable>
        <Text variant="Body/S/SemiBold" color={colors.gray[800]}>
          {formatMonthTitle(year, month)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          hitSlop={NEXT_HIT_SLOP}
          onPress={onNext}
        >
          <Icon
            name="triangle-right"
            size={ARROW_SIZE}
            color={colors.gray[300]}
          />
        </Pressable>
      </View>

      {/* Figma 는 요일 줄(높이 34, 글자 가운데) 바로 아래에 날짜 칸이 붙는다 */}
      <View>
        {/* 화살표가 아래로 넓힌 영역은 Android 에서 요일 줄 바로 위까지 온다. 간격이 줄어 겹치더라도 뒤 형제인 요일 글자가
            먼저 받지 않도록 터치를 넘겨 둔다 */}
        <View style={[styles.week, styles.weekdays, styles.passTouches]}>
          {WEEKDAYS.map((label, day) => (
            <Text
              key={label}
              variant="Body/XS/Medium"
              color={weekdayHeaderColor(day)}
              style={styles.weekdayText}
            >
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.weeks}>
          {weeks.map((week, row) => (
            <View key={toDateKey(week[0].date)} style={styles.week}>
              {row === 0 && (
                // 시스템은 한쪽 가장자리마다 세로 200dp 까지만 빼 준다. 밀기는 주로 날짜 칸에서 하고 제목 줄에는
                // 이전·다음 달 버튼이 있으니 첫 주부터 뺀다. 칸이 69 라 셋째 주 위쪽까지만 덮고(넷째 주부터는 가장자리 밀기가
                // 뒤로 가기다), 어느 달이든 셋째 주에서 200dp 를 넘어 달을 넘겨도 같은 자리다
                <GestureExclusionArea
                  edgeInset={edgeInset}
                  height={gridHeight}
                />
              )}
              {week.map(({ date, inMonth }) => {
                const active = isSameDay(date, selected);
                const count = eventCounts.get(toDateKey(date)) ?? 0;
                return (
                  <Pressable
                    key={date.getTime()}
                    accessibilityRole="button"
                    accessibilityLabel={dayA11yLabel(date)}
                    accessibilityState={{ selected: active }}
                    // 점은 보이기만 하므로 건수는 값으로 읽어 준다. 레이블은 주간 줄과 같다
                    accessibilityValue={
                      count > 0 ? { text: `일정 ${count}건` } : undefined
                    }
                    hitSlop={DAY_HIT_SLOP}
                    onPress={() => onSelect(date)}
                    style={[styles.cell, active && styles.cellActive]}
                  >
                    <Text
                      variant="Body/XS/Medium"
                      color={
                        active
                          ? colors.white[100]
                          : inMonth
                          ? dayColor(date.getDay(), 'month')
                          : colors.gray[400]
                      }
                    >
                      {date.getDate()}
                    </Text>
                    {count > 0 && (
                      <View style={styles.dots}>
                        {DOT_SLOTS.slice(0, count).map(i => (
                          <View
                            key={i}
                            testID="event-dot"
                            style={[styles.dot, active && styles.dotActive]}
                          />
                        ))}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// Figma Event Count 0~3. 일정이 3건을 넘어도 점은 3개다
const DOT_SLOTS = [0, 1, 2];
const ARROW_SIZE = 24;
const TITLE_GAP = 6;
const CELL_HEIGHT = 69;
// Figma 점 5.18, 간격 1.73 을 반올림했다 (점 묶음 폭 19 는 같다)
const DOT_SIZE = 5;
const DOT_GAP = 2;

// 24 화살표를 최소 터치 영역으로 보완한다. 제목 쪽은 간격(6)까지만 넓히고(제목이 먼저 받는다) 나머지는 바깥쪽으로
const ARROW_SLOP = touchSlop(ARROW_SIZE);
const ARROW_OUTER_SLOP = MIN_TOUCH_TARGET - ARROW_SIZE - TITLE_GAP;
const PREV_HIT_SLOP = {
  top: ARROW_SLOP,
  bottom: ARROW_SLOP,
  left: ARROW_OUTER_SLOP,
  right: TITLE_GAP,
};
const NEXT_HIT_SLOP = {
  top: ARROW_SLOP,
  bottom: ARROW_SLOP,
  left: TITLE_GAP,
  right: ARROW_OUTER_SLOP,
};
// 날짜 칸 높이를 최소 터치 영역으로 보완한다. Figma 칸(69)은 이미 넉넉해 지금은 0 이고, 칸이 작아지면 다시 넓힌다.
// 7칸이 빈틈없이 붙어 있어 좌우로는 넓히지 않는다
const DAY_SLOP = touchSlop(CELL_HEIGHT);
const DAY_HIT_SLOP = { top: DAY_SLOP, bottom: DAY_SLOP };
// 루트가 네이티브 뷰가 되어도 화살표·마지막 주가 루트 밖으로 넓힌 영역에 터치가 닿게 한다 (마지막 주는 지금 0)
const ROOT_HIT_SLOP = { top: PREV_HIT_SLOP.top, bottom: DAY_HIT_SLOP.bottom };

const styles = StyleSheet.create({
  container: { gap: 12 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: TITLE_GAP,
  },
  weeks: { gap: 4 },
  week: { flexDirection: 'row' },
  weekdays: { height: 34, alignItems: 'center' },
  passTouches: { pointerEvents: 'none' },
  weekdayText: { flex: 1, textAlign: 'center' },
  // 주간 줄의 선택 칸처럼 칸 전체가 선택 배경이다
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    alignItems: 'center',
    paddingTop: 12,
    borderRadius: 12,
  },
  cellActive: { backgroundColor: colors.primary },
  dots: {
    position: 'absolute',
    bottom: 15,
    flexDirection: 'row',
    gap: DOT_GAP,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.primary100,
  },
  dotActive: { backgroundColor: colors.white[100] },
});
