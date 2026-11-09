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
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  Icon,
  MIN_TOUCH_TARGET,
  Text,
  touchSlop,
} from '../../../shared/design-system';
import {
  LoadStateView,
  type LoadState,
} from '../../../shared/layout/LoadStateView';
import { AutoHideHeaderLayout } from '../../../shared/layout/AutoHideHeaderLayout';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { TabHeader } from '../../../shared/layout/TabHeader';
import { useAutoHideHeader } from '../../../shared/layout/useAutoHideHeader';
import { toDateKey } from '../../schedule/model';
import {
  CurrentWorkCard,
  NoCurrentWorkCard,
} from '../components/CurrentWorkCard';
import { ScheduleCard } from '../components/ScheduleCard';
import { WeekDays } from '../components/WeekDays';
import { WorkHomeSkeleton } from '../components/WorkSkeletons';
import { loadHomeView, saveHomeView, type ScheduleView } from '../homeView';
import { mondayWeek, type CurrentWork, type ScheduleItem } from '../model';

// Figma 작업 수행 › 메인화면 - 시작 가능 (작업 시작 / 작업 수행중, 블록 보기 3463:17452), 진행(무), 일정(무)
export type WorkHomeScreenProps = {
  currentWork: CurrentWork | null;
  /** 이번 주 일정 */
  schedule: readonly ScheduleItem[];
  /** 오늘. 블록 보기는 오늘이 속한 주(월~일)를 보여 주고 오늘을 먼저 고른다 */
  today: Date;
  weekLabel: string;
  /** 진행할 작업을 시작했는지 (작업중) */
  started: boolean;
  /** 진행할 작업을 시작한다. 보내는 동안(약속이 끝날 때까지) "작업 시작" 을 잠근다. 실패 안내는 부른 쪽이 한다 */
  onStartWork: () => void | Promise<void>;
  onOpenWork: (id: string) => void;
  /** 종(Figma 메인화면에 늘 있다)을 눌렀을 때. 알림센터를 연다 (#96) */
  onOpenNotifications: () => void;
  /** 바깥에서 리스트를 맨 위로 올릴 때 쓴다 */
  listRef?: Ref<FlatListInstance>;
  /** 진행할 작업·이번 주 일정을 불러오는 상태. 준비되지 않았으면 제목 아래에 로딩·오류만 보인다 */
  load?: LoadState;
  /** 당겨서 새로고침 */
  refreshing?: boolean;
  onRefresh?: () => void;
};

const READY: LoadState = { status: 'ready' };

function WorkHomeScreenView({
  currentWork,
  schedule,
  today,
  weekLabel,
  started,
  onStartWork,
  onOpenWork,
  onOpenNotifications,
  listRef,
  load = READY,
  refreshing = false,
  onRefresh,
}: WorkHomeScreenProps) {
  // 처음 설치면 블록 보기, 아니면 마지막으로 고른 보기로 연다 (#147). MMKV 는 동기라 첫 렌더에 바로 읽는다
  const [view, setView] = useState<ScheduleView>(loadHomeView);
  const changeView = (next: ScheduleView) => {
    if (next === view) {
      return;
    }
    setView(next);
    saveHomeView(next);
  };
  // 시작을 보내는 동안 "작업 시작" 을 잠근다. disabled 가 반영되기 전 같은 프레임의 두 번째 탭도 막는다
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const startWork = async () => {
    if (startingRef.current) {
      return;
    }
    startingRef.current = true;
    setStarting(true);
    try {
      await onStartWork();
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };
  const [selected, setSelected] = useState(today);
  // 켜 둔 채 날짜가 바뀌면 블록 보기에서 오늘을 고르고 있던 선택은 새 오늘로 옮긴다. 직접 고른 날은 그대로 둔다
  const lastToday = useRef(today);
  const followToday = useEffectEvent((next: Date) => {
    const previous = toDateKey(lastToday.current);
    lastToday.current = next;
    if (previous !== toDateKey(next) && toDateKey(selected) === previous) {
      setSelected(next);
    }
  });
  useEffect(() => {
    followToday(today);
  }, [today]);
  const week = useMemo(() => mondayWeek(today), [today]);
  const selectedKey = toDateKey(selected);
  const daySchedule = useMemo(
    () => schedule.filter(item => item.dateKey === selectedKey),
    [schedule, selectedKey],
  );
  const block = view === 'block';
  // 아래로 스크롤하면 상단 바가 숨고 위로 스크롤하면 다시 보인다 (#148)
  const autoHide = useAutoHideHeader();
  // 애니메이션 리스트는 배열·객체 props 가 바뀌면 스크롤 이벤트 연결을 다시 만든다. 높이가 바뀔 때만 새로 만든다
  const contentStyle = useMemo(
    () => [
      readableColumn,
      styles.content,
      { paddingTop: autoHide.height + CONTENT_TOP },
    ],
    [autoHide.height],
  );

  const renderItem = useCallback(
    ({ item }: { item: ScheduleItem }) => (
      <ScheduleCard item={item} onPress={onOpenWork} />
    ),
    [onOpenWork],
  );

  const header = (
    <View style={[styles.header, block && styles.headerBlock]}>
      {currentWork ? (
        <CurrentWorkCard
          work={currentWork}
          started={started}
          starting={starting}
          onStart={startWork}
          onOpen={() => onOpenWork(currentWork.id)}
        />
      ) : (
        <NoCurrentWorkCard />
      )}
      <View style={styles.schedule}>
        <View style={styles.sectionRow}>
          <View style={styles.sectionTitle}>
            <Text accessibilityRole="header" variant="Body/M/SemiBold">
              일정
            </Text>
            <Text variant="Caption/M/Medium" color={colors.gray[700]}>
              {weekLabel}
            </Text>
          </View>
          {/* 기본인 블록 보기를 왼쪽, 목록 보기를 오른쪽에 둔다 (#179 사용자 결정) */}
          <View style={styles.viewToggle}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="블록 보기"
              accessibilityState={{ selected: block }}
              hitSlop={BLOCK_HIT_SLOP}
              onPress={() => changeView('block')}
            >
              <Icon name={block ? 'grid-active' : 'grid'} size={TOGGLE_SIZE} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="목록 보기"
              accessibilityState={{ selected: !block }}
              hitSlop={LIST_HIT_SLOP}
              onPress={() => changeView('list')}
            >
              <Icon name={block ? 'list' : 'list-active'} size={TOGGLE_SIZE} />
            </Pressable>
          </View>
        </View>
        {block && (
          <WeekDays days={week} selected={selected} onSelect={setSelected} />
        )}
      </View>
    </View>
  );

  // 불러오는 동안에도 같은 머리에 상단 바를 둔다. 다 불러와 리스트로 바뀌어도 상단 바를 새로 그리지 않는다
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <AutoHideHeaderLayout
        autoHide={autoHide}
        header={
          <TabHeader
            title="내 작업"
            onOpenNotifications={onOpenNotifications}
          />
        }
        style={styles.headerBar}
      >
        {load.status !== 'ready' ? (
          // 상단 바가 숨은 채 이 화면으로 바뀌면 스크롤이 없어 다시 보일 길이 없다. 그려지면 다시 보인다
          <View
            onLayout={autoHide.show}
            style={{ paddingTop: autoHide.height }}
          >
            <LoadStateView
              state={load}
              skeleton={<WorkHomeSkeleton block={block} />}
            />
          </View>
        ) : (
          <Animated.FlatList
            ref={listRef}
            testID="work-home-list"
            {...autoHide.scrollProps}
            data={block ? daySchedule : schedule}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={header}
            ListEmptyComponent={block ? emptyDay : emptyWeek}
            ItemSeparatorComponent={Separator}
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressViewOffset={autoHide.progressViewOffset}
            contentContainerStyle={contentStyle}
          />
        )}
      </AutoHideHeaderLayout>
    </SafeAreaView>
  );
}

const keyExtractor = (item: ScheduleItem) => item.id;

function Separator() {
  return <View style={styles.separator} />;
}

// 일정(무): 아이콘은 Figma App Icon · Calendar · Active 를 회색으로 칠한 것.
// 블록 보기에서 고른 날에 일정이 없을 때도 같은 모양을 쓴다 (Figma 에 없어 문구는 기본안)
function EmptySchedule({
  title,
  style,
}: {
  title: string;
  style: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <Icon
        name="tab-calendar-active"
        size={40}
        color={colors.gray[300]}
        testID="empty-schedule-icon"
      />
      <View style={styles.emptyScheduleText}>
        <Text
          variant="Body/M/SemiBold"
          color={colors.primary}
          style={styles.centered}
        >
          {title}
        </Text>
        <Text
          variant="Caption/M/Medium"
          color={colors.gray[600]}
          style={styles.centered}
        >
          새 작업이 배정되면 여기에 표시돼요
        </Text>
      </View>
    </View>
  );
}

// 진행 중 작업 카드는 상단 바 아래 20 에서 시작한다 (Figma 3463:17452: 제목 줄 72–106, 카드 126)
const CONTENT_TOP = 20;
// Figma 에서 '일정' 줄과 첫 일정 카드 사이 (목록 보기)
const HEADER_PADDING_BOTTOM = 12;
// Figma 3463:17452 에서 날짜 줄(아래 끝 455)과 첫 일정 카드(469) 사이 (블록 보기)
const BLOCK_HEADER_PADDING_BOTTOM = 14;

// 보기 전환 아이콘 26 두 개가 4 간격으로 붙어 있다. 서로 쪽으로는 간격의 반만, 바깥쪽으로 나머지를 넓혀
// 겹치지 않고 최소 터치 영역을 채운다
const TOGGLE_SIZE = 26;
const TOGGLE_GAP = 4;
const TOGGLE_SLOP = touchSlop(TOGGLE_SIZE);
const TOGGLE_OUTER_SLOP = Math.max(
  0,
  MIN_TOUCH_TARGET - TOGGLE_SIZE - TOGGLE_GAP / 2,
);
// 블록 보기가 왼쪽, 목록 보기가 오른쪽이다 (#179)
const BLOCK_HIT_SLOP = {
  top: TOGGLE_SLOP,
  bottom: TOGGLE_SLOP,
  left: TOGGLE_OUTER_SLOP,
  right: TOGGLE_GAP / 2,
};
const LIST_HIT_SLOP = {
  top: TOGGLE_SLOP,
  bottom: TOGGLE_SLOP,
  left: TOGGLE_GAP / 2,
  right: TOGGLE_OUTER_SLOP,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background[3] },
  // 상단 바는 리스트 위에 겹쳐 그려 내용이 그 아래로 지나간다. 화면 배경으로 가린다 (#148)
  headerBar: { backgroundColor: colors.background[3] },
  // 내용 위 여백은 상단 바 높이 + CONTENT_TOP 이다.
  // 화면은 탭 바 위에서 끝나므로 마지막 카드 아래는 다른 화면처럼 24 만 둔다 (기본안).
  // Figma 메인화면의 하단 흐림 레이어(3463:17535)는 넣지 않는다: 흐림은 작업 상세 버튼 뒤에만 둔다 (#95, 사용자 결정)
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  header: { gap: 20, paddingBottom: HEADER_PADDING_BOTTOM },
  headerBlock: { paddingBottom: BLOCK_HEADER_PADDING_BOTTOM },
  // 일정 줄 아래 12 에 날짜 줄이 온다 (Figma 3463:17452: 일정 줄 346–374, 날짜 줄 386)
  schedule: { gap: 12, marginTop: 4 },
  // 일정 줄(Figma 2428:13005 Frame 2147238739 · 3463:17526)은 x 0, 폭 345 로 카드와 같은 폭이다 (#180)
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // 큰 글자에서는 줄어들고 줄바꿈되어 보기 버튼이 화면 밖으로 밀리지 않는다
  sectionTitle: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexShrink: 1,
    alignItems: 'center',
    gap: 8,
  },
  viewToggle: { flexDirection: 'row', gap: TOGGLE_GAP },
  separator: { height: 12 },
  // Figma 메인화면 - 일정(무) 3278:23276 에서 '일정' 줄 아래 끝(246)과 빈 상태 묶음(354) 사이 108 (#180)
  emptyWeek: {
    alignItems: 'center',
    gap: 24,
    paddingTop: 108 - HEADER_PADDING_BOTTOM,
  },
  // Figma 에 없어 날짜 줄 아래 40 에 둔다 (기본안)
  emptyDay: {
    alignItems: 'center',
    gap: 24,
    paddingTop: 40 - BLOCK_HEADER_PADDING_BOTTOM,
  },
  // 문구 줄바꿈 폭도 Figma 의 304
  emptyScheduleText: { alignItems: 'center', gap: 12, maxWidth: 304 },
  centered: { textAlign: 'center' },
});

const emptyWeek = (
  <EmptySchedule title="이번 주 일정이 없어요" style={styles.emptyWeek} />
);
const emptyDay = (
  <EmptySchedule title="이 날은 일정이 없어요" style={styles.emptyDay} />
);

// 탭을 오가면 경로가 포커스 때문에 다시 그려진다. 받은 값이 같으면 화면은 다시 그리지 않는다 (#114 리뷰)
export const WorkHomeScreen = memo(WorkHomeScreenView);
