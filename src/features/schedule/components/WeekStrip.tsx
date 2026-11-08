import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
} from 'react-native';
import { colors, Text } from '../../../shared/design-system';
import { useTabSwipeRegion } from '../../../shared/gesture/TabSwipeArea';
import { GestureExclusionArea } from '../../../shared/native/GestureExclusionArea';
import { addWeeks, isSameDay, WEEKDAYS } from '../model';
import { dayA11yLabel, dayColor, weekA11yLabel } from './calendarDay';
import { SwipeTrack, type PageOffset } from './SwipeTrack';
import { useHorizontalSwipe } from './useHorizontalSwipe';
import type { AreaTouchHandlers } from './useTouchScrollLock';

// VoiceOver 는 한 손가락 밀기를 탐색에 쓰므로 날짜마다 이전·다음 주 동작을 단다 (위·아래로 쓸어 넘긴다)
const weekActions = [
  { name: 'prevWeek', label: '이전 주' },
  { name: 'nextWeek', label: '다음 주' },
];
const weekActionDelta: Partial<Record<string, number>> = {
  prevWeek: -1,
  nextWeek: 1,
};

// Figma 내 일정 › 주간 날짜 줄 (DesignSystem › Calendar Contents, View=Week). 선택한 날은 Primary 배경 상자.
// 왼쪽으로 밀면 다음 주, 오른쪽으로 밀면 이전 주 (iOS 캘린더와 같은 방향). 끄는 동안 줄이 손가락을 따라 움직이고
// 옆 주가 드러나며, 다 넘어간 뒤에 onPrev·onNext 를 부른다. 넘기는 것은 보이는 주(days)뿐이고 고른 날은 그대로다.
export function WeekStrip({
  days,
  selected,
  onSelect,
  onPrev,
  onNext,
  edgeInset = 0,
  touchHandlers,
}: {
  /** 보이는 주 (일요일~토요일). 고른 날이 없는 주일 수 있다 */
  days: readonly Date[];
  selected: Date;
  onSelect: (date: Date) => void;
  /** 이전 주로 넘겼을 때 */
  onPrev: () => void;
  /** 다음 주로 넘겼을 때 */
  onNext: () => void;
  /**
   * 부모가 화면 가장자리에서 들어간 거리. Android 에서 이만큼 바깥까지 가장자리 밀기를 받고,
   * 넘길 때 옆 주가 이만큼 바깥(화면 가장자리)에서 들어온다
   */
  edgeInset?: number;
  /** 루트에 다는 터치 핸들러. 리스트 머리에 두면 만지는 동안 리스트 스크롤을 막는 데 쓴다 */
  touchHandlers?: AreaTouchHandlers;
}) {
  // 화면 가장자리 띠·줄 가장자리 여유에서 시작한 밀기는 탭 전환 몫이라 주를 넘기지 않는다 (#140)
  const tabSwipe = useTabSwipeRegion();
  const swipe = useHorizontalSwipe({
    onPrev,
    onNext,
    ownsGesture: tabSwipe.ownsGesture,
  });
  const onTouchStart = (event: GestureResponderEvent) => {
    touchHandlers?.onTouchStart(event);
    tabSwipe.onTouchStart(event);
  };
  // 밀기처럼 보이는 주만 넘기고 고른 날은 그대로 둔다. 포커스한 칸은 그대로 남고 레이블만 바뀌어
  // VoiceOver 가 저절로 읽지 않으므로 넘긴 주를 읽어 준다 (말하던 것이 끝난 뒤에)
  const moveWeek = ({ nativeEvent }: AccessibilityActionEvent) => {
    const delta = weekActionDelta[nativeEvent.actionName];
    if (delta === undefined) {
      return;
    }
    if (delta < 0) {
      onPrev();
    } else {
      onNext();
    }
    AccessibilityInfo.announceForAccessibilityWithOptions(
      weekA11yLabel(days.map(day => addWeeks(day, delta))),
      { queue: true },
    );
  };

  // 검정 칸은 고른 날 하나에만 있다. 옆 주도 고른 날이 그 주에 있을 때만 그린다
  const renderWeek = (offset: PageOffset) => {
    return (
      <View style={styles.row}>
        {days.map(day => {
          const date = addWeeks(day, offset);
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
              onAccessibilityAction={moveWeek}
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
  };

  return (
    <View
      testID="week-strip"
      {...touchHandlers}
      onTouchStart={onTouchStart}
      {...swipe.panHandlers}
    >
      <GestureExclusionArea edgeInset={edgeInset} />
      <SwipeTrack
        swipe={swipe}
        // 마지막 칸이 넓힌 영역(칸 사이 간격)까지 창이 덮어야 그 터치를 받는다
        inset={Math.max(edgeInset, DAY_GAP)}
        testID="week-strip-track"
        renderPage={renderWeek}
      />
    </View>
  );
}

const DAY_GAP = 6;
// 칸을 뒤 칸 쪽 칸 사이 간격만큼 넓힌다. 간격까지만 넓혀 옆 칸과 겹치지 않고, 마지막 칸이 넓힌 영역은 넘김 창의 좌우 여백이 덮는다.
// 부모가 좌우 24 안쪽(Figma 3754:6303)이라 칸 폭이 375 에서 41.6, 360dp 에서 39.4 다. +6 이면 iOS 44 는 채우고
// Android 48 은 못 채운다 (393 에서는 50.1). 칸이 붙어 있어 더 넓힐 수 없다 — 디자인 결정 대기 #172
const DAY_HIT_SLOP = { right: DAY_GAP };

const styles = StyleSheet.create({
  // Figma 칸 44.14 는 393 화면에서 (345 - 간격 6×6) / 7 이다. 화면 폭에 맞춰 7칸이 나눠 갖는다
  row: { flexDirection: 'row', gap: DAY_GAP },
  // Figma 3754:6303: 회색 바탕 위 흰 칸 (Calendar Contents View=Week, Unselected)
  day: {
    flex: 1,
    height: 69,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: colors.white[100],
  },
  dayActive: { backgroundColor: colors.primary },
  weekday: { opacity: 0.6 },
});
