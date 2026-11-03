import { useCallback, useMemo, useState, type Ref } from 'react';
import {
  FlatList,
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
import { readableColumn } from '../../../shared/layout/readableColumn';
import { TabHeader } from '../../../shared/layout/TabHeader';
import { toDateKey } from '../../schedule/model';
import {
  CurrentWorkCard,
  NoCurrentWorkCard,
} from '../components/CurrentWorkCard';
import { ScheduleCard } from '../components/ScheduleCard';
import { WeekDays } from '../components/WeekDays';
import { mondayWeek, type CurrentWork, type ScheduleItem } from '../model';

// Figma 작업 수행 › 메인화면 - 시작 가능 (작업 시작 / 작업 수행중, 블록 보기 3463:17452), 진행(무), 일정(무)
export type WorkHomeScreenProps = {
  currentWork: CurrentWork | null;
  /** 이번 주 일정 */
  schedule: readonly ScheduleItem[];
  /** 오늘. 블록 보기는 오늘이 속한 주(월~일)를 보여 주고 오늘을 먼저 고른다 */
  today: Date;
  weekLabel: string;
  /** 진행할 작업을 시작했는지. 화면을 오가도 유지되도록 바깥에서 들고 있는다 */
  started: boolean;
  onStartWork: () => void;
  onOpenWork: (id: string) => void;
  /** 종(Figma 메인화면에 늘 있다)을 눌렀을 때. 알림센터를 연다 (#96) */
  onOpenNotifications: () => void;
  /** 바깥에서 리스트를 맨 위로 올릴 때 쓴다 */
  listRef?: Ref<FlatListInstance>;
};

/** 일정 보기: 이번 주 목록 / 날짜 칸으로 고른 날 (블록) */
type ScheduleView = 'list' | 'block';

export function WorkHomeScreen({
  currentWork,
  schedule,
  today,
  weekLabel,
  started,
  onStartWork,
  onOpenWork,
  onOpenNotifications,
  listRef,
}: WorkHomeScreenProps) {
  const [view, setView] = useState<ScheduleView>('list');
  const [selected, setSelected] = useState(today);
  const week = useMemo(() => mondayWeek(today), [today]);
  const selectedKey = toDateKey(selected);
  const daySchedule = useMemo(
    () => schedule.filter(item => item.dateKey === selectedKey),
    [schedule, selectedKey],
  );
  const block = view === 'block';

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
          onStart={onStartWork}
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
          <View style={styles.viewToggle}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="목록 보기"
              accessibilityState={{ selected: !block }}
              hitSlop={LIST_HIT_SLOP}
              onPress={() => setView('list')}
            >
              <Icon name={block ? 'list' : 'list-active'} size={TOGGLE_SIZE} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="블록 보기"
              accessibilityState={{ selected: block }}
              hitSlop={BLOCK_HIT_SLOP}
              onPress={() => setView('block')}
            >
              <Icon name={block ? 'grid-active' : 'grid'} size={TOGGLE_SIZE} />
            </Pressable>
          </View>
        </View>
        {block && (
          <WeekDays days={week} selected={selected} onSelect={setSelected} />
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <TabHeader title="내 작업" onOpenNotifications={onOpenNotifications} />
      <FlatList
        ref={listRef}
        data={block ? daySchedule : schedule}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={block ? emptyDay : emptyWeek}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={[readableColumn, styles.content]}
      />
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
const LIST_HIT_SLOP = {
  top: TOGGLE_SLOP,
  bottom: TOGGLE_SLOP,
  left: TOGGLE_OUTER_SLOP,
  right: TOGGLE_GAP / 2,
};
const BLOCK_HIT_SLOP = {
  top: TOGGLE_SLOP,
  bottom: TOGGLE_SLOP,
  left: TOGGLE_GAP / 2,
  right: TOGGLE_OUTER_SLOP,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background[3] },
  // 진행 중 작업 카드는 상단 바 아래 20 에서 시작한다 (Figma 3463:17452: 제목 줄 72–106, 카드 126).
  // 화면은 탭 바 위에서 끝나므로 마지막 카드 아래는 다른 화면처럼 24 만 둔다 (기본안).
  // Figma 메인화면의 하단 흐림 레이어(3463:17535)는 넣지 않는다: 흐림은 작업 상세 버튼 뒤에만 둔다 (#95, 사용자 결정)
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  header: { gap: 20, paddingBottom: HEADER_PADDING_BOTTOM },
  headerBlock: { paddingBottom: BLOCK_HEADER_PADDING_BOTTOM },
  // 일정 줄 아래 12 에 날짜 줄이 온다 (Figma 3463:17452: 일정 줄 346–374, 날짜 줄 386)
  schedule: { gap: 12, marginTop: 4 },
  // 일정 줄(Figma 3463:17526)은 폭 339 로 카드(345)보다 6 좁고 오른쪽 끝은 카드와 같다
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 6,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewToggle: { flexDirection: 'row', gap: TOGGLE_GAP },
  separator: { height: 12 },
  // Figma 에서 '일정' 줄 아래 118pt
  emptyWeek: {
    alignItems: 'center',
    gap: 24,
    paddingTop: 118 - HEADER_PADDING_BOTTOM,
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
