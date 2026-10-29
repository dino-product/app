import { Image, Pressable, StyleSheet, View } from 'react-native';
import { colors, CTA, Icon, Text } from '../../../shared/design-system';
import type { CurrentWork } from '../model';

// Figma 에서 3x(101px)로 내보낸 PNG. 화면에서는 33.41pt 로 줄여 그린다
const wrench = require('../../../../assets/images/wrench.png');

// 메인화면 상단의 오늘 진행할 작업 카드. 시작 전 "작업 시작"(Secondary), 시작 후 "작업 수행중"(Primary).
export function CurrentWorkCard({
  work,
  started,
  onStart,
  onOpen,
}: {
  work: CurrentWork;
  started: boolean;
  onStart: () => void;
  onOpen: () => void;
}) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${work.title} 상세 보기`}
        onPress={onOpen}
        style={styles.header}
      >
        {/* Figma 에서 이미지(PNG)로 들어간 일러스트라 SVG 가 아닌 PNG 로 쓴다 */}
        <Image
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          source={wrench}
          style={styles.illustration}
          testID="work-illustration"
        />
        <View style={styles.info}>
          <Text variant="Body/S/Bold">{work.title}</Text>
          <Text variant="Caption/M/Medium">{work.timeRange}</Text>
          <View style={styles.meta}>
            <Text variant="Caption/M/Medium" color={colors.gray[800]}>
              {work.customerName}
            </Text>
            <View style={styles.divider} />
            <Text
              variant="Caption/M/Medium"
              color={colors.gray[800]}
              numberOfLines={1}
              style={styles.address}
            >
              {work.address}
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" />
      </Pressable>
      <CTA
        size="M"
        variant={started ? 'primary' : 'brand'}
        label={started ? '작업 수행중' : '작업 시작'}
        onPress={started ? onOpen : onStart}
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 20,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.white[100],
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  illustration: { width: 33.41, height: 33.41, marginTop: 7.5, marginLeft: 3 },
  info: { flex: 1, gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { width: 1, height: 12, backgroundColor: colors.gray[300] },
  address: { flexShrink: 1 },
  // 카드 안 CTA 는 Figma 에서 48pt
  cta: { minHeight: 48 },
});
