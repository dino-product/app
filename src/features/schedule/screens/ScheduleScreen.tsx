import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  Icon,
  Text,
  UnderlineTabs,
} from '../../../shared/design-system';
import { MonthCalendar } from '../components/MonthCalendar';
import { ConfirmedRow, PendingRequestCard } from '../components/ScheduleRows';
import { WeekStrip } from '../components/WeekStrip';
import {
  addMonths,
  formatDateHeader,
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
};

type ScheduleTab = 'confirmed' | 'pending';

export function ScheduleScreen({
  today,
  confirmed,
  pending,
  onAccept,
  onReject,
  onOpenRequest,
}: ScheduleScreenProps) {
  const [tab, setTab] = useState<ScheduleTab>('confirmed');
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
          hitSlop={10}
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
          onSelect={selectDate}
          onPrev={() => moveMonth(-1)}
          onNext={() => moveMonth(1)}
        />
      ) : (
        <WeekStrip
          days={weekDays(selected)}
          selected={selected}
          onSelect={selectDate}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
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
          { key: 'confirmed', label: '확정 일정', count: daySchedules.length },
          { key: 'pending', label: '응답 필요', count: pending.length },
        ]}
        selectedKey={tab}
        onChange={setTab}
      />
      {tab === 'confirmed' ? (
        <FlatList
          data={daySchedules}
          keyExtractor={keyExtractor}
          renderItem={renderConfirmed}
          ListHeaderComponent={dateHeader}
          ListEmptyComponent={<Empty text="예정된 일정이 없습니다" />}
          style={styles.list}
        />
      ) : (
        <FlatList
          data={pending}
          keyExtractor={keyExtractor}
          renderItem={renderPending}
          ListEmptyComponent={<Empty text="응답할 요청이 없습니다" />}
          style={styles.list}
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
