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
import { WeekStrip } from '../components/WeekStrip';
import {
  addMonths,
  addWeeks,
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
  const [tab, setTab] = useState<ScheduleTab>('confirmed');
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

  const selectedKey = toDateKey(selected);
  const daySchedules = useMemo(
    () =>
      confirmed
        .filter(item => item.dateKey === selectedKey)
        // "08:00 - 09:00" 처럼 시작 시각이 앞에 오므로 문자열 비교로 시간순이 된다
        .sort((a, b) => a.timeRange.localeCompare(b.timeRange)),
    [confirmed, selectedKey],
  );
  const markedKeys = useMemo(
    () => new Set(confirmed.map(item => item.dateKey)),
    [confirmed],
  );

  const selectDate = useCallback((date: Date) => {
    setSelected(date);
    setViewMonth({ year: date.getFullYear(), month: date.getMonth() });
  }, []);

  const moveMonth = (delta: number) =>
    setViewMonth(prev => addMonths(prev.year, prev.month, delta));

  // 주간 줄은 선택한 날의 주를 그린다. 밀어서 주를 넘기면 같은 요일을 고른다 (iOS 캘린더 일 보기)
  const moveWeek = (delta: number) => selectDate(addWeeks(selected, delta));
  const weekStart = startOfWeek(selected).getTime();
  const week = useMemo(() => weekDays(new Date(weekStart)), [weekStart]);

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

  const dateHeader = (
    <View style={styles.dateArea}>
      <View style={styles.dateRow}>
        <Text variant="Body/M/SemiBold">{formatDateHeader(selected)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={calendarOpen ? '달력 접기' : '달력 펼치기'}
          hitSlop={ICON_HIT_SLOP}
          onPress={() => setCalendarOpen(open => !open)}
        >
          <Icon name="calendar" color={colors.gray[600]} />
        </Pressable>
      </View>
      <View style={styles.rule} />
      {calendarOpen ? (
        <MonthCalendar
          year={viewMonth.year}
          month={viewMonth.month}
          selected={selected}
          markedKeys={markedKeys}
          edgeInset={styles.dateArea.paddingHorizontal}
          onSelect={selectDate}
          onPrev={() => moveMonth(-1)}
          onNext={() => moveMonth(1)}
        />
      ) : (
        <WeekStrip
          days={week}
          selected={selected}
          edgeInset={styles.dateArea.paddingHorizontal}
          onSelect={selectDate}
          onPrev={() => moveWeek(-1)}
          onNext={() => moveWeek(1)}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
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
      {/* 같은 자리의 FlatList 하나를 data 만 바꿔 쓰므로 ref 는 늘 지금 보이는 리스트다 */}
      {tab === 'confirmed' ? (
        <FlatList
          ref={listRef}
          // 머리의 주간 줄·달력을 가로로 밀 때 리스트가 세로로 따라 움직이며 밀기를 가져가지 않게 한다 (iOS)
          directionalLockEnabled
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  title: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  list: { flex: 1 },
  dateArea: {
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 12,
    borderBottomColor: colors.background[3],
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rule: { height: 1, backgroundColor: colors.gray[100] },
  empty: { textAlign: 'center', paddingVertical: 40 },
});
