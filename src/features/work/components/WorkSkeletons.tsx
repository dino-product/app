import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  colors,
  Skeleton,
  SkeletonBlock,
  SkeletonLine,
} from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { InfoCard, SectionBand } from './InfoCard';

// 작업 화면들을 받는 동안의 스켈레톤 (#139). Figma 에 없어 실제 카드와 같은 여백·모서리·글자 줄 높이로 최소 구성한다 (Figma 미확인).
// 받은 내용으로 바뀔 때 높이가 크게 튀지 않게, 카드 수는 흔한 경우(일정 몇 건)에 맞춘다

// 상태 칩(S) 자리: '배정됨' 칩 크기 (Figma 작업상태 컬러칩 61x28)
const CHIP_WIDTH = 61;
const CHIP_HEIGHT = 28;
// 카드 안 CTA(M) 는 Figma 에서 48pt, 모서리 12
const CARD_CTA_HEIGHT = 48;
const CTA_RADIUS = 12;

function Chip() {
  return <SkeletonBlock width={CHIP_WIDTH} height={CHIP_HEIGHT} radius={999} />;
}

// 메인화면 주간 일정 카드 (ScheduleCard) 자리
function ScheduleCardSkeleton() {
  return (
    <View style={styles.scheduleCard} testID="schedule-card-skeleton">
      <View style={styles.titleRow}>
        <View style={styles.summary}>
          <SkeletonLine variant="Body/S/SemiBold" width="60%" />
          <SkeletonLine variant="Caption/M/Medium" width="45%" />
        </View>
        <Chip />
      </View>
      <SkeletonLine variant="Caption/M/Medium" width="75%" />
    </View>
  );
}

/** 메인화면(내 작업): 진행할 작업 카드, '일정' 줄, 이번 주 일정 카드 세 장. 상단 바 아래 리스트 자리에 그린다 */
export const WorkHomeSkeleton = memo(function WorkHomeSkeletonView() {
  return (
    <Skeleton
      style={[readableColumn, styles.homeContent]}
      testID="work-home-skeleton"
    >
      <View style={styles.homeHeader}>
        <View style={styles.currentCard} testID="work-home-skeleton-current">
          <View style={styles.currentInfo}>
            <SkeletonLine variant="Body/S/Bold" width="55%" />
            <SkeletonLine variant="Caption/M/Medium" width="35%" />
            <SkeletonLine variant="Caption/M/Regular" width="70%" />
          </View>
          <SkeletonBlock height={CARD_CTA_HEIGHT} radius={CTA_RADIUS} />
        </View>
        <View style={styles.sectionRow}>
          <SkeletonLine variant="Body/M/SemiBold" width={120} />
          <SkeletonBlock width={56} height={26} radius={6} />
        </View>
      </View>
      <View style={styles.scheduleList}>
        <ScheduleCardSkeleton />
        <ScheduleCardSkeleton />
        <ScheduleCardSkeleton />
      </View>
    </Skeleton>
  );
});

// 확정 일정·완료 작업 행 (ConfirmedRow, CompletedWorkRow) 자리: 제목과 칩, 날짜·시간, 업체 | 고객 · 주소
function WorkRowSkeleton() {
  return (
    <View style={styles.row} testID="work-row-skeleton">
      <View style={styles.rowTitle}>
        <SkeletonLine variant="Body/M/SemiBold" width="50%" />
        <Chip />
      </View>
      <View style={styles.rowTime}>
        <SkeletonBlock width={24} height={24} radius={6} />
        <SkeletonLine variant="Body/XS/Medium" width="45%" />
      </View>
      <SkeletonLine variant="Caption/M/Medium" width="70%" />
    </View>
  );
}

/** 작업 행 목록(내 일정 확정 일정, 작업 이력)을 받는 동안. 리스트의 빈 자리(머리 아래)에 그린다 */
export const WorkRowsSkeleton = memo(function WorkRowsSkeletonView() {
  return (
    <Skeleton testID="work-rows-skeleton">
      <WorkRowSkeleton />
      <WorkRowSkeleton />
      <WorkRowSkeleton />
    </Skeleton>
  );
});

// 작업 상세의 정보 칸 (InfoField) 자리: 이름 한 줄과 값 한 줄
function FieldSkeleton({ width }: { width: `${number}%` }) {
  return (
    <View style={styles.field}>
      <SkeletonLine variant="Caption/M/Medium" width={48} />
      <SkeletonLine variant="Body/XS/Medium" width={width} />
    </View>
  );
}

// 작업 상세의 섹션 (Section) 자리: 제목 한 줄과 카드
function SectionSkeleton({ children }: { children: ReactNode }) {
  return (
    <View style={styles.section}>
      <SkeletonLine variant="Body/S/SemiBold" width={110} />
      {children}
    </View>
  );
}

/** 작업 상세(작업 수행·응답 필요·완료 작업): 제목·칩·번호 줄, 일정 및 담당 정보, 고객 정보. 머리(뒤로·제목) 아래에 그린다 */
export const WorkDetailSkeleton = memo(function WorkDetailSkeletonView() {
  return (
    <Skeleton style={readableColumn} testID="work-detail-skeleton">
      <View style={styles.detailSummary}>
        <View style={styles.detailTitle}>
          <SkeletonLine variant="Body/XL/Bold" width="55%" />
          <Chip />
        </View>
        <SkeletonLine variant="Caption/S/Medium" width="45%" />
      </View>
      <SectionBand />
      <SectionSkeleton>
        <InfoCard>
          <View style={styles.pair}>
            <FieldSkeleton width="80%" />
            <FieldSkeleton width="70%" />
          </View>
          <View style={styles.pair}>
            <FieldSkeleton width="60%" />
            <FieldSkeleton width="50%" />
          </View>
        </InfoCard>
      </SectionSkeleton>
      <SectionSkeleton>
        <InfoCard>
          <FieldSkeleton width="40%" />
          <FieldSkeleton width="55%" />
        </InfoCard>
      </SectionSkeleton>
    </Skeleton>
  );
});

const styles = StyleSheet.create({
  // WorkHomeScreen 리스트와 같은 여백 (content, header)
  homeContent: { paddingHorizontal: 24, paddingTop: 20 },
  homeHeader: { gap: 20, paddingBottom: 12 },
  // CurrentWorkCard 와 같은 카드
  currentCard: {
    gap: 22,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: colors.white[100],
  },
  currentInfo: { gap: 6 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginLeft: 6,
  },
  scheduleList: { gap: 12 },
  // ScheduleCard 와 같은 카드
  scheduleCard: {
    gap: 6,
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.white[100],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  summary: { flex: 1, gap: 6 },
  // ConfirmedRow·CompletedWorkRow 와 같은 행
  row: {
    gap: 10,
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTime: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  // WorkInfoSections 의 요약과 같은 여백
  detailSummary: { gap: 10, paddingHorizontal: 24, paddingTop: 24 },
  detailTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  section: { gap: 12, paddingHorizontal: 24, paddingTop: 24 },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  field: { flex: 1, gap: 2 },
});
