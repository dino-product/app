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

// Figma 내 일정 › 달력 펼침. 선택일은 Secondary 원, 일정이 있는 날은 점으로 표시한다.
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
  return (
    <View style={styles.container}>
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

      {monthGrid(year, month).map(week => (
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

// 16pt 화살표를 터치 최소 44pt 로 보완한다
const ARROW_HIT_SLOP = 14;
// 날짜 칸 높이 40 을 터치 최소 44pt 로 보완한다. 주 사이 간격(12) 안에 들고,
// 칸 폭은 375pt 화면에서도 약 46.7 이라 좌우로는 넓히지 않는다
const DAY_HIT_SLOP = { top: 2, bottom: 2 };

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
