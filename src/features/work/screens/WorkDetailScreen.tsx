import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ComponentRef,
  type Ref,
} from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  CTA,
  Icon,
  ICON_HIT_SLOP,
  Text,
  TextArea,
  withOpacity,
} from '../../../shared/design-system';
import { KeyboardAvoidingArea } from '../../../shared/keyboard/KeyboardAvoidingArea';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import { Section, SectionBand } from '../components/InfoCard';
import { WorkInfoSections } from '../components/WorkInfoSections';
import { PhotoUploader } from '../components/PhotoUploader';
import {
  AmountInput,
  FieldLabel,
  LineInput,
  PaymentMethodSelect,
} from '../components/ReportFields';
import { ResultModal } from '../components/ResultModal';
import { haptic } from '../../../shared/haptics';
import {
  canSubmitReport,
  emptyReport,
  hasReportInput,
  PHOTO_LIMIT,
  type SubmitResult,
  type WorkDetail,
  type WorkReport,
} from '../model';

// Figma 작업 수행 › 작업수행-상세, 작업수행-상세/보고제출 활성 (입력 전·입력 완료·제출 후, 제출 완료·작업 취소 모달 포함)
export type WorkDetailScreenProps = {
  /** submission 이 있으면 제출을 마친 작업이라 보고 영역을 읽기 전용으로 그린다 */
  work: WorkDetail;
  onBack: () => void;
  onSubmitReport: (report: WorkReport) => SubmitResult | Promise<SubmitResult>;
  /** 결과 모달의 "메인 화면으로" */
  onDone: () => void;
  onCall: (phone: string) => void;
  onNavigate: (address: string) => void;
  /** 촬영·앨범 연동. 고르지 않으면 null */
  onPickPhoto: () => Promise<string | null>;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
  /** 제출하지 않은 완료 보고 입력이 있는지 처음과 바뀔 때 알린다. 바깥에서 화면을 닫기 전에 물을 때 쓴다 */
  onUnsavedReportChange?: (unsaved: boolean) => void;
  /** 이어 쓸 보고 (앱이 종료되기 전에 쓰던 초안). 처음 열 때만 쓴다 */
  initialReport?: WorkReport;
  /** 작성 중인 보고가 바뀔 때마다 알린다. 바깥에서 초안으로 남길 때 쓴다. 제출을 마친 작업은 부르지 않는다 */
  onReportChange?: (report: WorkReport) => void;
};

type PhotoKey = 'beforePhotos' | 'afterPhotos';

// 완료 보고 영역이 화면 아래쪽에서 이만큼 올라오면 "완료 보고 작성하기" 버튼을 숨긴다
const JUMP_HIDE_OFFSET = 120;

export function WorkDetailScreen({
  work,
  onBack,
  onSubmitReport,
  onDone,
  onCall,
  onNavigate,
  onPickPhoto,
  titleRef,
  onUnsavedReportChange,
  initialReport,
  onReportChange,
}: WorkDetailScreenProps) {
  const [report, setReport] = useState<WorkReport>(
    initialReport ?? emptyReport,
  );
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [showJump, setShowJump] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const picking = useRef(false);
  const submittingRef = useRef(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const reportY = useRef(0);
  const viewportHeight = useRef(0);

  // 제출을 마친 작업은 제출한 내용을 그대로 보여주고 고칠 수 없다
  const submission = work.submission;
  const readOnly = submission !== undefined;
  const shown = submission?.report ?? report;

  // 제출을 마친 보고는 잃을 입력이 아니다. 제출 중에는 아직 결과가 없어 작성 중이다 (API 연동 때 다시 본다).
  // 글자마다가 아니라 여부가 바뀔 때만 알린다. 콜백이 바뀌어도 다시 부르지 않는다
  const unsaved = !readOnly && result === null && hasReportInput(report);
  const notifyUnsaved = useEffectEvent((value: boolean) =>
    onUnsavedReportChange?.(value),
  );
  useEffect(() => {
    notifyUnsaved(unsaved);
  }, [unsaved]);

  // 입력은 여러 곳(입력칸·사진·결제 방식)에서 바뀌므로 바뀐 결과를 한곳에서 알린다
  const notifyReport = useEffectEvent((value: WorkReport) =>
    onReportChange?.(value),
  );
  useEffect(() => {
    if (!readOnly) {
      notifyReport(report);
    }
  }, [readOnly, report]);

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
      const submitted = await onSubmitReport(report);
      setResult(submitted);
      // 취소된 작업이라 보고가 반려된 경우는 성공이 아니다
      if (submitted.kind === 'submitted') {
        haptic.success();
      }
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
      <View style={[readableColumn, styles.header]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={ICON_HIT_SLOP}
          onPress={onBack}
          style={styles.back}
        >
          <Icon name="chevron-left" />
        </Pressable>
        <Text
          ref={titleRef}
          accessibilityRole="header"
          variant="Body/M/SemiBold"
          color={colors.mainText}
        >
          작업 상세
        </Text>
      </View>

      {/* Android 는 edge-to-edge 라 키보드가 떠도 창이 줄지 않아, 가린 만큼 스크롤 영역을 줄인다 */}
      <KeyboardAvoidingArea testID="work-detail-body">
        <ScrollView
          {...noOverscroll}
          ref={scrollRef}
          testID="work-detail-scroll"
          // 끌어내리면 키보드가 손가락을 따라 내려간다. Android 는 interactive 가 없어 끌기 시작할 때 내린다
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          onLayout={(event: LayoutChangeEvent) => {
            viewportHeight.current = event.nativeEvent.layout.height;
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[readableColumn, styles.content]}
        >
          <WorkInfoSections
            work={work}
            onCall={onCall}
            onNavigate={onNavigate}
          />
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
                photos={shown.beforePhotos}
                onAdd={() => addPhoto('beforePhotos')}
                onRemove={index => removePhoto('beforePhotos', index)}
                readOnly={readOnly}
              />
              <PhotoUploader
                title="작업 후"
                photos={shown.afterPhotos}
                onAdd={() => addPhoto('afterPhotos')}
                onRemove={index => removePhoto('afterPhotos', index)}
                readOnly={readOnly}
              />
            </Section>
            <Section title="수행 메모" optional>
              <TextArea
                label="수행 메모 입력"
                placeholder="수행 메모 작성"
                value={shown.memo}
                onChangeText={memo => update({ memo })}
                readOnly={readOnly}
              />
            </Section>
            <Section title="사용 부품" optional>
              <LineInput
                label="사용 부품 입력"
                placeholder="사용 부품 작성"
                value={shown.parts}
                onChangeText={parts => update({ parts })}
                readOnly={readOnly}
              />
            </Section>
            <Section title="결제 정보">
              <FieldLabel>결제 금액</FieldLabel>
              <AmountInput
                value={shown.amount}
                onChange={amount => update({ amount })}
                readOnly={readOnly}
              />
              <FieldLabel>결제 방식</FieldLabel>
              <PaymentMethodSelect
                value={shown.paymentMethod}
                onChange={paymentMethod => {
                  haptic.selection();
                  update({ paymentMethod });
                }}
                readOnly={readOnly}
              />
            </Section>
            {/* 스크린리더가 버튼보다 먼저 읽도록 버튼 앞에 둔다 */}
            <Text
              variant="Caption/S/Medium"
              color={colors.gray[500]}
              style={styles.notice}
            >
              {submission
                ? `제출 시각 ${submission.submittedAt}`
                : '제출 후 수정 불가'}
            </Text>
            <CTA
              label={readOnly ? '제출 완료' : '완료보고 제출'}
              disabled={readOnly || submitting || !canSubmitReport(report)}
              onPress={submit}
              style={styles.submit}
            />
          </View>
        </ScrollView>

        {/* 제출을 마친 작업은 작성할 보고가 없다 */}
        {showJump && !readOnly && (
          <>
            {/* 버튼 뒤 그라데이션 (#95). 버튼이 있을 때만 깔고, 터치는 아래 스크롤 뷰로 넘기고, 스크린리더에서 숨긴다 */}
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.jumpFade}
              testID="work-detail-jump-fade"
            />
            {/* 버튼 양옆 여백까지 덮으므로 그 터치는 아래 스크롤 뷰로 넘긴다 */}
            <View
              pointerEvents="box-none"
              style={[readableColumn, styles.jump]}
            >
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
          </>
        )}
      </KeyboardAvoidingArea>

      {result && <ResultModal visible result={result} onConfirm={onDone} />}
    </SafeAreaView>
  );
}

// '완료 보고 작성하기' 뒤 그라데이션. Figma 작업수행-상세 (2741:2713) 의 Frame 2147238742 (2741:3417):
// 393×320, 프레임 위 532 에서 아래 끝(852)까지, 채움 #F0F0F0 (변수 없음) 투명 0% → 불투명 54.3%, 위→아래.
// 변환 행렬(위치 = 1.065 × 높이 비율 − 0.065)로 레이어 높이의 6.1% 까지 투명, 57.1% 부터 불투명이다.
// 앱 화면은 탭 바(Figma 102) 위에서 끝나므로 그 위로 보이는 218 만 그리고, 정지점은 레이어 위에서 잰 거리로 옮긴다
const JUMP_FADE_COLOR = '#F0F0F0';
const FIGMA_FADE_HEIGHT = 320;
const FIGMA_TAB_BAR_HEIGHT = 102;
const JUMP_FADE_HEIGHT = FIGMA_FADE_HEIGHT - FIGMA_TAB_BAR_HEIGHT;
/** Figma 레이어 위에서 잰 투명 구간 끝 / 불투명 시작 (pt) */
const JUMP_FADE_CLEAR_UNTIL = (FIGMA_FADE_HEIGHT * 0.065) / 1.065;
const JUMP_FADE_SOLID_FROM = (FIGMA_FADE_HEIGHT * (0.5432692 + 0.065)) / 1.065;
const fadeStop = (fromTop: number) =>
  `${Math.round((fromTop / JUMP_FADE_HEIGHT) * 10000) / 100}%`;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  header: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { position: 'absolute', left: 20 },
  content: { paddingBottom: 32 },
  notice: { marginTop: 24, textAlign: 'center' },
  submit: { marginHorizontal: 24, marginTop: 40 },
  // 좌우를 정하지 않아 alignSelf 로 가운데에 놓인다
  jump: { position: 'absolute', bottom: 16, paddingHorizontal: 24 },
  // 창 폭 전체에 깔고 버튼과 함께 탭 바 위에 붙는다
  jumpFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: JUMP_FADE_HEIGHT,
    pointerEvents: 'none',
    backgroundImage: `linear-gradient(to bottom, ${withOpacity(
      JUMP_FADE_COLOR,
      0,
    )} ${fadeStop(JUMP_FADE_CLEAR_UNTIL)}, ${withOpacity(
      JUMP_FADE_COLOR,
      1,
    )} ${fadeStop(JUMP_FADE_SOLID_FROM)})`,
  },
});
