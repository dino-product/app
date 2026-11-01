import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, Icon, Text } from '../../../shared/design-system';
import {
  formatMonthTitle,
  isSameDay,
  monthGrid,
  toDateKey,
  WEEKDAYS,
} from '../model';
import { dayA11yLabel, weekdayColor } from './calendarDay';
import { useHorizontalSwipe } from './useHorizontalSwipe';

const ARROW_HIT_SLOP = 12;
// 밀기를 받는 루트는 네이티브 뷰라 그 경계 밖 터치는 자식에게 가지 않는다. 맨 위 화살표가 넘치는 만큼 넓힌다
const SWIPE_HIT_SLOP = { top: ARROW_HIT_SLOP };

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
      hitSlop={SWIPE_HIT_SLOP}
      style={styles.container}
      {...swipeHandlers}
    >
      <View style={styles.titleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          hitSlop={ARROW_HIT_SLOP}
          onPress={onPrev}
        >
          <Icon name="chevron-left" size={16} color={colors.gray[500]} />
        </Pressable>
        <Text variant="Body/XS/SemiBold">{formatMonthTitle(year, month)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          hitSlop={ARROW_HIT_SLOP}
          onPress={onNext}
        >
          <Icon name="chevron-right" size={16} color={colors.gray[500]} />
        </Pressable>
      </View>

      <View style={styles.week}>
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

const styles = StyleSheet.create({
  container: { gap: 12 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center' },
  weekdayText: { flex: 1, textAlign: 'center' },
  circle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
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
