import { useCallback, type Ref } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  type FlatListInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Icon, Text, withOpacity } from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { TabHeader } from '../../../shared/layout/TabHeader';
import {
  CurrentWorkCard,
  NoCurrentWorkCard,
} from '../components/CurrentWorkCard';
import { ScheduleCard } from '../components/ScheduleCard';
import type { CurrentWork, ScheduleItem } from '../model';

// Figma 작업 수행 › 메인화면 - 시작 가능 (작업 시작 / 작업 수행중), 진행(무), 일정(무)
export type WorkHomeScreenProps = {
  currentWork: CurrentWork | null;
  schedule: readonly ScheduleItem[];
  weekLabel: string;
  /** 진행할 작업을 시작했는지. 화면을 오가도 유지되도록 바깥에서 들고 있는다 */
  started: boolean;
  onStartWork: () => void;
  onOpenWork: (id: string) => void;
  onOpenNotifications?: () => void;
  /** 바깥에서 리스트를 맨 위로 올릴 때 쓴다 */
  listRef?: Ref<FlatListInstance>;
};

export function WorkHomeScreen({
  currentWork,
  schedule,
  weekLabel,
  started,
  onStartWork,
  onOpenWork,
  onOpenNotifications,
  listRef,
}: WorkHomeScreenProps) {
  const renderItem = useCallback(
    ({ item }: { item: ScheduleItem }) => (
      <ScheduleCard item={item} onPress={onOpenWork} />
    ),
    [onOpenWork],
  );

  const header = (
    <View style={styles.header}>
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
      <View style={styles.sectionRow}>
        <View style={styles.sectionTitle}>
          <Text accessibilityRole="header" variant="Body/M/SemiBold">
            일정
          </Text>
          <Text variant="Caption/M/Medium" color={colors.gray[700]}>
            {weekLabel}
          </Text>
        </View>
        {/* 격자 보기는 Figma 화면이 없어 목록 보기만 지원한다. 동작하지 않으므로 스크린리더에서는 숨긴다 */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.viewToggle}
        >
          <Icon name="list" size={26} />
          <Icon name="grid" size={26} />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <TabHeader title="내 작업" onOpenNotifications={onOpenNotifications} />
      <FlatList
        ref={listRef}
        data={schedule}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={EmptySchedule}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={[readableColumn, styles.content]}
      />
      {/* 탭 바 바로 위에서 목록이 배경색으로 흐려진다. 터치는 아래 목록으로 간다.
          일정이 없으면 깔지 않는다 (작은 화면에서 빈 상태 안내가 흐려지지 않게) */}
      {schedule.length > 0 && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.bottomFade}
          testID="home-bottom-fade"
        />
      )}
    </SafeAreaView>
  );
}

const keyExtractor = (item: ScheduleItem) => item.id;

function Separator() {
  return <View style={styles.separator} />;
}

// 일정(무): 아이콘은 Figma App Icon · Calendar · Active 를 회색으로 칠한 것
function EmptySchedule() {
  return (
    <View style={styles.emptySchedule}>
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
          이번 주 일정이 없어요
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

// Figma 에서 '일정' 줄과 첫 일정 카드 사이
const HEADER_PADDING_BOTTOM = 12;
// Figma 에서 목록이 흐려지는 탭 바 위 높이
const BOTTOM_FADE_HEIGHT = 83;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background[3] },
  // 진행 중 작업 카드는 상단 바 아래 20 에서 시작한다 (Figma 3463:17452: 제목 줄 72–106, 카드 126).
  // 마지막 카드는 흐려지는 곳 위에서 끝난다
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: BOTTOM_FADE_HEIGHT,
  },
  header: { gap: 20, paddingBottom: HEADER_PADDING_BOTTOM },
  // 일정 줄은 Figma 에서 카드보다 조금 안쪽에서 시작하고 오른쪽 끝은 카드와 같다
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginLeft: 6.84,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewToggle: { flexDirection: 'row', gap: 4 },
  separator: { height: 12 },
  // 진하기는 추정값이다. Figma 패널에 정지점 위치가 나오지 않아, 흐려진 글자 픽셀을 재서
  // 위 20% 까지 투명, 탭 바와 닿는 곳에서 0.65 로 잡았다 (메인화면 - 시작 가능 3255:17530)
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_FADE_HEIGHT,
    pointerEvents: 'none',
    backgroundImage: `linear-gradient(to bottom, ${withOpacity(
      colors.background[3],
      0,
    )} 20%, ${withOpacity(colors.background[3], 0.65)} 100%)`,
  },
  // Figma 에서 '일정' 줄 아래 118pt
  emptySchedule: {
    alignItems: 'center',
    gap: 24,
    paddingTop: 118 - HEADER_PADDING_BOTTOM,
  },
  // 문구 줄바꿈 폭도 Figma 의 304
  emptyScheduleText: { alignItems: 'center', gap: 12, maxWidth: 304 },
  centered: { textAlign: 'center' },
});
