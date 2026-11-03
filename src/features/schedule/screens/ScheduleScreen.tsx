import { useCallback, useEffect, useMemo, useState, type Ref } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type FlatListInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  Icon,
  ICON_HIT_SLOP,
  Text,
  UnderlineTabs,
} from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { MonthCalendar } from '../components/MonthCalendar';
import { ConfirmedRow, PendingRequestCard } from '../components/ScheduleRows';
import { useTouchScrollLock } from '../components/useTouchScrollLock';
import { WeekStrip } from '../components/WeekStrip';
import {
  addMonths,
  addWeeks,
  countByDate,
  formatDateHeader,
  startOfWeek,
  toDateKey,
  weekDays,
  type ConfirmedSchedule,
  type PendingRequest,
} from '../model';

// Figma 스케줄 › 내 일정 (확정 일정: 주간 / 달력 펼침, 응답 필요)
export type ScheduleScreenProps = {
  today: Date;
  confirmed: readonly ConfirmedSchedule[];
  pending: readonly PendingRequest[];
  onAccept: (id: string) => void;
  /** 거절 사유 화면으로 */
  onReject: (id: string) => void;
  onOpenRequest: (id: string) => void;
  /** 바깥에서 하위 탭을 고를 때 (탈퇴 불가 → 응답 필요). 값이 들어올 때마다 그 탭으로 옮긴다 */
  requestedTab?: ScheduleTab;
  /** 바깥에서 지금 보이는 리스트(확정 일정 / 응답 필요)를 맨 위로 올릴 때 쓴다 */
  listRef?: Ref<FlatListInstance>;
};

export type ScheduleTab = 'confirmed' | 'pending';

export function ScheduleScreen({
  today,
  confirmed,
  pending,
  onAccept,
  onReject,
  onOpenRequest,
  requestedTab,
  listRef,
}: ScheduleScreenProps) {
  // 처음 열 때 요청이 있으면 바로 그 탭으로 그린다 (확정 일정을 먼저 그렸다 바꾸지 않게)
  const [tab, setTab] = useState<ScheduleTab>(
    () => requestedTab ?? 'confirmed',
  );
  useEffect(() => {
    if (requestedTab) {
      setTab(requestedTab);
    }
  }, [requestedTab]);
  const [selected, setSelected] = useState(today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  // 주간 줄이 보이는 주의 일요일 0시. 고른 날이 없는 주일 수 있다
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(today).getTime(),
  );

  const selectedKey = toDateKey(selected);
  const daySchedules = useMemo(
    () =>
      confirmed
        .filter(item => item.dateKey === selectedKey)
        // "08:00 - 09:00" 처럼 시작 시각이 앞에 오므로 문자열 비교로 시간순이 된다
        .sort((a, b) => a.timeRange.localeCompare(b.timeRange)),
    [confirmed, selectedKey],
  );
  const eventCounts = useMemo(() => countByDate(confirmed), [confirmed]);

  // 고른 날의 주·달을 보여 준다
  const selectDate = useCallback((date: Date) => {
    setSelected(date);
    setViewMonth({ year: date.getFullYear(), month: date.getMonth() });
    setWeekStart(startOfWeek(date).getTime());
  }, []);
  // 주간 ↔ 달력을 바꾸면 넘겨 보던 주·달 대신 고른 날의 주·달을 보여 준다 (#100)
  const toggleCalendar = useCallback(() => {
    setCalendarOpen(open => !open);
    selectDate(selected);
  }, [selectDate, selected]);

  const moveMonth = useCallback(
    (delta: number) =>
      setViewMonth(prev => addMonths(prev.year, prev.month, delta)),
    [],
  );

  // 주간 줄은 보이는 주를 따로 둔다. 주를 넘겨도 고른 날은 그대로다 (#100)
  const moveWeek = useCallback(
    (delta: number) =>
      setWeekStart(prev => addWeeks(new Date(prev), delta).getTime()),
    [],
  );
  const week = useMemo(() => weekDays(new Date(weekStart)), [weekStart]);

  // 달력을 만지는 동안 리스트가 세로로 움직이지 않게 한다 (#99)
  const scrollLock = useTouchScrollLock();
  const calendarTouch = scrollLock.areaTouchHandlers;

  const renderConfirmed = useCallback(
    ({ item }: { item: ConfirmedSchedule }) => <ConfirmedRow item={item} />,
    [],
  );
  const renderPending = useCallback(
    ({ item }: { item: PendingRequest }) => (
      <PendingRequestCard
        item={item}
        onAccept={onAccept}
        onReject={onReject}
        onOpen={onOpenRequest}
      />
    ),
    [onAccept, onReject, onOpenRequest],
  );

  // 달력을 만져 리스트 스크롤을 막고 풀 때는 날짜 머리·달력을 다시 그리지 않는다 (손가락을 따라갈 JS 를 붙잡지 않게)
  const dateHeader = useMemo(
    () => (
      <View style={styles.dateArea}>
        <View style={styles.dateRow}>
          <Text variant="Body/M/SemiBold">{formatDateHeader(selected)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={calendarOpen ? '달력 접기' : '달력 펼치기'}
            hitSlop={ICON_HIT_SLOP}
            onPress={toggleCalendar}
          >
            {/* Figma 는 접힘·펼침의 아이콘 모양(좌우 반전)과 색이 다르다 */}
            {calendarOpen ? (
              <Icon name="calendar-switch-open" color={colors.gray[800]} />
            ) : (
              <Icon name="calendar-switch" color={colors.gray[500]} />
            )}
          </Pressable>
        </View>
        {/* Figma 는 주간 줄과 펼친 달력의 여백이 다르고, 구분선은 주간 줄에만 있다 */}
        {calendarOpen ? (
          <View style={styles.monthArea}>
            <MonthCalendar
              year={viewMonth.year}
              month={viewMonth.month}
              selected={selected}
              eventCounts={eventCounts}
              edgeInset={styles.monthArea.paddingHorizontal}
              touchHandlers={calendarTouch}
              onSelect={selectDate}
              onPrev={() => moveMonth(-1)}
              onNext={() => moveMonth(1)}
            />
          </View>
        ) : (
          <View style={styles.weekArea}>
            <View style={styles.rule} />
            <WeekStrip
              days={week}
              selected={selected}
              edgeInset={styles.weekArea.paddingHorizontal}
              touchHandlers={calendarTouch}
              onSelect={selectDate}
              onPrev={() => moveWeek(-1)}
              onNext={() => moveWeek(1)}
            />
          </View>
        )}
      </View>
    ),
    [
      selected,
      calendarOpen,
      viewMonth,
      week,
      eventCounts,
      selectDate,
      toggleCalendar,
      moveMonth,
      moveWeek,
      calendarTouch,
    ],
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {/* 머리말 그림자가 아래 리스트 위로 드리우도록 앞에 그린다 */}
      <View style={styles.header}>
        <View style={readableColumn}>
          <Text
            accessibilityRole="header"
            variant="Body/XL/SemiBold"
            color={colors.black}
            style={styles.title}
          >
            내 일정
          </Text>
          <UnderlineTabs
            items={[
              {
                key: 'confirmed',
                label: '확정 일정',
                count: daySchedules.length,
              },
              { key: 'pending', label: '응답 필요', count: pending.length },
            ]}
            selectedKey={tab}
            onChange={setTab}
          />
        </View>
      </View>
      {/* 같은 자리의 FlatList 하나를 data 만 바꿔 쓰므로 ref 는 늘 지금 보이는 리스트다 */}
      {tab === 'confirmed' ? (
        <FlatList
          ref={listRef}
          // 머리의 주간 줄·달력을 가로로 밀 때 리스트가 세로로 따라 움직이며 밀기를 가져가지 않게 한다 (iOS)
          directionalLockEnabled
          // 달력에 손가락이 닿아 있는 동안은 세로로도 움직이지 않는다 (#99)
          scrollEnabled={!scrollLock.locked}
          onTouchStartCapture={scrollLock.onListTouchStartCapture}
          data={daySchedules}
          keyExtractor={keyExtractor}
          renderItem={renderConfirmed}
          ListHeaderComponent={dateHeader}
          ListEmptyComponent={<Empty text="예정된 일정이 없습니다" />}
          style={styles.list}
          contentContainerStyle={readableColumn}
        />
      ) : (
        <FlatList
          ref={listRef}
          data={pending}
          keyExtractor={keyExtractor}
          renderItem={renderPending}
          ListEmptyComponent={<Empty text="응답할 요청이 없습니다" />}
          style={styles.list}
          contentContainerStyle={readableColumn}
        />
      )}
    </SafeAreaView>
  );
}

const keyExtractor = (item: { id: string }) => item.id;

function Empty({ text }: { text: string }) {
  return (
    <Text
      variant="Body/XS/Medium"
      color={colors.gray[500]}
      style={styles.empty}
    >
      {text}
    </Text>
  );
}

// Figma: 날짜 줄·달력·구분선은 화면 가장자리에서 24, 주간 줄은 10 안쪽이다
const DATE_INSET = 24;
const WEEK_INSET = 10;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  header: {
    zIndex: 1,
    backgroundColor: colors.white[100],
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.04)',
  },
  // 탭 위 여백(8)과 합쳐 제목과 탭 사이가 Figma 의 24 가 된다
  title: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  list: { flex: 1 },
  dateArea: {
    paddingTop: 24,
    borderBottomWidth: 12,
    borderBottomColor: colors.background[3],
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DATE_INSET,
  },
  weekArea: {
    gap: 20,
    paddingHorizontal: WEEK_INSET,
    paddingTop: 20,
    paddingBottom: 20,
  },
  monthArea: {
    paddingHorizontal: DATE_INSET,
    paddingTop: 24,
    paddingBottom: 24,
  },
  rule: {
    height: 1,
    marginHorizontal: DATE_INSET - WEEK_INSET,
    backgroundColor: colors.gray[100],
  },
  empty: { textAlign: 'center', paddingVertical: 40 },
});
