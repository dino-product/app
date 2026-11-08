import { Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  CTA,
  Icon,
  ShadowView,
  Text,
  type DropShadow,
} from '../../../shared/design-system';
import { useTabSwipeRegion } from '../../../shared/gesture/TabSwipeArea';
import type { CurrentWork } from '../model';

// 작업이 있을 때와 없을 때 같은 Figma 프레임의 드롭 섀도
const CARD_SHADOW: DropShadow = {
  x: 0,
  y: 1,
  blur: 18,
  color: '#776BA8',
  opacity: 0.12,
};

// 메인화면 상단의 오늘 진행할 작업 카드. 시작 전 "작업 시작"(Secondary), 시작 후 "작업 수행중"(Primary).
export function CurrentWorkCard({
  work,
  started,
  onStart,
  onOpen,
  starting = false,
}: {
  work: CurrentWork;
  started: boolean;
  onStart: () => void;
  onOpen: () => void;
  /** 시작을 보내는 동안 "작업 시작" 을 잠근다 */
  starting?: boolean;
}) {
  // 카드 안쪽에서 시작한 가로 밀기로는 탭을 바꾸지 않는다 (가장자리 여유·화면 가장자리 띠는 바꾼다, #140)
  const tabSwipe = useTabSwipeRegion();
  return (
    <ShadowView
      shadow={CARD_SHADOW}
      style={[styles.frame, styles.card]}
      onTouchStart={tabSwipe.onTouchStart}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${work.title} 상세 보기`}
        onPress={onOpen}
        style={styles.header}
      >
        <View style={styles.info}>
          <Text variant="Body/S/Bold">{work.title}</Text>
          <Text variant="Caption/M/Medium">{work.timeRange}</Text>
          <View style={styles.meta}>
            <Text
              variant="Caption/M/Medium"
              color={colors.gray[800]}
              style={styles.metaText}
            >
              {work.customerName}
            </Text>
            <View style={styles.divider} />
            <Text
              variant="Caption/M/Regular"
              color={colors.gray[800]}
              numberOfLines={1}
              style={[styles.metaText, styles.address]}
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
        disabled={!started && starting}
        style={styles.cta}
      />
    </ShadowView>
  );
}

// 진행할 작업이 없을 때 같은 자리의 카드. 누를 수 없는 안내라 글자로만 읽힌다
export function NoCurrentWorkCard() {
  return (
    <ShadowView shadow={CARD_SHADOW} style={[styles.frame, styles.empty]}>
      <Text variant="Caption/M/SemiBold" color={colors.white[60]}>
        현재 진행 중인 작업이 없습니다
      </Text>
    </ShadowView>
  );
}

const styles = StyleSheet.create({
  // 작업이 있을 때와 없을 때 같은 Figma 프레임
  frame: { paddingVertical: 24, paddingHorizontal: 20, borderRadius: 18 },
  card: { gap: 22, backgroundColor: colors.white[100] },
  empty: { backgroundColor: colors.primary },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  info: { flex: 1, gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { width: 1, height: 12, backgroundColor: colors.gray[400] },
  // Figma 의 고객·주소 줄은 텍스트 스타일 없이 14pt 행간 140% 다 (Caption/M 은 150%)
  metaText: { lineHeight: 19.6 },
  address: { flexShrink: 1 },
  // 카드 안 CTA 는 Figma 에서 48pt
  cta: { minHeight: 48 },
});
