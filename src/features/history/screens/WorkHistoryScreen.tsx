import { useCallback, useMemo, useState, type Ref } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  StyleSheet,
  View,
  type FlatListInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Icon, Text } from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { TabHeader } from '../../../shared/layout/TabHeader';
import { addMonths, formatMonthTitle } from '../../schedule/model';
import { CompletedWorkRow } from '../components/CompletedWorkRow';
import { MonthSwitcher } from '../components/MonthSwitcher';
import { SummaryCard } from '../components/SummaryCard';
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
  /** 완료한 작업 전부. 누적 완료 건수는 이 개수다 */
  works: readonly CompletedWork[];
  onOpenWork: (id: string) => void;
  /** 바깥에서 리스트를 맨 위로 올릴 때 쓴다 */
  listRef?: Ref<FlatListInstance>;
};

export function WorkHistoryScreen({
  today,
  works,
  onOpenWork,
  listRef,
}: WorkHistoryScreenProps) {
  const [viewMonth, setViewMonth] = useState<YearMonth>(() => monthOf(today));
  const monthWorks = useMemo(
    () => completedInMonth(works, viewMonth),
    [works, viewMonth],
  );

  // 스크린리더 포커스는 누른 화살표에 남아 바뀐 제목을 읽지 않으므로, 바뀐 달과 건수를 알려 준다
  const moveMonth = (delta: number) => {
    const next = addMonths(viewMonth.year, viewMonth.month, delta);
    setViewMonth(next);
    AccessibilityInfo.announceForAccessibility(
      `${formatMonthTitle(next.year, next.month)}, 완료 ${
        completedInMonth(works, next).length
      }건`,
    );
  };

  const renderItem = useCallback(
    ({ item }: { item: CompletedWork }) => (
      <CompletedWorkRow item={item} onPress={onOpenWork} />
    ),
    [onOpenWork],
  );

  // 화살표가 위아래로 넓힌 터치 영역이 리스트 밖으로 나가지 않도록 월 선택도 리스트 머리에 둔다
  const header = (
    <View style={styles.header}>
      <MonthSwitcher
        title={formatMonthTitle(viewMonth.year, viewMonth.month)}
        canGoNext={isBeforeMonth(viewMonth, monthOf(today))}
        onPrev={() => moveMonth(-1)}
        onNext={() => moveMonth(1)}
      />
      {/* '이번 달 완료' 는 고른 달 기준이다 (기본안) */}
      <View style={styles.summary}>
        <SummaryCard label="누적 완료" count={works.length} />
        <SummaryCard label="이번 달 완료" count={monthWorks.length} />
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {/* 탭 첫 화면 공통 상단 바 (#103). Figma 작업이력 (기본) 2751:6982 에는 종이 없다 */}
      <TabHeader title="작업 이력" />
      <FlatList
        ref={listRef}
        testID="work-history-list"
        data={monthWorks}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={EmptyMonth}
        style={styles.list}
        contentContainerStyle={readableColumn}
      />
    </SafeAreaView>
  );
}

const keyExtractor = (item: CompletedWork) => item.id;

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
  list: { flex: 1 },
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
