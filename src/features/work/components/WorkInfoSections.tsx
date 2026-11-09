import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  CTA,
  Icon,
  StatusChip,
  Text,
  touchSlop,
} from '../../../shared/design-system';
import { formatPrice, type WorkDetail, type WorkPlace } from '../model';
import { InfoCard, InfoField, Section, SectionBand } from './InfoCard';
import { SitePhotosSection } from './SitePhotosSection';
import { WorkLocationMap } from './WorkLocationMap';

// 작업 상세의 정보 영역 (요약, 일정 및 담당, 고객, 위치, 작업 내용, 현장 사진).
// 모든 작업 상세가 함께 쓴다: 작업 수행 상세(완료 보고 포함, 홈·알림), 작업 이력 상세, 내 일정의 응답 필요 상세.
export function WorkInfoSections({
  work,
  onCall,
  onNavigate,
  onOpenMap,
}: {
  work: WorkDetail;
  onCall: (phone: string) => void;
  /** 길찾기 */
  onNavigate: (place: WorkPlace) => void;
  /** 작업 위치 지도를 누르면 그 위치를 지도 앱에서 연다 */
  onOpenMap: (place: WorkPlace) => void;
}) {
  const { address, location } = work;
  const place = useMemo<WorkPlace>(
    () => ({ address, location }),
    [address, location],
  );
  // 지도(memo)가 완료 보고 입력 같은 다른 갱신에 다시 그려지지 않게 같은 함수를 넘긴다
  const openMap = useCallback(() => onOpenMap(place), [onOpenMap, place]);
  return (
    <>
      <View style={styles.summary}>
        <View style={styles.titleRow}>
          <Text variant="Body/XL/Bold" style={styles.shrink}>
            {work.title}
          </Text>
          <StatusChip
            status={work.status}
            label={work.statusLabel}
            size="S"
            style={styles.chip}
          />
        </View>
        <View style={styles.metaRow}>
          <View style={styles.idPill}>
            <Text variant="Caption/S/Medium" color={colors.gray[600]}>
              {work.id}
            </Text>
          </View>
          <Text variant="Caption/M/Medium" color={colors.gray[600]}>
            {`· ${work.registeredAt} 등록`}
          </Text>
        </View>
      </View>
      <SectionBand />

      <Section title="일정 및 담당 정보">
        <InfoCard style={styles.scheduleCard}>
          <View style={styles.pair}>
            <InfoField label="날짜" value={work.date} style={styles.half} />
            <InfoField
              label="시간"
              value={work.timeRange}
              style={styles.half}
            />
          </View>
          <View style={styles.pair}>
            <InfoField
              label="담당기사"
              value={work.technician}
              style={styles.half}
            />
            <InfoField
              label="작업유형"
              value={work.workType}
              style={styles.half}
            />
          </View>
        </InfoCard>
      </Section>

      <Section title="고객 정보">
        <InfoCard style={styles.customerCard}>
          <InfoField label="고객명" value={work.customer.name} />
          <View style={styles.pair}>
            <InfoField
              label="연락처"
              value={work.customer.phone}
              style={styles.half}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${work.customer.name} 고객에게 전화`}
              hitSlop={CALL_HIT_SLOP}
              onPress={() => onCall(work.customer.phone)}
              style={styles.call}
            >
              <Icon name="phone" color={colors.gray[800]} />
            </Pressable>
          </View>
        </InfoCard>
      </Section>

      {/* Figma 작업 위치 (작업 상세 3235:16275, 응답 필요 상세 3463:16686): 카드 안 주소·지도, 아래 길찾기 */}
      <Section title="작업 위치">
        <InfoCard>
          <InfoField label="주소" value={work.address} />
          <WorkLocationMap
            // 다른 현장이면 지도를 새로 불러온다 (불러오기·실패 상태를 처음부터)
            key={
              work.location
                ? `${work.location.latitude},${work.location.longitude}`
                : 'none'
            }
            location={work.location}
            onPress={openMap}
          />
        </InfoCard>
        <CTA
          variant="primary"
          icon={
            // Figma 길찾기 아이콘은 12×12 다. 아이콘 SVG(24 상자 가운데 12)를 그대로 그리고 자리만 12 로 잡는다
            <Icon
              name="navigation"
              size={NAVIGATE_ICON_FRAME}
              color={colors.white[100]}
              style={styles.navigateIcon}
              testID="navigate-icon"
            />
          }
          label="길찾기"
          onPress={() => onNavigate(place)}
        />
      </Section>

      <Section title="작업 내용">
        {/* Figma 작업 수행 상세(3235:16226)의 작업 내용 카드는 회색 채움이다 */}
        <InfoCard filled testID="work-content-card">
          {/* 메모는 다른 칸과 달리 라벨 아래 8 에 작은 본문이다 */}
          <View style={styles.memo}>
            <Text variant="Caption/M/Medium" color={colors.gray[600]}>
              작업 메모
            </Text>
            <Text variant="Caption/M/Medium" color={colors.gray[800]}>
              {work.memo}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text variant="Caption/M/Medium" color={colors.gray[600]}>
              가격
            </Text>
            <Text variant="Body/S/Bold" color={colors.gray[800]}>
              {formatPrice(work.price)}
            </Text>
          </View>
        </InfoCard>
      </Section>

      {/* 작업 요청 사진은 작업 상태와 관계없이 모든 작업 상세의 이 자리에 같은 섹션으로 보인다 (#142) */}
      <SitePhotosSection address={work.address} photos={work.requestImages} />
    </>
  );
}

const CALL_SIZE = 44;
// 전화 버튼 44×44 를 최소 터치 영역으로 보완한다 (Android 48)
const CALL_HIT_SLOP = touchSlop(CALL_SIZE);
// 길찾기 아이콘: SVG 상자 24 의 가운데 12 가 화살표다 (Figma Polygon 12×12)
const NAVIGATE_ICON_FRAME = 24;
const NAVIGATE_ICON_SIZE = 12;

const styles = StyleSheet.create({
  // Figma 작업 상세 요약: 제목 줄(제목↔칩 12) → 12 → 코드·등록일 줄
  summary: { gap: 12, paddingHorizontal: 24, paddingTop: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chip: { alignSelf: 'center' },
  shrink: { flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  idPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.background[1],
  },
  // Figma: 일정 및 담당 카드는 두 줄 사이 14, 고객 카드는 고객명↔연락처 12
  scheduleCard: { gap: 14 },
  customerCard: { gap: 12 },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  half: { flex: 1 },
  call: {
    width: CALL_SIZE,
    height: CALL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CALL_SIZE / 2,
    backgroundColor: colors.gray[100],
  },
  // 자리는 Figma 아이콘 크기 12 로 잡고, 24 SVG 를 그 가운데에 둔다 (둘레 6 은 투명이라 밖으로 넘쳐도 보이지 않는다)
  navigateIcon: {
    width: NAVIGATE_ICON_SIZE,
    height: NAVIGATE_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  memo: { gap: 8 },
  divider: { height: 1, backgroundColor: colors.gray[100] },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
