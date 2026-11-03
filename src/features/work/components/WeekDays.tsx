import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, Text } from '../../../shared/design-system';
import { isSameDay, WEEKDAYS } from '../../schedule/model';
import { dayA11yLabel } from '../../schedule/components/calendarDay';

// 내 작업 블록 보기의 이번 주 날짜 칸 7개 (#94). Figma 작업 수행 › 메인화면 - 시작 가능 (3463:17452) 의
// Frame 2147239654: 가로, 칸 사이 5. 칸(Calendar Contents)은 45×69, 모서리 10, 흰 채움(#FFFFFF),
// 고른 날은 Primary 채움. 날짜 Body/XS/Medium(고른 날 Body/XS/Semibold), 요일 Caption/M/Medium 불투명도 60%, 사이 6
export const WeekDays = memo(function WorkWeekDays({
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
      {days.map(day => {
        const active = isSameDay(day, selected);
        const color = active ? colors.white[100] : dayColor(day.getDay());
        return (
          <Pressable
            key={day.getTime()}
            accessibilityRole="button"
            accessibilityLabel={dayA11yLabel(day)}
            accessibilityState={{ selected: active }}
            hitSlop={DAY_HIT_SLOP}
            onPress={() => onSelect(day)}
            style={[styles.day, active && styles.dayActive]}
          >
            <Text
              variant={active ? 'Body/XS/SemiBold' : 'Body/XS/Medium'}
              color={color}
            >
              {day.getDate()}
            </Text>
            <Text
              variant="Caption/M/Medium"
              color={color}
              style={styles.weekday}
            >
              {WEEKDAYS[day.getDay()]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

// 자리별 Figma 패널 값: 토(19) Warning/1, 일(20) Accents/Blue, 평일 Gray900.
// 내 일정 주간 줄(일 Warning/1, 토 Accents/Blue)과 반대지만 이 화면의 Figma 값을 따른다
function dayColor(day: number): string {
  if (day === 6) {
    return colors.warning[1];
  }
  if (day === 0) {
    return colors.accents.blue;
  }
  return colors.gray[900];
}

const DAY_GAP = 5;
// 칸 폭이 375 에서 42.4 라 칸 사이 간격까지 넓힌다. 간격의 반씩 양옆으로 넓혀 옆 칸과 겹치지 않는다
const DAY_HIT_SLOP = { left: DAY_GAP / 2, right: DAY_GAP / 2 };

const styles = StyleSheet.create({
  // Figma 칸 45 는 393 화면에서 (345 - 간격 5×6) / 7 이다. 화면 폭에 맞춰 7칸이 나눠 갖는다
  row: { flexDirection: 'row', gap: DAY_GAP },
  // 글자를 키우면 칸이 함께 커지도록 높이는 최소값으로 건다
  day: {
    flex: 1,
    minHeight: 69,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: colors.white[100],
  },
  dayActive: { backgroundColor: colors.primary },
  weekday: { opacity: 0.6 },
});
