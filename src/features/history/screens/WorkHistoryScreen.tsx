import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
  type FlatListInstance,
  type FlatListProps,
  type ViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReduceMotion } from '../../../shared/accessibility/useReduceMotion';
import { colors } from '../../../shared/design-system';
import {
  ENTER_MS,
  ENTER_OFFSET,
  enterEasing,
} from '../../../shared/gesture/enterTransition';
import {
  measureElement,
  useTabSwipeRegion,
  TabSwipeScrollLock,
} from '../../../shared/gesture/TabSwipeArea';
import { useSwipeSwitch } from '../../../shared/gesture/useSwipeSwitch';
import { EMPTY_GAP, EmptyMessage } from '../../../shared/layout/EmptyMessage';
import {
  LoadStateView,
  type LoadState,
} from '../../../shared/layout/LoadStateView';
import { readableColumn } from '../../../shared/layout/readableColumn';
import {
  addMonths,
  formatCardDay,
  formatMonthTitle,
} from '../../schedule/model';
import { WorkRowsSkeleton } from '../../work/components/WorkSkeletons';
import { CompletedWorkRow } from '../components/CompletedWorkRow';
import { HistoryHeaderBar } from '../components/HistoryHeaderBar';
import { MonthPickerOverlay } from '../components/MonthPickerOverlay';
import { SummaryCard } from '../components/SummaryCard';
import { visibleBar } from '../headerCollapse';
import { monthStep, rowsArea } from '../monthSwipe';
import { useHeaderCollapse } from '../useHeaderCollapse';
import { useMonthPicker } from '../useMonthPicker';
import {
  completedInMonth,
  isBeforeMonth,
  monthOf,
  type CompletedWork,
  type YearMonth,
} from '../model';

// Figma 작업이력 (기본)·(스크롤). 고른 달에 완료한 작업을 최근 순으로 보여준다
export type WorkHistoryScreenProps = {
  /** 처음 보여줄 달이자 ▶ 로 갈 수 있는 마지막 달 (미래 달에는 완료 작업이 없다) */
  today: Date;
  /** 완료한 작업. 고른 달의 작업만 있어도 된다 (고른 달로 거른다) */
  works: readonly CompletedWork[];
  /** 누적 완료 건수. 주지 않으면 works 의 개수, null 이면 모른다(받는 동안은 스켈레톤, 그 밖에는 '-') */
  totalCompleted?: number | null;
  onOpenWork: (id: string) => void;
  /** 바깥에서 리스트를 맨 위로 올릴 때 쓴다 */
  listRef?: Ref<FlatListInstance>;
  /** 고른 달의 이력을 불러오는 상태. 준비되지 않았으면 목록 자리에 로딩·오류를 보인다 */
  load?: LoadState;
  /** 고른 달이 바뀌면 알린다. 바깥에서 그 달의 이력을 불러온다 */
  onMonthChange?: (month: YearMonth) => void;
  /** 당겨서 새로고침 */
  refreshing?: boolean;
  onRefresh?: () => void;
};

const READY: LoadState = { status: 'ready' };

// 달을 옮길 때 목록(행·빈 상태·불러오기)이 들어오는 거리 (#153). 상단 바(월 선택)·머리(요약 카드)는 옮기지 않는다
const MonthShiftContext = createContext<Animated.Value | null>(null);

function useMonthShiftStyle() {
  const shift = useContext(MonthShiftContext);
  return useMemo(
    () => (shift ? { transform: [{ translateX: shift }] } : null),
    [shift],
  );
}

type CellProps = ComponentProps<
  NonNullable<FlatListProps<CompletedWork>['CellRendererComponent']>
>;

// 목록 칸. 기본 칸(View)과 같은 props 를 받아 달을 옮길 때만 옮긴다
function MonthShiftCell({
  style,
  onLayout,
  onFocusCapture,
  children,
}: CellProps) {
  const shiftStyle = useMonthShiftStyle();
  return (
    <Animated.View
      style={[style, shiftStyle]}
      onLayout={onLayout}
      onFocusCapture={onFocusCapture}
    >
      {children}
    </Animated.View>
  );
}

function MonthShiftEmpty({ children }: { children: ReactNode }) {
  const shiftStyle = useMonthShiftStyle();
  return <Animated.View style={shiftStyle}>{children}</Animated.View>;
}

function WorkHistoryScreenView({
  today,
  works,
  totalCompleted = works.length,
  onOpenWork,
  listRef,
  load = READY,
  onMonthChange,
  refreshing = false,
  onRefresh,
}: WorkHistoryScreenProps) {
  const [viewMonth, setViewMonth] = useState<YearMonth>(() => monthOf(today));
  const monthWorks = useMemo(
    () => completedInMonth(works, viewMonth),
    [works, viewMonth],
  );

  // 스크린리더 포커스는 누른 화살표에 남아 바뀐 제목을 읽지 않으므로, 바뀐 달과 건수를 알려 준다.
  // 그 달을 서버에서 불러오는 동안에는 건수를 모르므로 다 불러온 뒤에 알린다 (오류면 오류 문구가 읽힌다)
  const announceMonth = useRef(false);

  // 켜 둔 채 날짜가 바뀌어 달이 넘어가면 이번 달을 보던 화면은 새 달로 옮긴다. 직접 고른 달은 그대로 둔다
  const lastToday = useRef(today);
  const followToday = useEffectEvent((next: Date) => {
    const previous = monthOf(lastToday.current);
    lastToday.current = next;
    const month = monthOf(next);
    const same = (a: YearMonth, b: YearMonth) =>
      a.year === b.year && a.month === b.month;
    if (!same(previous, month) && same(viewMonth, previous)) {
      setViewMonth(month);
      onMonthChange?.(month);
    }
  });
  useEffect(() => {
    followToday(today);
  }, [today]);
  // 달을 옮기면 다음 달은 오른쪽(+x)에서, 이전 달은 왼쪽(-x)에서 찰나에 들어온다 (탭 전환과 같은 결, 투명도는 그대로).
  // 달마다 새 값을 만들어 새 목록이 첫 프레임부터 그 자리에서 그려지고, 네이티브 드라이버로 0 까지 간다. 동작 줄이기면 옮기지 않는다
  const reduceMotion = useReduceMotion();
  const [monthShift, setMonthShift] = useState<Animated.Value | null>(null);
  useEffect(() => {
    if (monthShift === null) {
      return;
    }
    const enter = Animated.timing(monthShift, {
      toValue: 0,
      duration: ENTER_MS,
      easing: enterEasing,
      useNativeDriver: true,
    });
    enter.start();
    return () => enter.stop();
  }, [monthShift]);
  // 달을 옮긴다 (화살표·밀기·날짜 선택). 뒤 달이면 오른쪽에서, 앞 달이면 왼쪽에서 목록이 들어온다
  const goToMonth = (next: YearMonth) => {
    if (next.year === viewMonth.year && next.month === viewMonth.month) {
      return;
    }
    const direction = isBeforeMonth(viewMonth, next) ? 1 : -1;
    setViewMonth(next);
    setMonthShift(
      reduceMotion.current
        ? null
        : // 처음부터 네이티브 값으로 만든다. 시작할 때 네이티브로 바뀌며 목록 칸을 한 번 더 그리지 않게 한다
          new Animated.Value(direction * ENTER_OFFSET, {
            useNativeDriver: true,
          }),
    );
    onMonthChange?.(next);
    announceMonth.current = true;
  };
  const moveMonth = (delta: number) =>
    goToMonth(addMonths(viewMonth.year, viewMonth.month, delta));
  const canGoNext = isBeforeMonth(viewMonth, monthOf(today));

  // 월 글자를 누르면 날짜 선택 상자가 열린다 (#203). 휠에서 고른 달은 닫을 때 적용한다.
  // 열린 동안(닫는 중 포함)은 목록 스크롤·상단 바 접힘을 멈추고, 겹친 상자 층이 탭 밀기·월 밀기 터치를 받는다
  const picker = useMonthPicker({ today, viewMonth, onApply: goToMonth });
  const pickerVisible = picker.phase !== 'closed';
  const pickerOpen = picker.phase === 'open';
  const headerMonth = pickerVisible ? picker.month : viewMonth;
  const togglePicker = pickerOpen ? picker.close : picker.open;

  // 스크롤하면 상단 바가 접히고(제목이 사라지고 월 선택이 바에 흡수됨), 맨 위로 돌아오면 펼친다 (#175)
  const collapse = useHeaderCollapse();
  const holdCollapse = collapse.hold;
  useLayoutEffect(() => {
    holdCollapse(pickerVisible);
  }, [holdCollapse, pickerVisible]);

  // 목록 영역을 좌우로 밀어 달을 옮긴다 (#153). 탭 전환과 같은 판정(useSwipeSwitch)·영역 규칙을 쓴다:
  // 목록 영역(리스트에서 보이는 상단 바·머리를 뺀 아래쪽, monthSwipe.ts rowsArea) 안쪽 깊은 곳에서 시작한 밀기만 달을 옮기고, 그 가장자리 여유·화면 가장자리 띠·
  // 머리·상단 바에서 시작한 밀기는 탭 전환에 맡긴다. 세로 우세면 리스트가 스크롤한다.
  // 상단 바는 펼친 크기 그대로 두고 그리는 것만 줄이므로, 접힌 동안은 접힌 바 자리만 뺀다 (#175)
  const barRef = useRef<ViewInstance>(null);
  const headerRef = useRef<ViewInstance>(null);
  const listRegion = useTabSwipeRegion({
    measure: target =>
      rowsArea(measureElement(target), [
        visibleBar(measureElement(barRef.current), collapse.isCollapsed()),
        measureElement(headerRef.current),
      ]),
  });
  const monthSwipe = useSwipeSwitch({
    canSwipe: listRegion.ownsGesture,
    onSwipe: direction => {
      const step = monthStep(direction, canGoNext);
      if (step !== null) {
        moveMonth(step);
      }
    },
  });
  useEffect(() => {
    if (!announceMonth.current || load.status !== 'ready') {
      return;
    }
    announceMonth.current = false;
    AccessibilityInfo.announceForAccessibility(
      `${formatMonthTitle(viewMonth.year, viewMonth.month)}, 완료 ${
        monthWorks.length
      }건`,
    );
  }, [load.status, viewMonth, monthWorks.length]);

  // 시간 줄의 날짜는 오늘이면 '오늘 · 9. 19. (토)' 다 (내 일정·홈 일정 카드와 같은 표기)
  const renderItem = useCallback(
    ({ item }: { item: CompletedWork }) => (
      <CompletedWorkRow
        item={item}
        dayLabel={formatCardDay(item.dateKey, today)}
        onPress={onOpenWork}
      />
    ),
    [onOpenWork, today],
  );

  // 리스트 내용은 펼친 상단 바 아래에서 시작한다. 접힌 바는 더 짧아 그보다 더 가리지 않는다 (#175)
  const contentStyle = useMemo(
    () => [readableColumn, styles.content, { paddingTop: collapse.height }],
    [collapse.height],
  );

  const loading = load.status === 'loading';
  const header = (
    <View
      ref={headerRef}
      testID="work-history-list-header"
      style={styles.header}
    >
      {/* Figma 51083:18504: 이번 달 완료가 왼쪽, 누적 완료가 오른쪽, 둘 다 흰 카드 (#220). '이번 달 완료' 는 고른 달 기준이다 (기본안) */}
      <View style={styles.summary}>
        <SummaryCard
          label="이번 달 완료"
          count={load.status === 'ready' ? monthWorks.length : null}
          loading={loading}
        />
        <SummaryCard
          label="누적 완료"
          count={totalCompleted}
          loading={loading && totalCompleted === null}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView
      edges={['top']}
      testID="work-history-screen"
      style={styles.screen}
    >
      <View style={styles.body}>
        {/* 리스트 위에 겹쳐 그리는 상단 바 (#175). Figma 작업이력에는 종이 없다 */}
        <HistoryHeaderBar
          ref={barRef}
          collapse={collapse}
          monthTitle={formatMonthTitle(headerMonth.year, headerMonth.month)}
          canGoNext={canGoNext}
          onPrev={() => moveMonth(-1)}
          onNext={() => moveMonth(1)}
          picker={{
            progress: picker.progress,
            open: pickerOpen,
            visible: pickerVisible,
            onPressMonth: togglePicker,
          }}
        />
        {/* 상자가 열린 동안 목록은 스크린리더에서 빠진다 (상자 층이 덮는다) */}
        <View
          style={styles.list}
          onTouchStartCapture={monthSwipe.onTouchStartCapture}
          onTouchStart={listRegion.onTouchStart}
          accessibilityElementsHidden={pickerOpen}
          importantForAccessibility={
            pickerOpen ? 'no-hide-descendants' : 'auto'
          }
          {...monthSwipe.panHandlers}
        >
          <MonthShiftContext.Provider value={monthShift}>
            <TabSwipeScrollLock enabled={!pickerVisible}>
              {scrollEnabled => (
                <Animated.FlatList
                  ref={listRef}
                  testID="work-history-list"
                  {...collapse.scrollProps}
                  scrollEnabled={scrollEnabled}
                  data={monthWorks}
                  keyExtractor={keyExtractor}
                  renderItem={renderItem}
                  ItemSeparatorComponent={CardGap}
                  CellRendererComponent={MonthShiftCell}
                  ListHeaderComponent={header}
                  ListEmptyComponent={
                    <MonthShiftEmpty>
                      {load.status === 'ready' ? (
                        <EmptyMonth />
                      ) : (
                        <LoadStateView state={load} skeleton={rowsSkeleton} />
                      )}
                    </MonthShiftEmpty>
                  }
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  progressViewOffset={collapse.progressViewOffset}
                  style={styles.list}
                  contentContainerStyle={contentStyle}
                />
              )}
            </TabSwipeScrollLock>
          </MonthShiftContext.Provider>
        </View>
        {pickerVisible ? (
          <MonthPickerOverlay
            progress={picker.progress}
            open={pickerOpen}
            today={today}
            month={picker.month}
            monthRow={collapse.monthRow}
            onSelect={picker.select}
            onClose={picker.close}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const keyExtractor = (item: CompletedWork) => item.id;

// 완료 작업 카드 사이 12 (Figma 3753:4910)
function CardGap() {
  return <View testID="completed-work-gap" style={styles.cardGap} />;
}

const rowsSkeleton = <WorkRowsSkeleton />;

// 요약 카드 아래 여백. 완료 작업 카드는 여기서 시작하고(Figma 3753:4896), 빈 상태 안내 글은 이 아래에서 EMPTY_GAP 을 채운다
const HEADER_PADDING_BOTTOM = 24;

// Figma 작업이력 (기본) 51019:16207: 아이콘·설명 없이 글 한 줄 (#196)
function EmptyMonth() {
  return (
    <EmptyMessage style={styles.empty}>
      이 달에 완료한 작업이 없습니다
    </EmptyMessage>
  );
}

const styles = StyleSheet.create({
  // Figma 작업이력 (기본) 3753:4890: 회색 바탕(Background/3) 위에 흰 요약 카드·완료 작업 카드 (#181)
  screen: { flex: 1, backgroundColor: colors.background[3] },
  // 마지막 카드 아래 24 + 바닥(Frame 40) 12
  content: { paddingBottom: 36 },
  cardGap: { height: 12 },
  // 상단 바를 겹쳐 그리는 자리 (안전 영역 안). 접힌 바 배경은 이 위 상태 표시줄 자리까지 덮는다
  body: { flex: 1 },
  list: { flex: 1 },
  // 요약 카드. 위 여백(월 선택과의 사이 24)은 상단 바가 갖는다
  // Figma 3753:4896: 요약 카드 아래 24 에 완료 작업 카드 (구분선 없음)
  header: { paddingBottom: HEADER_PADDING_BOTTOM },
  summary: { flexDirection: 'row', gap: 10, paddingHorizontal: 24 },
  // Figma 51019:16288: 요약 카드 묶음과 안내 글 사이 gap 60. 글 상자는 요약 카드와 같은 좌우 24 안 (#196)
  empty: {
    paddingTop: EMPTY_GAP - HEADER_PADDING_BOTTOM,
    paddingHorizontal: 24,
  },
});

// 탭을 오가면 경로가 포커스 때문에 다시 그려진다. 받은 값이 같으면 화면은 다시 그리지 않는다 (#114 리뷰)
export const WorkHistoryScreen = memo(WorkHistoryScreenView);
