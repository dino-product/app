import { useRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BottomNavigationBar,
  colors,
  CTA,
  Icon,
  StatusChip,
  Text,
} from '../../../shared/design-system';
import { mainTabs, type MainTabKey } from '../../../shared/navigation/mainTabs';
import {
  InfoCard,
  InfoField,
  Section,
  SectionBand,
} from '../components/InfoCard';
import { PhotoThumb } from '../components/PhotoThumb';
import { PhotoUploader } from '../components/PhotoUploader';
import {
  AmountInput,
  FieldLabel,
  MemoInput,
  PaymentMethodSelect,
} from '../components/ReportFields';
import { ResultModal } from '../components/ResultModal';
import {
  canSubmitReport,
  emptyReport,
  formatWon,
  PHOTO_LIMIT,
  type SubmitResult,
  type WorkDetail,
  type WorkReport,
} from '../model';

// Figma 작업 수행 › 작업수행-상세, 작업수행-상세/보고제출 활성 (제출 완료·작업 취소 모달 포함)
export type WorkDetailScreenProps = {
  work: WorkDetail;
  onBack: () => void;
  onSubmitReport: (report: WorkReport) => SubmitResult | Promise<SubmitResult>;
  /** 결과 모달의 "메인 화면으로" */
  onDone: () => void;
  onCall: (phone: string) => void;
  onNavigate: (address: string) => void;
  /** 촬영·앨범 연동. 고르지 않으면 null */
  onPickPhoto: () => Promise<string | null>;
  onTabChange?: (tab: MainTabKey) => void;
};

type PhotoKey = 'beforePhotos' | 'afterPhotos';

// 완료 보고 영역이 화면 아래쪽에서 이만큼 올라오면 "완료 보고 작성하기" 버튼을 숨긴다
const JUMP_HIDE_OFFSET = 120;

const noop = () => {};

export function WorkDetailScreen({
  work,
  onBack,
  onSubmitReport,
  onDone,
  onCall,
  onNavigate,
  onPickPhoto,
  onTabChange = noop,
}: WorkDetailScreenProps) {
  const [report, setReport] = useState<WorkReport>(emptyReport);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [showJump, setShowJump] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const picking = useRef(false);
  const submittingRef = useRef(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const reportY = useRef(0);
  const viewportHeight = useRef(0);

  const update = (patch: Partial<WorkReport>) =>
    setReport(prev => ({ ...prev, ...patch }));

  const addPhoto = async (key: PhotoKey) => {
    // 선택창이 열려 있는 동안 다시 눌러도 하나만 연다
    if (picking.current) {
      return;
    }
    picking.current = true;
    try {
      const uri = await onPickPhoto();
      if (uri) {
        setReport(prev => ({
          ...prev,
          [key]: [...prev[key], uri].slice(0, PHOTO_LIMIT),
        }));
      }
    } catch {
      // 권한 거부·취소 등은 사진을 추가하지 않고 넘어간다 (안내 UI 는 카메라 연동 때)
    } finally {
      picking.current = false;
    }
  };

  const removePhoto = (key: PhotoKey, index: number) =>
    setReport(prev => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));

  const submit = async () => {
    // disabled 가 반영되기 전 같은 프레임의 두 번째 탭도 막는다
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      setResult(await onSubmitReport(report));
    } catch {
      // 실패하면 다시 누를 수 있게 둔다 (오류 안내 UI 는 API 연동 때)
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const bottom = event.nativeEvent.contentOffset.y + viewportHeight.current;
    // 값이 같으면 React 가 렌더를 건너뛰므로 스크롤마다 렌더되지 않는다
    setShowJump(bottom < reportY.current + JUMP_HIDE_OFFSET);
  };

  const jumpToReport = () =>
    scrollRef.current?.scrollTo({ y: reportY.current, animated: true });

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={10}
          onPress={onBack}
          style={styles.back}
        >
          <Icon name="chevron-left" />
        </Pressable>
        <Text
          accessibilityRole="header"
          variant="Body/M/SemiBold"
          color={colors.mainText}
        >
          작업 상세
        </Text>
      </View>

      <View style={styles.body}>
        <ScrollView
          ref={scrollRef}
          testID="work-detail-scroll"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          onLayout={(event: LayoutChangeEvent) => {
            viewportHeight.current = event.nativeEvent.layout.height;
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.content}
        >
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
              icon={
                <Icon name="navigation" size={20} color={colors.white[100]} />
              }
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
          <SectionBand />

          <View
            testID="work-report-section"
            onLayout={(event: LayoutChangeEvent) => {
              reportY.current = event.nativeEvent.layout.y;
            }}
          >
            <Section title="현장 사진 등록">
              <PhotoUploader
                title="작업 전"
                photos={report.beforePhotos}
                onAdd={() => addPhoto('beforePhotos')}
                onRemove={index => removePhoto('beforePhotos', index)}
              />
              <PhotoUploader
                title="작업 후"
                photos={report.afterPhotos}
                onAdd={() => addPhoto('afterPhotos')}
                onRemove={index => removePhoto('afterPhotos', index)}
              />
            </Section>
            <Section title="수행 메모">
              <MemoInput
                label="수행 메모 입력"
                placeholder="수행 메모 작성"
                value={report.memo}
                onChangeText={memo => update({ memo })}
              />
            </Section>
            <Section title="사용 부품">
              <MemoInput
                label="사용 부품 입력"
                placeholder="사용 부품 작성"
                value={report.parts}
                onChangeText={parts => update({ parts })}
              />
            </Section>
            <Section title="결제 정보">
              <FieldLabel>결제 금액</FieldLabel>
              <AmountInput
                value={report.amount}
                onChange={amount => update({ amount })}
              />
              <FieldLabel>결제 방식</FieldLabel>
              <PaymentMethodSelect
                value={report.paymentMethod}
                onChange={paymentMethod => update({ paymentMethod })}
              />
            </Section>
            <CTA
              label="완료보고 제출"
              disabled={submitting || !canSubmitReport(report)}
              onPress={submit}
              style={styles.submit}
            />
          </View>
        </ScrollView>

        {showJump && (
          <View style={styles.jump}>
            <CTA
              variant="brand"
              icon={
                <Icon
                  name="chevrons-down"
                  size={20}
                  color={colors.white[100]}
                />
              }
              label="완료 보고 작성하기"
              onPress={jumpToReport}
            />
          </View>
        )}
      </View>

      <BottomNavigationBar
        items={mainTabs}
        activeKey="home"
        onChange={onTabChange}
      />

      {result && <ResultModal visible result={result} onConfirm={onDone} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  header: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { position: 'absolute', left: 20 },
  body: { flex: 1 },
  content: { paddingBottom: 32 },
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
  map: {
    height: 160,
    borderRadius: 12,
    backgroundColor: colors.background[1],
  },
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
  submit: { marginHorizontal: 24, marginTop: 32 },
  jump: { position: 'absolute', left: 24, right: 24, bottom: 16 },
});
