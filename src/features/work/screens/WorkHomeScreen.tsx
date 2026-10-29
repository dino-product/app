import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Icon, Text } from '../../../shared/design-system';
import { CurrentWorkCard } from '../components/CurrentWorkCard';
import { ScheduleCard } from '../components/ScheduleCard';
import type { CurrentWork, ScheduleItem } from '../model';

// Figma 작업 수행 › 메인화면 - 시작 가능 (작업 시작 / 작업 수행중)
export type WorkHomeScreenProps = {
  currentWork: CurrentWork | null;
  schedule: readonly ScheduleItem[];
  weekLabel: string;
  /** 진행할 작업을 시작했는지. 화면을 오가도 유지되도록 바깥에서 들고 있는다 */
  started: boolean;
  onStartWork: () => void;
  onOpenWork: (id: string) => void;
  onOpenNotifications?: () => void;
};

export function WorkHomeScreen({
  currentWork,
  schedule,
  weekLabel,
  started,
  onStartWork,
  onOpenWork,
  onOpenNotifications,
}: WorkHomeScreenProps) {
  const renderItem = useCallback(
    ({ item }: { item: ScheduleItem }) => (
      <ScheduleCard item={item} onPress={onOpenWork} />
    ),
    [onOpenWork],
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text
          accessibilityRole="header"
          variant="Body/XL/SemiBold"
          color={colors.black}
        >
          내 작업
        </Text>
        {onOpenNotifications ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="알림"
            hitSlop={10}
            onPress={onOpenNotifications}
          >
            <Icon name="bell" />
          </Pressable>
        ) : (
          <Icon name="bell" />
        )}
      </View>
      {currentWork && (
        <CurrentWorkCard
          work={currentWork}
          started={started}
          onStart={onStartWork}
          onOpen={() => onOpenWork(currentWork.id)}
        />
      )}
      <View style={styles.sectionRow}>
        <View style={styles.sectionTitle}>
          <Text accessibilityRole="header" variant="Body/M/SemiBold">
            일정
          </Text>
          <Text variant="Caption/M/Medium" color={colors.gray[600]}>
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
      <FlatList
        data={schedule}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const keyExtractor = (item: ScheduleItem) => item.id;

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background[3] },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  header: { gap: 20, paddingTop: 16, paddingBottom: 16 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewToggle: { flexDirection: 'row', gap: 4 },
  separator: { height: 12 },
});
