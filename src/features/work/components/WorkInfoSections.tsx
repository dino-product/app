import { Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  CTA,
  Icon,
  StatusChip,
  Text,
} from '../../../shared/design-system';
import { formatWon, type WorkDetail } from '../model';
import { InfoCard, InfoField, Section, SectionBand } from './InfoCard';
import { PhotoThumb } from './PhotoThumb';

// 작업 상세의 정보 영역 (요약, 일정 및 담당, 고객, 위치, 작업 내용).
// 작업 수행 상세(완료 보고 포함)와 스케줄의 응답 필요 상세가 함께 쓴다.
export function WorkInfoSections({
  work,
  onCall,
  onNavigate,
}: {
  work: WorkDetail;
  onCall: (phone: string) => void;
  onNavigate: (address: string) => void;
}) {
  return (
    <>
      <View style={styles.summary}>
        <View style={styles.titleRow}>
          <Text variant="Body/XL/Bold" style={styles.shrink}>
            {work.title}
          </Text>
          <StatusChip status={work.status} size="S" style={styles.chip} />
        </View>
        <View style={styles.metaRow}>
          <View style={styles.idPill}>
            <Text variant="Caption/S/Medium" color={colors.gray[600]}>
              {work.id}
            </Text>
          </View>
          <Text variant="Caption/S/Medium" color={colors.gray[600]}>
            {`· ${work.registeredAt} 등록`}
          </Text>
        </View>
      </View>
      <SectionBand />

      <Section title="일정 및 담당 정보">
        <InfoCard>
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
        <InfoCard>
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
              onPress={() => onCall(work.customer.phone)}
              style={styles.call}
            >
              <Icon name="phone" size={20} color={colors.gray[600]} />
            </Pressable>
          </View>
        </InfoCard>
      </Section>

      <Section title="작업 위치">
        <InfoCard>
          <InfoField label="주소" value={work.address} />
          {/* 지도 SDK 연동 전까지 자리만 둔다 */}
          <View style={styles.map} />
        </InfoCard>
        <CTA
          size="M"
          variant="primary"
          icon={<Icon name="navigation" size={20} color={colors.white[100]} />}
          label="길찾기"
          onPress={() => onNavigate(work.address)}
          style={styles.navigate}
        />
      </Section>

      <Section title="작업 내용">
        <InfoCard>
          <InfoField label="작업 메모" value={work.memo} />
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text variant="Caption/M/Medium" color={colors.gray[600]}>
              가격
            </Text>
            <Text variant="Body/M/SemiBold">{formatWon(work.price)}</Text>
          </View>
        </InfoCard>
        <View style={styles.requestImages}>
          <View style={styles.priceRow}>
            <Text variant="Caption/M/Medium" color={colors.gray[600]}>
              작업 요청 이미지
            </Text>
            <Text variant="Caption/S/Medium" color={colors.gray[600]}>
              {`${work.requestImages.length}장`}
            </Text>
          </View>
          <View style={styles.thumbs}>
            {work.requestImages.map(uri => (
              <PhotoThumb key={uri} uri={uri} />
            ))}
          </View>
        </View>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 10, paddingHorizontal: 24, paddingTop: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { alignSelf: 'center' },
  shrink: { flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  idPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.background[1],
  },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  half: { flex: 1 },
  call: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.gray[50],
  },
  map: { height: 160, borderRadius: 12, backgroundColor: colors.background[1] },
  navigate: { minHeight: 48 },
  divider: { height: 1, backgroundColor: colors.gray[100] },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestImages: {
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.gray[50],
  },
  thumbs: { flexDirection: 'row', gap: 10 },
});
