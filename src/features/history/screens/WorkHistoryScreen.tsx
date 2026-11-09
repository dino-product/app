import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
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
import { colors, Icon, Text } from '../../../shared/design-system';
import { AutoHideHeaderLayout } from '../../../shared/layout/AutoHideHeaderLayout';
import {
  ENTER_MS,
  ENTER_OFFSET,
  enterEasing,
} from '../../../shared/gesture/enterTransition';
import {
  measureElement,
  useTabSwipeRegion,
} from '../../../shared/gesture/TabSwipeArea';
import { useSwipeSwitch } from '../../../shared/gesture/useSwipeSwitch';
import {
  LoadStateView,
  type LoadState,
} from '../../../shared/layout/LoadStateView';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { TabHeader } from '../../../shared/layout/TabHeader';
import { useAutoHideHeader } from '../../../shared/layout/useAutoHideHeader';
import { addMonths, formatMonthTitle } from '../../schedule/model';
import { WorkRowsSkeleton } from '../../work/components/WorkSkeletons';
import { CompletedWorkRow } from '../components/CompletedWorkRow';
import { MonthSwitcher } from '../components/MonthSwitcher';
import { SummaryCard } from '../components/SummaryCard';
import { monthStep, rowsArea } from '../monthSwipe';
import {
  completedInMonth,
  isBeforeMonth,
  monthOf,
  type CompletedWork,
  type YearMonth,
} from '../model';

// Figma 작업이력 (기본). 고른 달에 완료한 작업을 최근 순으로 보여준다
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

// 달을 옮길 때 목록(행·빈 상태·불러오기)이 들어오는 거리 (#153). 머리(월 선택·요약 카드)는 옮기지 않는다
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
  const moveMonth = (delta: number) => {
    const next = addMonths(viewMonth.year, viewMonth.month, delta);
    setViewMonth(next);
    setMonthShift(
      reduceMotion.current
        ? null
        : // 처음부터 네이티브 값으로 만든다. 시작할 때 네이티브로 바뀌며 목록 칸을 한 번 더 그리지 않게 한다
          new Animated.Value(delta * ENTER_OFFSET, { useNativeDriver: true }),
    );
    onMonthChange?.(next);
    announceMonth.current = true;
  };
  const canGoNext = isBeforeMonth(viewMonth, monthOf(today));

  // 목록 영역을 좌우로 밀어 달을 옮긴다 (#153). 탭 전환과 같은 판정(useSwipeSwitch)·영역 규칙을 쓴다:
  // 목록 영역(리스트에서 보이는 상단 바·머리를 뺀 아래쪽, monthSwipe.ts rowsArea) 안쪽 깊은 곳에서 시작한 밀기만 달을 옮기고, 그 가장자리 여유·화면 가장자리 띠·
  // 머리·상단 바에서 시작한 밀기는 탭 전환에 맡긴다. 세로 우세면 리스트가 스크롤한다
  const barRef = useRef<ViewInstance>(null);
  const headerRef = useRef<ViewInstance>(null);
  const listRegion = useTabSwipeRegion({
    measure: target =>
      rowsArea(measureElement(target), [
        measureElement(barRef.current),
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

  const renderItem = useCallback(
    ({ item }: { item: CompletedWork }) => (
      <CompletedWorkRow item={item} onPress={onOpenWork} />
    ),
    [onOpenWork],
  );

  // 아래로 스크롤하면 상단 바가 숨고 위로 스크롤하면 다시 보인다 (#148)
  const autoHide = useAutoHideHeader();
  const contentStyle = useMemo(
    () => [readableColumn, { paddingTop: autoHide.height }],
    [autoHide.height],
  );

  const loading = load.status === 'loading';
  // 화살표가 위아래로 넓힌 터치 영역이 리스트 밖으로 나가지 않도록 월 선택도 리스트 머리에 둔다
  const header = (
    <View
      ref={headerRef}
      testID="work-history-list-header"
      style={styles.header}
    >
      <MonthSwitcher
        title={formatMonthTitle(viewMonth.year, viewMonth.month)}
        canGoNext={canGoNext}
        onPrev={() => moveMonth(-1)}
        onNext={() => moveMonth(1)}
      />
      {/* Figma 3753:4903: 이번 달 완료(Primary 강조)가 왼쪽, 누적 완료가 오른쪽 (#145). '이번 달 완료' 는 고른 달 기준이다 (기본안) */}
      <View style={styles.summary}>
        <SummaryCard
          label="이번 달 완료"
          count={load.status === 'ready' ? monthWorks.length : null}
          emphasis
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
    <SafeAreaView edges={['top']} style={styles.screen}>
      {/* 탭 첫 화면 공통 상단 바 (#103). Figma 작업이력 (기본) 2751:6982 에는 종이 없다 */}
      <AutoHideHeaderLayout
        autoHide={autoHide}
        header={
          // 겹쳐 그린 상단 바의 자리를 재려고 감싼다. 빈 곳 터치는 그대로 아래 리스트로 통과한다
          <View ref={barRef} testID="work-history-bar" style={styles.bar}>
            <TabHeader title="작업 이력" />
          </View>
        }
        style={styles.headerBar}
      >
        <View
          style={styles.list}
          onTouchStartCapture={monthSwipe.onTouchStartCapture}
          onTouchStart={listRegion.onTouchStart}
          {...monthSwipe.panHandlers}
        >
          <MonthShiftContext.Provider value={monthShift}>
            <Animated.FlatList
              ref={listRef}
              testID="work-history-list"
              {...autoHide.scrollProps}
              data={monthWorks}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
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
              progressViewOffset={autoHide.progressViewOffset}
              style={styles.list}
              contentContainerStyle={contentStyle}
            />
          </MonthShiftContext.Provider>
        </View>
      </AutoHideHeaderLayout>
    </SafeAreaView>
  );
}

const keyExtractor = (item: CompletedWork) => item.id;

const rowsSkeleton = <WorkRowsSkeleton />;

// Figma 에 없어 메인화면 일정(무)과 같은 모양으로 둔다 (기본안). 아이콘은 화살표 없는 채운 시계를 회색으로 칠한 것 (탭 아이콘과는 따로 둔다)
function EmptyMonth() {
  return (
    <View style={styles.empty}>
      <Icon
        name="history-empty"
        size={40}
        color={colors.gray[300]}
        testID="history-empty-icon"
      />
      <View style={styles.emptyText}>
        <Text
          variant="Body/M/SemiBold"
          color={colors.primary}
          style={styles.centered}
        >
          이 달에 완료한 작업이 없어요
        </Text>
        <Text
          variant="Caption/M/Medium"
          color={colors.gray[600]}
          style={styles.centered}
        >
          작업을 완료하면 여기에 표시돼요
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  // 상단 바는 리스트 위에 겹쳐 그려 내용이 그 아래로 지나간다. 화면 배경으로 가린다 (#148)
  headerBar: { backgroundColor: colors.white[100] },
  list: { flex: 1 },
  bar: { pointerEvents: 'box-none' },
  header: {
    gap: 24,
    paddingTop: 14,
    paddingBottom: 24,
    borderBottomWidth: 12,
    borderBottomColor: colors.background[3],
  },
  summary: { flexDirection: 'row', gap: 10, paddingHorizontal: 24 },
  empty: { alignItems: 'center', gap: 24, paddingVertical: 80 },
  emptyText: { alignItems: 'center', gap: 12, maxWidth: 304 },
  centered: { textAlign: 'center' },
});

// 탭을 오가면 경로가 포커스 때문에 다시 그려진다. 받은 값이 같으면 화면은 다시 그리지 않는다 (#114 리뷰)
export const WorkHistoryScreen = memo(WorkHistoryScreenView);
