import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import { colors, Text } from '../../../shared/design-system';
import { addWeeks, isSameDay, WEEKDAYS } from '../model';
import { dayA11yLabel, weekdayColor } from './calendarDay';
import { useHorizontalSwipe } from './useHorizontalSwipe';

// VoiceOver 는 한 손가락 밀기를 탐색에 쓰므로 날짜마다 이전·다음 주 동작을 단다 (위·아래로 쓸어 고른다)
const weekActions = [
  { name: 'prevWeek', label: '이전 주' },
  { name: 'nextWeek', label: '다음 주' },
];
const weekActionDelta: Partial<Record<string, number>> = {
  prevWeek: -1,
  nextWeek: 1,
};

// Figma 내 일정 › 주간 날짜 줄. 선택한 날은 Primary 배경 상자.
// 왼쪽으로 밀면 다음 주, 오른쪽으로 밀면 이전 주 (iOS 캘린더와 같은 방향).
export function WeekStrip({
  days,
  selected,
  onSelect,
  onPrev,
  onNext,
}: {
  days: readonly Date[];
  selected: Date;
  onSelect: (date: Date) => void;
  /** 이전 주로 밀었을 때 */
  onPrev: () => void;
  /** 다음 주로 밀었을 때 */
  onNext: () => void;
}) {
  const swipeHandlers = useHorizontalSwipe({
    onSwipeLeft: onNext,
    onSwipeRight: onPrev,
  });
  // 동작은 포커스한 칸 기준이다: 그 요일을 앞뒤 주에서 고른다. 칸은 그대로 남고 레이블만 바뀌므로
  // VoiceOver 가 저절로 읽지 않는 새 날짜를 읽어 준다 (말하던 것이 끝난 뒤에)
  const moveWeekFrom =
    (date: Date) =>
    ({ nativeEvent }: AccessibilityActionEvent) => {
      const delta = weekActionDelta[nativeEvent.actionName];
      if (delta === undefined) {
        return;
      }
      const next = addWeeks(date, delta);
      onSelect(next);
      AccessibilityInfo.announceForAccessibilityWithOptions(
        dayA11yLabel(next),
        { queue: true },
      );
    };

  return (
    <View testID="week-strip" style={styles.row} {...swipeHandlers}>
      {days.map(date => {
        const active = isSameDay(date, selected);
        const color = active ? colors.white[100] : weekdayColor(date.getDay());
        return (
          <Pressable
            // 요일 칸을 key 로 둬 주가 바뀌어도 칸을 다시 만들지 않는다. VoiceOver 포커스가 같은 요일에 머문다
            key={date.getDay()}
            accessibilityRole="button"
            accessibilityLabel={dayA11yLabel(date)}
            accessibilityState={{ selected: active }}
            accessibilityActions={weekActions}
            onAccessibilityAction={moveWeekFrom(date)}
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
