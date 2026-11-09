import { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableStateCallbackType,
} from 'react-native';
import {
  colors,
  pressedBackground,
  StatusChip,
  Text,
} from '../../../shared/design-system';
import {
  completedWorkA11yLabel,
  workTimeRange,
  type CompletedWork,
} from '../model';

// Figma 작업이력 (기본) 3753:4911 › 완료 작업 카드. 회색 바탕 위 흰 카드이고 카드 전체가 버튼 하나다. 누르면 그 작업 상세를 연다.
// 제목·시간 묶음 오른쪽 위에 완료 칩, 그 아래 발주사 | 고객 · 주소 줄.
// 좌우 밀기(탭 전환·월 넘김) 판정 영역은 카드가 아니라 목록 영역 전체다 (WorkHistoryScreen, #153)
export const CompletedWorkRow = memo(function CompletedWorkRowView({
  item,
  dayLabel,
  onPress,
}: {
  item: CompletedWork;
  /** 시간 줄의 날짜 (예: '오늘 · 9. 19. (토)', '9. 20. (일)') */
  dayLabel: string;
  onPress: (id: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={completedWorkA11yLabel(item)}
      onPress={() => onPress(item.id)}
      style={cardStyle}
    >
      <View style={styles.titleRow}>
        <View style={styles.summary}>
          <Text variant="Body/S/SemiBold" numberOfLines={1}>
            {item.title}
          </Text>
          {/* Figma: 시간(#222)과 날짜(Gray600) 사이는 두 칸이다 */}
          <Text variant="Caption/M/Medium" color={colors.gray[900]}>
            {`${workTimeRange(item)}  `}
            <Text variant="Caption/M/Medium" color={colors.gray[600]}>
              {dayLabel}
            </Text>
          </Text>
        </View>
        <StatusChip status="completed" size="S" />
      </View>
      <View style={styles.meta}>
        <Text variant="Caption/M/Medium" color={colors.gray[800]}>
          {item.company}
        </Text>
        <View style={styles.divider} />
        <Text
          variant="Caption/M/Medium"
          color={colors.gray[600]}
          numberOfLines={1}
          style={styles.shrink}
        >
          {`${item.customerName} · ${item.address}`}
        </Text>
      </View>
    </Pressable>
  );
});

// 누르는 동안 둥근 모서리 안을 회색으로 칠한다 (#102)
const cardStyle = ({ pressed }: PressableStateCallbackType) => [
  styles.card,
  pressed && styles.pressed,
];

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 24,
    gap: 6,
    padding: 20,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[50],
    backgroundColor: colors.gray[0],
  },
  pressed: { backgroundColor: pressedBackground.onWhite },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  summary: { flexShrink: 1, gap: 6 },
  shrink: { flexShrink: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { width: 1, height: 12, backgroundColor: colors.gray[400] },
});
