import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, Icon, Text } from '../../../shared/design-system';
import { GestureExclusionArea } from '../../../shared/native/GestureExclusionArea';
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
  edgeInset = 0,
}: {
  year: number;
  month: number;
  selected: Date;
  markedKeys: ReadonlySet<string>;
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
    weeks.length * styles.circle.height +
    (weeks.length - 1) * styles.container.gap;

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
          <Icon name="chevron-left" size={16} color={colors.gray[500]} />
        </Pressable>
        <Text variant="Body/XS/SemiBold">{formatMonthTitle(year, month)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          hitSlop={NEXT_HIT_SLOP}
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

      {weeks.map((week, row) => (
        <View key={toDateKey(week[0].date)} style={styles.week}>
          {row === 0 && (
            // 시스템은 한쪽 가장자리마다 세로 200dp 까지만 빼 준다. 밀기는 주로 날짜 칸에서 하고 제목 줄에는
            // 이전·다음 달 버튼이 있으니 첫 주부터 뺀다. 어느 달이든 넷째 주까지는 있어 달을 넘겨도 같은 자리다
            <GestureExclusionArea edgeInset={edgeInset} height={gridHeight} />
          )}
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

// 16pt 화살표를 터치 최소 44pt 로 보완한다. 제목 쪽은 간격(12)까지만 넓힌다 (제목이 먼저 받는다)
const PREV_HIT_SLOP = { top: 14, bottom: 14, left: 16, right: 12 };
const NEXT_HIT_SLOP = { top: 14, bottom: 14, left: 12, right: 16 };
// 날짜 칸 높이 40 을 터치 최소 44pt 로 보완한다
const DAY_HIT_SLOP = { top: 2, bottom: 2 };
// 루트가 네이티브 뷰가 되어도 화살표·마지막 주가 루트 밖으로 넓힌 영역에 터치가 닿게 한다
const ROOT_HIT_SLOP = { top: PREV_HIT_SLOP.top, bottom: DAY_HIT_SLOP.bottom };

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
