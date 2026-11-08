import { memo, useMemo } from 'react';
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
  addMonths,
  formatMonthTitle,
  isSameDay,
  monthGrid,
  toDateKey,
  WEEKDAYS,
  type MonthCell,
} from '../model';
import { dayA11yLabel, dayColor, weekdayHeaderColor } from './calendarDay';
import { PAGE_OFFSETS, SwipeTrack, type PageOffset } from './SwipeTrack';
import { useHorizontalSwipe } from './useHorizontalSwipe';
import type { AreaTouchHandlers } from './useTouchScrollLock';

// Figma 내 일정 › 달력 펼침 (3754:6618, Calendar Contents). 회색 바탕 위 흰 카드다. 선택일은 Primary 둥근 사각형,
// 일정이 있는 이번 달 날짜는 아래에 점 하나(DesignSystem Event Indicator 는 0/1 뿐)를 찍는다.
// 왼쪽으로 밀면 다음 달, 오른쪽으로 밀면 이전 달. 끄는 동안 날짜 격자만 손가락을 따라 움직여 옆 달이 드러나고,
// 이전·다음 달 버튼은 격자를 옆 달로 미끄러뜨린다. 둘 다 다 넘어간 뒤에 같은 콜백을 부르고 그때 제목이 바뀐다.
export function MonthCalendar({
  year,
  month,
  selected,
  eventCounts,
  onSelect,
  onPrev,
  onNext,
  edgeInset = 0,
  touchHandlers,
}: {
  year: number;
  month: number;
  selected: Date;
  /** 날짜(YYYY-MM-DD)별 일정 개수 */
  eventCounts: ReadonlyMap<string, number>;
  onSelect: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
  /**
   * 부모가 화면 가장자리에서 들어간 거리. Android 에서 이만큼 바깥까지 가장자리 밀기를 받는다.
   * 넘길 때 옆 달은 흰 카드 안에서만 보인다
   */
  edgeInset?: number;
  /** 루트에 다는 터치 핸들러. 리스트 머리에 두면 가로로 미는 동안 리스트 스크롤을 막는 데 쓴다 */
  touchHandlers?: AreaTouchHandlers;
}) {
  const swipe = useHorizontalSwipe({ onPrev, onNext });
  // 앞뒤 달 격자도 미리 만들어 둔다 (이전·지금·다음)
  const grids = useMemo(
    () =>
      PAGE_OFFSETS.map(offset => {
        const page = addMonths(year, month, offset);
        return monthGrid(page.year, page.month);
      }),
    [year, month],
  );
  const weeks = grids[1];
  const gridHeight =
    weeks.length * CELL_HEIGHT + (weeks.length - 1) * styles.weeks.gap;
  const selectedKey = toDateKey(selected);
  const renderGrid = (offset: PageOffset) => {
    const pageWeeks = grids[offset + 1];
    return (
      <MonthGrid
        weeks={pageWeeks}
        // 고른 날이 없는 격자는 날짜를 골라도 다시 그리지 않게 null 을 준다
        selected={inGrid(pageWeeks, selectedKey) ? selected : null}
        eventCounts={eventCounts}
        onSelect={onSelect}
      />
    );
  };

  return (
    <View
      testID="month-calendar"
      style={styles.container}
      {...touchHandlers}
      {...swipe.panHandlers}
    >
      <View style={styles.titleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          hitSlop={PREV_HIT_SLOP}
          onPress={() => swipe.slide(-1)}
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
          onPress={() => swipe.slide(1)}
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
              variant="Caption/M/Medium"
              color={weekdayHeaderColor(day)}
              style={styles.weekdayText}
            >
              {label}
            </Text>
          ))}
        </View>

        {/* 넘기는 동안 움직이지 않는 날짜 격자 자리 */}
        <View>
          {/* 시스템은 한쪽 가장자리마다 세로 200dp 까지만 빼 준다. 밀기는 주로 날짜 칸에서 하고 제목 줄에는
              이전·다음 달 버튼이 있으니 첫 주부터 뺀다. 칸이 69 라 셋째 주 위쪽까지만 덮고(넷째 주부터는 가장자리 밀기가
              뒤로 가기다), 어느 달이든 셋째 주에서 200dp 를 넘어 달을 넘겨도 같은 자리다.
              트랙 밖에 둬 끄는 동안 따라 움직이지 않고, 뒤 형제인 넘김 창(날짜 칸)이 먼저 터치를 받는다 */}
          <GestureExclusionArea edgeInset={edgeInset} height={gridHeight} />
          {/* 흰 카드 폭에서 잘라 옆 달이 카드 밖 회색 여백으로 나와 보이지 않게 한다 */}
          <SwipeTrack
            swipe={swipe}
            inset={0}
            testID="month-calendar-track"
            renderPage={renderGrid}
          />
        </View>
      </View>
    </View>
  );
}

/** 그 날(YYYY-MM-DD)이 격자에 있는지. 앞뒤 달 날짜도 격자에 든다 */
function inGrid(weeks: MonthCell[][], dateKey: string) {
  const first = toDateKey(weeks[0][0].date);
  const last = toDateKey(weeks[weeks.length - 1][6].date);
  return first <= dateKey && dateKey <= last;
}

// 한 달 치 날짜 칸. 넘김 트랙의 페이지마다 그린다.
// 주·칸은 자리(몇째 주, 무슨 요일)를 key 로 둔다. 달을 넘기면 세 격자가 모두 바뀌는데, 날짜를 key 로 두면
// 칸을 거의 다 지우고 새로 만든다 (네이티브 뷰 생성). 자리를 key 로 두면 내용만 바꾼다
const MonthGrid = memo(function MonthGridView({
  weeks,
  selected,
  eventCounts,
  onSelect,
}: {
  weeks: MonthCell[][];
  /** 이 격자에 고른 날이 없으면 null */
  selected: Date | null;
  eventCounts: ReadonlyMap<string, number>;
  onSelect: (date: Date) => void;
}) {
  return (
    <View style={styles.weeks}>
      {weeks.map((week, row) => (
        <View key={row} style={styles.week}>
          {week.map(({ date, inMonth }) => {
            const active = selected !== null && isSameDay(date, selected);
            const count = eventCounts.get(toDateKey(date)) ?? 0;
            return (
              <Pressable
                key={date.getDay()}
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
                {count > 0 && inMonth && (
                  <View style={styles.dots}>
                    <View
                      testID="event-dot"
                      style={[styles.dot, active && styles.dotActive]}
                    />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

const ARROW_SIZE = 24;
const TITLE_GAP = 6;
const CELL_HEIGHT = 69;
// Figma Event Indicator Count=1: 7×7 점 하나, 칸 아래에서 13
const DOT_SIZE = 7;

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
// 7칸이 빈틈없이 붙어 있어 좌우로는 넓히지 않는다. 넘김 창이 격자 높이에서 자르므로 첫 주 위·마지막 주 아래로 넓히면
// 창도 같이 넓혀야 한다
const DAY_SLOP = touchSlop(CELL_HEIGHT);
const DAY_HIT_SLOP = { top: DAY_SLOP, bottom: DAY_SLOP };

const styles = StyleSheet.create({
  // Figma 3754:6618: 흰 카드, 모서리 18, 위 20 에 달 이동 줄, 그 아래 24 에 요일 줄·날짜 격자. 좌우·아래 여백은 없다.
  // 위 여백(20)이 화살표가 위로 넓힌 영역(10)을 품는다
  container: {
    gap: 24,
    paddingTop: 20,
    borderRadius: 18,
    backgroundColor: colors.white[100],
  },
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
  dots: { position: 'absolute', bottom: 13 },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.primary100,
  },
  dotActive: { backgroundColor: colors.white[100] },
});
