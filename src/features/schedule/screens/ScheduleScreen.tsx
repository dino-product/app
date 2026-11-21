import {
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
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
  MIN_TOUCH_TARGET,
  Text,
  touchSlop,
  UNDERLINE_TABS_HEIGHT,
  UnderlineTabs,
} from '../../../shared/design-system';
import { smallestLineHeight } from '../../../shared/design-system/tokens/touchTarget';
import { haptic } from '../../../shared/haptics';
import { useTabSwipeScrollLock } from '../../../shared/gesture/TabSwipeArea';
import { AutoHideHeaderLayout } from '../../../shared/layout/AutoHideHeaderLayout';
import { EMPTY_GAP, EmptyMessage } from '../../../shared/layout/EmptyMessage';
import {
  LoadStateView,
  type LoadState,
} from '../../../shared/layout/LoadStateView';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { TAB_HEADER_HEIGHT, TabHeader } from '../../../shared/layout/TabHeader';
import { useAutoHideHeader } from '../../../shared/layout/useAutoHideHeader';
import { MonthCalendar } from '../components/MonthCalendar';
import { ConfirmedRow, PendingRequestCard } from '../components/ScheduleRows';
import {
  ConfirmedCardsSkeleton,
  PendingRequestsSkeleton,
} from '../components/ScheduleSkeletons';
import { useTouchScrollLock } from '../components/useTouchScrollLock';
import type { SlideHandle } from '../components/useHorizontalSwipe';
import { WeekStrip } from '../components/WeekStrip';
import {
  addMonths,
  addWeeks,
  countByDate,
  formatCardDay,
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

  // 주간 줄·달력이 내주는 손잡이. 바깥에서 보이는 주·달을 바꿀 때 미끄러지던 넘김을 버린다 (#202)
  const slideRef = useRef<SlideHandle>(null);
  // 날짜를 고를 때 지금 보이는 것과 비교한다. 콜백이 이 값들에 따라 바뀌지 않게(달력 격자를 다시 그리지 않게) 그린 뒤 적어 둔다
  const shown = useRef({ selected, viewMonth, weekStart, calendarOpen });
  useLayoutEffect(() => {
    shown.current = { selected, viewMonth, weekStart, calendarOpen };
  });

  // 고른 날의 주·달을 보여 준다
  const selectDate = useCallback(
    (date: Date) => {
      const now = shown.current;
      const month = monthOfDate(date);
      const week = startOfWeek(date).getTime();
      const sameMonth =
        month.year === now.viewMonth.year &&
        month.month === now.viewMonth.month;
      const sameWeek = week === now.weekStart;
      // 보이는 주·달을 바꾸면(다른 달 칸·오늘·자정) 미끄러지던 넘김을 버린다. 다 넘어간 뒤 확정하면 바꾼 주·달에서
      // 한 페이지 더 간다 (#202). 보이는 주·달 안의 날을 고르면 넘김은 이어 간다 (#100)
      if (now.calendarOpen ? !sameMonth : !sameWeek) {
        slideRef.current?.cancelSlide();
      }
      // 이미 그 날을 고르고 그 주·달을 보고 있으면 바뀌는 것이 없다 (다시 그리지 않는다)
      if (sameMonth && sameWeek && isSameDay(date, now.selected)) {
        return;
      }
      setSelected(date);
      setViewMonth(month);
      setWeekStart(week);
      onVisibleMonthsChange?.(visibleMonths(date, month));
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

  // 오늘 버튼: 주간 보기는 오늘이 있는 주, 달력은 이번 달로 돌아오고 오늘을 고른다 (#202).
  // 오늘의 주·달을 보고 있어도 다른 주·달로 미끄러지는 중이면 그 넘김은 버린다
  const goToday = useCallback(() => {
    slideRef.current?.cancelSlide();
    selectDate(today);
  }, [selectDate, today]);

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
  // 하위 탭은 같은 리스트를 data 만 바꿔 쓰므로(스크롤 위치 그대로) 탭을 누를 때 다시 보인다
  const autoHide = useAutoHideHeader(HEADER_ESTIMATE);
  const showHeader = autoHide.show;
  const selectTab = useCallback(
    (next: ScheduleTab) => {
      setTab(next);
      showHeader();
    },
    [showHeader],
  );
  // 내용은 겹쳐 그린 머리 아래에서 시작한다. 응답 필요 카드는 그 아래 24 에서 시작한다 (Figma 3754:6804)
  const confirmedContentStyle = useMemo(
    () => [
      readableColumn,
      styles.confirmedContent,
      { paddingTop: autoHide.height },
    ],
    [autoHide.height],
  );
  const pendingContentStyle = useMemo(
    () => [
      readableColumn,
      styles.pendingContent,
      { paddingTop: autoHide.height + PENDING_TOP },
    ],
    [autoHide.height],
  );

  // 주간 줄을 만지는 동안 리스트가 세로로 움직이지 않게 한다 (#99).
  // 펼친 달력은 처음 움직인 방향이 가로일 때만 막고, 세로면 리스트가 스크롤한다 (#144)
  const scrollLock = useTouchScrollLock();
  // 탭을 좌우로 미는 동안에도 세로로 스크롤하지 않는다 (#216)
  const tabSwipeLocked = useTabSwipeScrollLock();
  const weekTouch = scrollLock.areaTouchHandlers;
  const monthTouch = scrollLock.axisAreaTouchHandlers;

  const renderConfirmed = useCallback(
    ({ item }: { item: ConfirmedSchedule }) => (
      <ConfirmedRow
        item={item}
        dayLabel={formatCardDay(item.dateKey, today)}
        style={styles.cardInset}
      />
    ),
    [today],
  );
  // 수락(POST)은 낙관적으로 반영한다 (#197): 요청은 곧바로 응답 필요에서 빠지고, 실패하면 돌아온다.
  // 보내는 동안 카드 버튼 모양(Figma 기본)은 그대로 두고, 그 요청의 수락·거절만 다시 받지 않는다.
  // 비활성으로 바꾸면 거절이 Disabled 채움으로 까맣게 변한다. 결과가 오면(실패해 돌아온 요청) 다시 받는다
  const accepting = useRef(new Set<string>());
  const accept = useCallback(
    async (id: string) => {
      if (accepting.current.has(id)) {
        return;
      }
      accepting.current.add(id);
      try {
        // 햅틱은 결과다: 서버가 수락을 받았을 때만 울린다 (#32)
        if (await onAccept(id)) {
          haptic.success();
        }
      } finally {
        accepting.current.delete(id);
      }
    },
    [onAccept],
  );
  const reject = useCallback(
    (id: string) => {
      if (!accepting.current.has(id)) {
        onReject(id);
      }
    },
    [onReject],
  );
  const renderPending = useCallback(
    ({ item }: { item: PendingRequest }) => (
      <PendingRequestCard
        item={item}
        dayLabel={formatCardDay(item.dateKey, today)}
        onAccept={accept}
        onReject={reject}
        onOpen={onOpenRequest}
      />
    ),
    [accept, reject, onOpenRequest, today],
  );

  // 달력을 만져 리스트 스크롤을 막고 풀 때는 날짜 머리·달력을 다시 그리지 않는다 (손가락을 따라갈 JS 를 붙잡지 않게)
  const dateHeader = useMemo(
    () => (
      <View style={styles.dateArea}>
        <View style={styles.dateRow}>
          <Text variant="Body/M/SemiBold" style={styles.dateText}>
            {formatDateHeader(selected)}
          </Text>
          {/* Figma 51030:18440(주간)·51030:18444(달력): 오늘 알약, 그 오른쪽에 달력 전환 버튼 */}
          <View
            style={[styles.dateActions, calendarOpen && styles.dateActionsOpen]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="오늘"
              hitSlop={TODAY_HIT_SLOP}
              onPress={goToday}
              style={styles.todayButton}
            >
              <Text variant="Caption/M/SemiBold" color={colors.gray[900]}>
                오늘
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={calendarOpen ? '달력 접기' : '달력 펼치기'}
              hitSlop={ICON_HIT_SLOP}
              onPress={toggleCalendar}
            >
              {/* Figma Web Icon Calender/ Weekly · Monthly: 펼침은 모양이 좌우로 뒤집히고 색은 둘 다 Gray500 */}
              <Icon
                name={calendarOpen ? 'calendar-switch-open' : 'calendar-switch'}
                color={colors.gray[500]}
              />
            </Pressable>
          </View>
        </View>
        {/* Figma 3754:6269·3754:6457: 날짜 줄 아래 16 에 주간 줄 또는 달력 카드 */}
        {calendarOpen ? (
          <MonthCalendar
            year={viewMonth.year}
            month={viewMonth.month}
            selected={selected}
            eventCounts={eventCounts}
            edgeInset={styles.dateArea.paddingHorizontal}
            touchHandlers={monthTouch}
            ref={slideRef}
            onSelect={selectDate}
            onPrev={() => moveMonth(-1)}
            onNext={() => moveMonth(1)}
          />
        ) : (
          <WeekStrip
            days={week}
            selected={selected}
            edgeInset={styles.dateArea.paddingHorizontal}
            touchHandlers={weekTouch}
            ref={slideRef}
            onSelect={selectDate}
            onPrev={() => moveWeek(-1)}
            onNext={() => moveWeek(1)}
          />
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
      goToday,
      toggleCalendar,
      moveMonth,
      moveWeek,
      weekTouch,
      monthTouch,
    ],
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {/* 머리말은 리스트 위에 겹쳐 그린다 (화면 바탕과 같은 색, 그림자 없음 #201).
          탭 첫 화면 공통 상단 바 (#103). Figma 내 일정(3754:6269)에는 종이 없다 */}
      <AutoHideHeaderLayout
        autoHide={autoHide}
        header={<TabHeader title="내 일정" style={styles.titleBar} />}
        sticky={
          <View style={[readableColumn, styles.tabsBar]}>
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
              onChange={selectTab}
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
            scrollEnabled={!scrollLock.locked && !tabSwipeLocked}
            onTouchStartCapture={scrollLock.onListTouchStartCapture}
            data={daySchedules}
            keyExtractor={keyExtractor}
            renderItem={renderConfirmed}
            ListHeaderComponent={dateHeader}
            ItemSeparatorComponent={CardGap}
            ListEmptyComponent={
              confirmedLoad.status === 'ready' ? (
                <EmptyMessage style={styles.emptyConfirmed}>
                  이 날은 일정이 없습니다
                </EmptyMessage>
              ) : (
                <LoadStateView
                  state={confirmedLoad}
                  skeleton={<ConfirmedCardsSkeleton />}
                />
              )
            }
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressViewOffset={autoHide.progressViewOffset}
            style={styles.list}
            contentContainerStyle={confirmedContentStyle}
          />
        ) : (
          <Animated.FlatList
            ref={listRef}
            testID="schedule-pending-list"
            {...autoHide.scrollProps}
            scrollEnabled={!tabSwipeLocked}
            data={pending}
            keyExtractor={keyExtractor}
            renderItem={renderPending}
            ItemSeparatorComponent={CardGap}
            ListEmptyComponent={
              pendingLoad.status === 'ready' ? (
                <EmptyMessage style={styles.emptyPending}>
                  응답할 요청이 없습니다
                </EmptyMessage>
              ) : (
                <LoadStateView
                  state={pendingLoad}
                  skeleton={<PendingRequestsSkeleton />}
                />
              )
            }
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressViewOffset={autoHide.progressViewOffset}
            style={styles.list}
            contentContainerStyle={pendingContentStyle}
          />
        )}
      </AutoHideHeaderLayout>
    </SafeAreaView>
  );
}

const keyExtractor = (item: { id: string }) => item.id;

// Figma: 일정 카드 사이 12
function CardGap() {
  return <View testID="schedule-card-gap" style={styles.cardGap} />;
}

// 날짜 블록 아래 여백 (카드 목록까지 24). 일정이 없는 날의 안내 글은 이 아래에서 EMPTY_GAP 을 채운다
const DATE_AREA_PADDING_BOTTOM = 24;

// 제목 줄 아래 여백. 탭 위 여백(8)과 합쳐 제목과 탭 사이가 Figma 의 24 가 된다
const TITLE_BAR_PADDING_BOTTOM = 16;
// Figma 머리(3754:6458·3754:6940, 167)는 하위 탭 아래 끝(166)보다 1 길다. 내용은 그 아래 24 에서 시작해
// 하위 탭 아래 끝에서 내용까지 25 다 (탭 줄 아래 선을 뺀 뒤에도, #201)
const TABS_BAR_PADDING_BOTTOM = 1;
// 기본 글자 크기에서 숨는 제목 줄과 머리 전체(제목 줄 + 하위 탭 + 아래 1)의 높이. 그린 뒤 잰 높이로 고친다
const HEADER_ESTIMATE = {
  collapsible: TAB_HEADER_HEIGHT + TITLE_BAR_PADDING_BOTTOM,
  total:
    TAB_HEADER_HEIGHT +
    TITLE_BAR_PADDING_BOTTOM +
    UNDERLINE_TABS_HEIGHT +
    TABS_BAR_PADDING_BOTTOM,
};

// Figma: 날짜 블록·카드는 화면 가장자리에서 24 안쪽이고, 응답 필요 카드는 머리 아래 24 에서 시작한다
const LIST_INSET = 24;
const PENDING_TOP = 24;

// Figma 51030:18439·51030:18441 오늘 알약: 좌우 12·위아래 4 안에 Caption/M/Semibold 글자
const TODAY_PADDING_HORIZONTAL = 12;
const TODAY_PADDING_VERTICAL = 4;
// 알약(48×28)을 최소 터치 영역으로 넓힌다. 폭은 글자 폭과 관계없이 좌우 여백만으로도 채우도록 왼쪽(날짜 글자 쪽 빈자리)으로
// 넓힌다. 오른쪽은 넓히지 않아 달력 버튼(뒤 형제)이 왼쪽으로 넓힌 영역과 겹치지 않고 둘 사이 간격(주간 16·월간 12) 안에
// 머문다 (달력 버튼은 iOS 10·Android 12 를 넓혀 월간 iOS 2, 주간 iOS 6·Android 4 의 빈틈이 남는다).
// 위·아래는 날짜 블록 위 여백(24)과 주간 줄·달력과의 간격(16) 안에 든다
const TODAY_VERTICAL_SLOP = touchSlop(
  TODAY_PADDING_VERTICAL * 2 + smallestLineHeight('Caption/M/SemiBold'),
);
const TODAY_HIT_SLOP = {
  top: TODAY_VERTICAL_SLOP,
  bottom: TODAY_VERTICAL_SLOP,
  left: MIN_TOUCH_TARGET - TODAY_PADDING_HORIZONTAL * 2,
  right: 0,
};

const styles = StyleSheet.create({
  // Figma 내 일정(3754:6269·3754:6457·3754:6804) 바탕은 상태 표시줄 뒤까지 Background/3 이고, 그 위에 흰 카드가 놓인다.
  // 바탕은 화면에 그려 탭을 옮길 때 리스트(내용)만 옆에서 들어오고 회색 바탕은 제자리다 (#176)
  screen: { flex: 1, backgroundColor: colors.background[3] },
  // 겹쳐 그린 머리(위에 쌓기는 AutoHideHeaderLayout). Figma 탑 내비는 바탕색·그림자가 없다 (#201).
  // 내용이 아래로 지나가므로 화면 배경과 같은 색으로 가린다
  header: { backgroundColor: colors.background[3] },
  titleBar: { paddingBottom: TITLE_BAR_PADDING_BOTTOM },
  tabsBar: { paddingBottom: TABS_BAR_PADDING_BOTTOM },
  list: { flex: 1 },
  // 날짜 블록은 화면 폭을 차지하고(넓힌 터치 영역·가장자리 밀기 제외 영역이 그 안에 든다) 안쪽 여백으로 24 를 들인다
  confirmedContent: { paddingBottom: 24 },
  cardInset: { marginHorizontal: LIST_INSET },
  // 위 여백은 머리 높이에 따라 정한다 (pendingContentStyle)
  pendingContent: { paddingHorizontal: LIST_INSET, paddingBottom: 24 },
  // 머리말 아래 24 에 날짜 줄, 그 아래 16 에 주간 줄·달력, 카드 목록까지 24
  dateArea: {
    gap: 16,
    paddingTop: 24,
    paddingBottom: DATE_AREA_PADDING_BOTTOM,
    paddingHorizontal: LIST_INSET,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // 큰 글자·좁은 화면에서 날짜가 길면 오른쪽 버튼을 밀어내지 않고 날짜가 줄을 바꾼다
  dateText: { flexShrink: 1 },
  // 오늘 알약과 달력 전환 버튼 사이: 주간 16(51030:18440), 달력 12(51030:18444)
  dateActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  dateActionsOpen: { gap: 12 },
  todayButton: {
    paddingHorizontal: TODAY_PADDING_HORIZONTAL,
    paddingVertical: TODAY_PADDING_VERTICAL,
    borderRadius: 54,
    backgroundColor: colors.gray[100],
  },
  cardGap: { height: 12 },
  // Figma 51019:15863·51019:15902: 안내 글은 날짜 블록과 gap 60
  emptyConfirmed: { paddingTop: EMPTY_GAP - DATE_AREA_PADDING_BOTTOM },
  // 응답 필요는 Figma 에 빈 상태가 없어 같은 간격으로 머리(하위 탭) 아래 60 에 둔다 (기본안)
  emptyPending: { paddingTop: EMPTY_GAP - PENDING_TOP },
});

// 탭을 오가면 경로가 포커스 때문에 다시 그려진다. 받은 값이 같으면 화면은 다시 그리지 않는다 (#114 리뷰)
export const ScheduleScreen = memo(ScheduleScreenView);
