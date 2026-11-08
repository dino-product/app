import {
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import {
  Animated,
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
  UNDERLINE_TABS_HEIGHT,
  UnderlineTabs,
} from '../../../shared/design-system';
import { haptic } from '../../../shared/haptics';
import { AutoHideHeaderLayout } from '../../../shared/layout/AutoHideHeaderLayout';
import {
  LoadStateView,
  type LoadState,
} from '../../../shared/layout/LoadStateView';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { TAB_HEADER_HEIGHT, TabHeader } from '../../../shared/layout/TabHeader';
import { useAutoHideHeader } from '../../../shared/layout/useAutoHideHeader';
import { MonthCalendar } from '../components/MonthCalendar';
import { ConfirmedRow, PendingRequestCard } from '../components/ScheduleRows';
import { useTouchScrollLock } from '../components/useTouchScrollLock';
import { WeekStrip } from '../components/WeekStrip';
import {
  addMonths,
  addWeeks,
  countByDate,
  isSameDay,
  formatDateHeader,
  startOfWeek,
  toDateKey,
  weekDays,
  type ConfirmedSchedule,
  type PendingRequest,
} from '../model';
import type { YearMonth } from '../../history/model';

// Figma 스케줄 › 내 일정 (확정 일정: 주간 / 달력 펼침, 응답 필요)
export type ScheduleScreenProps = {
  today: Date;
  confirmed: readonly ConfirmedSchedule[];
  pending: readonly PendingRequest[];
  /** 요청을 수락한다. 서버가 받았으면 true (실패 안내는 부른 쪽이 한다) */
  onAccept: (id: string) => Promise<boolean>;
  /** 거절 사유 화면으로 */
  onReject: (id: string) => void;
  onOpenRequest: (id: string) => void;
  /** 바깥에서 하위 탭을 고를 때 (탈퇴 불가 → 응답 필요). 값이 들어올 때마다 그 탭으로 옮긴다 */
  requestedTab?: ScheduleTab;
  /** 바깥에서 지금 보이는 리스트(확정 일정 / 응답 필요)를 맨 위로 올릴 때 쓴다 */
  listRef?: Ref<FlatListInstance>;
  /** 고른 날의 확정 일정을 불러오는 상태. 준비되지 않았으면 목록 자리에 로딩·오류를 보인다 */
  confirmedLoad?: LoadState;
  /** 응답 필요를 불러오는 상태 */
  pendingLoad?: LoadState;
  /** 고른 날의 달과 펼친 달력의 달 (겹치면 하나). 바뀔 때마다 알린다. 바깥에서 그 달의 일정을 불러온다 */
  onVisibleMonthsChange?: (months: YearMonth[]) => void;
  /** 당겨서 새로고침 */
  refreshing?: boolean;
  onRefresh?: () => void;
};

const READY: LoadState = { status: 'ready' };

const monthOfDate = (date: Date): YearMonth => ({
  year: date.getFullYear(),
  month: date.getMonth(),
});

function visibleMonths(selected: Date, view: YearMonth): YearMonth[] {
  const selectedMonth = monthOfDate(selected);
  return selectedMonth.year === view.year && selectedMonth.month === view.month
    ? [selectedMonth]
    : [selectedMonth, view];
}

export type ScheduleTab = 'confirmed' | 'pending';

function ScheduleScreenView({
  today,
  confirmed,
  pending,
  onAccept,
  onReject,
  onOpenRequest,
  requestedTab,
  listRef,
  confirmedLoad = READY,
  pendingLoad = READY,
  onVisibleMonthsChange,
  refreshing = false,
  onRefresh,
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
  const selectDate = useCallback(
    (date: Date) => {
      setSelected(date);
      setViewMonth(monthOfDate(date));
      setWeekStart(startOfWeek(date).getTime());
      onVisibleMonthsChange?.(visibleMonths(date, monthOfDate(date)));
    },
    [onVisibleMonthsChange],
  );
  // 켜 둔 채 날짜가 바뀌면(자정·다른 날 active) 오늘을 고르고 있던 화면은 새 오늘로 옮긴다. 직접 고른 날은 그대로 둔다
  const lastToday = useRef(today);
  const followToday = useEffectEvent((next: Date) => {
    const previous = lastToday.current;
    lastToday.current = next;
    if (!isSameDay(previous, next) && isSameDay(selected, previous)) {
      selectDate(next);
    }
  });
  useEffect(() => {
    followToday(today);
  }, [today]);

  // 주간 ↔ 달력을 바꾸면 넘겨 보던 주·달 대신 고른 날의 주·달을 보여 준다 (#100)
  const toggleCalendar = useCallback(() => {
    setCalendarOpen(open => !open);
    selectDate(selected);
  }, [selectDate, selected]);

  const moveMonth = useCallback(
    (delta: number) => {
      const next = addMonths(viewMonth.year, viewMonth.month, delta);
      setViewMonth(next);
      onVisibleMonthsChange?.(visibleMonths(selected, next));
    },
    [viewMonth, selected, onVisibleMonthsChange],
  );

  // 주간 줄은 보이는 주를 따로 둔다. 주를 넘겨도 고른 날은 그대로다 (#100)
  const moveWeek = useCallback(
    (delta: number) =>
      setWeekStart(prev => addWeeks(new Date(prev), delta).getTime()),
    [],
  );
  const week = useMemo(() => weekDays(new Date(weekStart)), [weekStart]);

  // 아래로 스크롤하면 제목 줄이 숨고 하위 탭은 화면 맨 위에 남는다. 위로 스크롤하면 다시 보인다 (#148).
  // 하위 탭을 바꾸면 새 리스트가 그려지며(맨 위) 다시 보인다
  const autoHide = useAutoHideHeader(HEADER_ESTIMATE);
  const contentStyle = useMemo(
    () => [readableColumn, { paddingTop: autoHide.height }],
    [autoHide.height],
  );

  // 주간 줄을 만지는 동안 리스트가 세로로 움직이지 않게 한다 (#99).
  // 펼친 달력은 처음 움직인 방향이 가로일 때만 막고, 세로면 리스트가 스크롤한다 (#144)
  const scrollLock = useTouchScrollLock();
  const weekTouch = scrollLock.areaTouchHandlers;
  const monthTouch = scrollLock.axisAreaTouchHandlers;

  const renderConfirmed = useCallback(
    ({ item }: { item: ConfirmedSchedule }) => <ConfirmedRow item={item} />,
    [],
  );
  // 수락을 보내는 동안 그 요청의 버튼을 잠근다. disabled 가 반영되기 전 같은 프레임의 두 번째 탭도 막는다
  const [accepting, setAccepting] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const acceptingRef = useRef(new Set<string>());
  const accept = useCallback(
    async (id: string) => {
      if (acceptingRef.current.has(id)) {
        return;
      }
      acceptingRef.current.add(id);
      setAccepting(new Set(acceptingRef.current));
      try {
        // 햅틱은 결과다: 서버가 수락을 받았을 때만 울린다 (#32)
        if (await onAccept(id)) {
          haptic.success();
        }
      } finally {
        acceptingRef.current.delete(id);
        setAccepting(new Set(acceptingRef.current));
      }
    },
    [onAccept],
  );
  const renderPending = useCallback(
    ({ item }: { item: PendingRequest }) => (
      <PendingRequestCard
        item={item}
        onAccept={accept}
        onReject={onReject}
        onOpen={onOpenRequest}
        disabled={accepting.has(item.id)}
      />
    ),
    [accept, onReject, onOpenRequest, accepting],
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
              touchHandlers={monthTouch}
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
              touchHandlers={weekTouch}
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
      weekTouch,
      monthTouch,
    ],
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {/* 머리말은 리스트 위에 겹쳐 그리고 그림자가 리스트 위로 드리운다.
          탭 첫 화면 공통 상단 바 (#103). Figma 내 일정(2714:12918)에는 종이 없다 */}
      <AutoHideHeaderLayout
        autoHide={autoHide}
        header={<TabHeader title="내 일정" style={styles.titleBar} />}
        sticky={
          <View style={readableColumn}>
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
        }
        style={styles.header}
      >
        {/* 같은 자리의 FlatList 하나를 data 만 바꿔 쓰므로 ref 는 늘 지금 보이는 리스트다 */}
        {tab === 'confirmed' ? (
          <Animated.FlatList
            ref={listRef}
            testID="schedule-confirmed-list"
            {...autoHide.scrollProps}
            // 머리의 주간 줄·달력을 가로로 밀 때 리스트가 세로로 따라 움직이며 밀기를 가져가지 않게 한다 (iOS)
            directionalLockEnabled
            // 주간 줄에 손가락이 닿아 있는 동안, 펼친 달력을 가로로 미는 동안은 세로로 움직이지 않는다 (#99, #144)
            scrollEnabled={!scrollLock.locked}
            onTouchStartCapture={scrollLock.onListTouchStartCapture}
            data={daySchedules}
            keyExtractor={keyExtractor}
            renderItem={renderConfirmed}
            ListHeaderComponent={dateHeader}
            ListEmptyComponent={
              confirmedLoad.status === 'ready' ? (
                <Empty text="예정된 일정이 없습니다" />
              ) : (
                <LoadStateView state={confirmedLoad} />
              )
            }
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressViewOffset={autoHide.progressViewOffset}
            style={styles.list}
            contentContainerStyle={contentStyle}
          />
        ) : (
          <Animated.FlatList
            ref={listRef}
            testID="schedule-pending-list"
            {...autoHide.scrollProps}
            data={pending}
            keyExtractor={keyExtractor}
            renderItem={renderPending}
            ListEmptyComponent={
              pendingLoad.status === 'ready' ? (
                <Empty text="응답할 요청이 없습니다" />
              ) : (
                <LoadStateView state={pendingLoad} />
              )
            }
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressViewOffset={autoHide.progressViewOffset}
            style={styles.list}
            contentContainerStyle={contentStyle}
          />
        )}
      </AutoHideHeaderLayout>
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

// 제목 줄 아래 여백. 탭 위 여백(8)과 합쳐 제목과 탭 사이가 Figma 의 24 가 된다
const TITLE_BAR_PADDING_BOTTOM = 16;
// 기본 글자 크기에서 숨는 제목 줄과 머리 전체(제목 줄 + 하위 탭)의 높이. 그린 뒤 잰 높이로 고친다
const HEADER_ESTIMATE = {
  collapsible: TAB_HEADER_HEIGHT + TITLE_BAR_PADDING_BOTTOM,
  total: TAB_HEADER_HEIGHT + TITLE_BAR_PADDING_BOTTOM + UNDERLINE_TABS_HEIGHT,
};

// Figma: 날짜 줄·달력·구분선은 화면 가장자리에서 24, 주간 줄은 10 안쪽이다
const DATE_INSET = 24;
const WEEK_INSET = 10;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  // 겹쳐 그린 머리(위에 쌓기는 AutoHideHeaderLayout). 내용이 아래로 지나가므로 화면 배경으로 가린다
  header: {
    backgroundColor: colors.white[100],
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.04)',
  },
  titleBar: { paddingBottom: TITLE_BAR_PADDING_BOTTOM },
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

// 탭을 오가면 경로가 포커스 때문에 다시 그려진다. 받은 값이 같으면 화면은 다시 그리지 않는다 (#114 리뷰)
export const ScheduleScreen = memo(ScheduleScreenView);
