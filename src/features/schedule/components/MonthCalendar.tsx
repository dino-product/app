import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  Icon,
  MIN_TOUCH_TARGET,
  Text,
  touchSlop,
} from '../../../shared/design-system';
import {
  formatMonthTitle,
  isSameDay,
  monthGrid,
  toDateKey,
  WEEKDAYS,
} from '../model';
import { dayA11yLabel, weekdayColor } from './calendarDay';
import { useHorizontalSwipe } from './useHorizontalSwipe';

// Figma 내 일정 › 달력 펼침. 선택일은 Secondary 원, 일정이 있는 날은 점으로 표시한다.
// 왼쪽으로 밀면 다음 달, 오른쪽으로 밀면 이전 달. 이전·다음 달 버튼과 같은 콜백을 부른다.
export function MonthCalendar({
  year,
  month,
  selected,
  markedKeys,
  onSelect,
  onPrev,
  onNext,
}: {
  year: number;
  month: number;
  selected: Date;
  markedKeys: ReadonlySet<string>;
  onSelect: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const swipeHandlers = useHorizontalSwipe({
    onSwipeLeft: onNext,
    onSwipeRight: onPrev,
  });
  const weeks = useMemo(() => monthGrid(year, month), [year, month]);

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
            name="chevron-left"
            size={ARROW_SIZE}
            color={colors.gray[500]}
          />
        </Pressable>
        <Text variant="Body/XS/SemiBold">{formatMonthTitle(year, month)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          hitSlop={NEXT_HIT_SLOP}
          onPress={onNext}
        >
          <Icon
            name="chevron-right"
            size={ARROW_SIZE}
            color={colors.gray[500]}
          />
        </Pressable>
      </View>

      {/* 화살표가 아래로 넓힌 영역이 요일 줄에 걸친다. 뒤 형제인 요일 글자가 먼저 받지 않게 터치를 넘긴다 */}
      <View style={[styles.week, styles.passTouches]}>
        {WEEKDAYS.map((label, day) => (
          <Text
            key={label}
            variant="Caption/M/Medium"
            color={weekdayColor(day)}
            style={styles.weekdayText}
          >
            {label}
          </Text>
        ))}
      </View>

      {weeks.map(week => (
        <View key={toDateKey(week[0].date)} style={styles.week}>
          {week.map(({ date, inMonth }) => {
            const active = isSameDay(date, selected);
            const marked = markedKeys.has(toDateKey(date));
            return (
              <Pressable
                key={date.getTime()}
                accessibilityRole="button"
                accessibilityLabel={dayA11yLabel(date)}
                accessibilityState={{ selected: active }}
                hitSlop={DAY_HIT_SLOP}
                onPress={() => onSelect(date)}
                style={styles.cell}
              >
                <View style={[styles.circle, active && styles.circleActive]}>
                  <Text
                    variant="Body/XS/Medium"
                    color={
                      active
                        ? colors.white[100]
                        : inMonth
                        ? colors.gray[900]
                        : colors.gray[300]
                    }
                  >
                    {date.getDate()}
                  </Text>
                  {marked && (
                    <View style={styles.dots}>
                      {[0, 1, 2].map(i => (
                        <View
                          key={i}
                          style={[styles.dot, active && styles.dotActive]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const ARROW_SIZE = 16;
const TITLE_GAP = 12;
const CIRCLE_SIZE = 40;

// 16 화살표를 최소 터치 영역으로 보완한다. 제목 쪽은 간격(12)까지만 넓히고(제목이 먼저 받는다) 나머지는 바깥쪽으로
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
// 날짜 칸 높이 40 을 최소 터치 영역으로 보완한다. 7칸이 빈틈없이 붙어 있어 좌우로는 넓히지 않는다
const DAY_SLOP = touchSlop(CIRCLE_SIZE);
const DAY_HIT_SLOP = { top: DAY_SLOP, bottom: DAY_SLOP };
// 루트가 네이티브 뷰가 되어도 화살표·마지막 주가 루트 밖으로 넓힌 영역에 터치가 닿게 한다
const ROOT_HIT_SLOP = { top: PREV_HIT_SLOP.top, bottom: DAY_HIT_SLOP.bottom };

const styles = StyleSheet.create({
  container: { gap: 12 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: TITLE_GAP,
  },
  week: { flexDirection: 'row' },
  passTouches: { pointerEvents: 'none' },
  cell: { flex: 1, alignItems: 'center' },
  weekdayText: { flex: 1, textAlign: 'center' },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CIRCLE_SIZE / 2,
  },
  circleActive: { backgroundColor: colors.secondary },
  dots: { position: 'absolute', bottom: 5, flexDirection: 'row', gap: 2 },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.secondary,
  },
  dotActive: { backgroundColor: colors.white[100] },
});
