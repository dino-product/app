import { Pressable, StyleSheet, View } from 'react-native';
import { colors, Text } from '../../../shared/design-system';
import { isSameDay, WEEKDAYS } from '../model';
import { dayA11yLabel, weekdayColor } from './calendarDay';

// Figma 내 일정 › 주간 날짜 줄. 선택한 날은 Primary 배경 상자.
export function WeekStrip({
  days,
  selected,
  onSelect,
}: {
  days: readonly Date[];
  selected: Date;
  onSelect: (date: Date) => void;
}) {
  return (
    <View style={styles.row}>
      {days.map(date => {
        const active = isSameDay(date, selected);
        const color = active ? colors.white[100] : weekdayColor(date.getDay());
        return (
          <Pressable
            key={date.getTime()}
            accessibilityRole="button"
            accessibilityLabel={dayA11yLabel(date)}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(date)}
            style={[styles.day, active && styles.dayActive]}
          >
            <Text variant="Body/XS/Medium" color={color}>
              {date.getDate()}
            </Text>
            <Text
              variant="Caption/M/Medium"
              color={color}
              style={styles.weekday}
            >
              {WEEKDAYS[date.getDay()]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    alignItems: 'center',
    gap: 6,
    minWidth: 40,
    paddingVertical: 8,
    borderRadius: 10,
  },
  dayActive: { backgroundColor: colors.primary },
  weekday: { opacity: 0.6 },
});
