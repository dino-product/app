import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import { colors, Text } from '../../../shared/design-system';
import { GestureExclusionArea } from '../../../shared/native/GestureExclusionArea';
import { addWeeks, isSameDay, WEEKDAYS } from '../model';
import { dayA11yLabel, dayColor } from './calendarDay';
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

// Figma 내 일정 › 주간 날짜 줄 (DesignSystem › Calendar Contents, View=Week). 선택한 날은 Primary 배경 상자.
// 왼쪽으로 밀면 다음 주, 오른쪽으로 밀면 이전 주 (iOS 캘린더와 같은 방향).
export function WeekStrip({
  days,
  selected,
  onSelect,
  onPrev,
  onNext,
  edgeInset = 0,
}: {
  days: readonly Date[];
  selected: Date;
  onSelect: (date: Date) => void;
  /** 이전 주로 밀었을 때 */
  onPrev: () => void;
  /** 다음 주로 밀었을 때 */
  onNext: () => void;
  /** 부모가 화면 가장자리에서 들어간 거리. Android 에서 이만큼 바깥까지 가장자리 밀기를 받는다 */
  edgeInset?: number;
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
    <View
      testID="week-strip"
      hitSlop={DAY_HIT_SLOP}
      style={styles.row}
      {...swipeHandlers}
    >
      <GestureExclusionArea edgeInset={edgeInset} />
      {days.map(date => {
        const active = isSameDay(date, selected);
        const color = active
          ? colors.white[100]
          : dayColor(date.getDay(), 'week');
        return (
          <Pressable
            // 요일 칸을 key 로 둬 주가 바뀌어도 칸을 다시 만들지 않는다. VoiceOver 포커스가 같은 요일에 머문다
            key={date.getDay()}
            accessibilityRole="button"
            accessibilityLabel={dayA11yLabel(date)}
            accessibilityState={{ selected: active }}
            accessibilityActions={weekActions}
            onAccessibilityAction={moveWeekFrom(date)}
            hitSlop={DAY_HIT_SLOP}
            onPress={() => onSelect(date)}
            style={[styles.day, active && styles.dayActive]}
          >
            <Text
              variant={active ? 'Body/XS/SemiBold' : 'Body/XS/Medium'}
              color={color}
            >
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

const DAY_GAP = 6;
// 칸 폭(375 에서 45.6)을 뒤 칸 쪽 칸 사이 간격만큼 넓혀 최소 터치 영역을 채운다 (360dp 에서도 43.4 + 6).
// 간격까지만 넓혀 옆 칸과 겹치지 않고, 루트가 네이티브 뷰가 되어도 마지막 칸에 닿도록 루트도 같이 넓힌다
const DAY_HIT_SLOP = { right: DAY_GAP };

const styles = StyleSheet.create({
  // Figma 칸 48.14 는 393 화면에서 (373 - 간격 6×6) / 7 이다. 화면 폭에 맞춰 7칸이 나눠 갖는다
  row: { flexDirection: 'row', gap: DAY_GAP },
  day: {
    flex: 1,
    height: 69,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
  },
  dayActive: { backgroundColor: colors.primary },
  weekday: { opacity: 0.6 },
});
