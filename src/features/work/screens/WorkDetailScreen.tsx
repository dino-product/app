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
} from '../../../shared/design-system';
import { KeyboardAvoidingArea } from '../../../shared/keyboard/KeyboardAvoidingArea';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import { Section, SectionBand } from '../components/InfoCard';
import { WorkInfoSections } from '../components/WorkInfoSections';
import { PhotoUploader } from '../components/PhotoUploader';
import {
  AmountInput,
  LineInput,
  MemoInput,
  PaymentMethodSelect,
  ReportField,
} from '../components/ReportFields';
import { ReportJumpAnchor } from '../components/ReportJumpAnchor';
import { ResultModal } from '../components/ResultModal';
import { haptic } from '../../../shared/haptics';
import {
  canSubmitReport,
  emptyReport,
  hasReportInput,
  PHOTO_LIMIT,
  type SubmitResult,
  type WorkDetail,
  type WorkPlace,
  type WorkReport,
} from '../model';
import type { WorkStatusCode } from '../data/types';

// Figma 작업 수행 › 작업수행-상세, 작업수행-상세/보고제출 활성 (입력 전·입력 완료·제출 후, 제출 완료·작업 취소 모달 포함)
export type WorkDetailScreenProps = {
  /** submission 이 있으면 제출을 마친 작업이라 보고 영역을 읽기 전용으로 그린다 */
  work: WorkDetail;
  onBack: () => void;
  onSubmitReport: (report: WorkReport) => SubmitResult | Promise<SubmitResult>;
  /** 결과 모달의 "메인 화면으로" */
  onDone: () => void;
  onCall: (phone: string) => void;
  onNavigate: (place: WorkPlace) => void;
  /** 작업 위치 지도를 누르면 그 위치를 지도 앱에서 연다 */
  onOpenMap: (place: WorkPlace) => void;
  /** 촬영·앨범. 더 붙일 수 있는 장수를 받아 고른 사진 URI 를 고른 순서대로 돌려준다. 고르지 않으면 빈 배열 */
  onPickPhoto: (remaining: number) => Promise<string[]>;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
  /** 제출하지 않은 완료 보고 입력이 있는지 처음과 바뀔 때 알린다. 바깥에서 화면을 닫기 전에 물을 때 쓴다 */
  onUnsavedReportChange?: (unsaved: boolean) => void;
  /** 아무것도 쓰지 않은 보고 (결제 금액을 계획값으로 미리 채운 것, 결제 방식은 고르지 않은 채). 이어 쓸 보고가 없으면 이것으로 열고, 이것과 같으면 잃을 입력이 없다 */
  plannedReport?: WorkReport;
  /** 이어 쓸 보고 (앱이 종료되기 전에 쓰던 초안). 처음 열 때만 쓴다 */
  initialReport?: WorkReport;
  /** 작성 중인 보고가 바뀔 때마다 알린다. 바깥에서 초안으로 남길 때 쓴다. 제출을 마친 작업·작업중이 아닌 작업은 부르지 않는다 */
  onReportChange?: (report: WorkReport) => void;
  /** 작업전인 작업을 시작한다. 보내는 동안(약속이 끝날 때까지) "작업 시작" 을 잠근다. 실패 안내는 부른 쪽이 한다 */
  onStartWork?: () => void | Promise<void>;
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
  onOpenMap,
  onPickPhoto,
  titleRef,
  onUnsavedReportChange,
  plannedReport = emptyReport,
  initialReport,
  onReportChange,
  onStartWork,
}: WorkDetailScreenProps) {
  const [report, setReport] = useState<WorkReport>(
    initialReport ?? plannedReport,
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
  // 서버는 작업중인 작업의 완료 보고만 받는다. 그 밖(작업전·배정됨·취소)은 보고 영역 대신 안내를 보인다
  const writable = !readOnly && work.workStatus === 'IN_PROGRESS';

  // 제출을 마친 보고와 쓸 수 없는 보고는 잃을 입력이 아니다. 제출 중에는 아직 결과가 없어 작성 중이다.
  // 글자마다가 아니라 여부가 바뀔 때만 알린다. 콜백이 바뀌어도 다시 부르지 않는다
  const unsaved =
    writable && result === null && hasReportInput(report, plannedReport);
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
    if (writable) {
      notifyReport(report);
    }
  }, [writable, report]);

  const update = (patch: Partial<WorkReport>) =>
    setReport(prev => ({ ...prev, ...patch }));

  const addPhoto = async (key: PhotoKey) => {
    // 선택창이 열려 있는 동안 다시 눌러도 하나만 연다
    if (picking.current) {
      return;
    }
    picking.current = true;
    try {
      const uris = await onPickPhoto(PHOTO_LIMIT - report[key].length);
      if (uris.length > 0) {
        // 남은 칸보다 많이 돌아와도 최대 장수까지만 붙인다
        setReport(prev => ({
          ...prev,
          [key]: [...prev[key], ...uris].slice(0, PHOTO_LIMIT),
        }));
      }
    } catch {
      // 취소·실패면 보고를 그대로 둔다. 권한·실패 안내는 고르는 쪽이 띄운다
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
            onOpenMap={onOpenMap}
          />
          <SectionBand />

          {!readOnly && !writable ? (
            <ReportLocked
              workStatus={work.workStatus}
              onStartWork={onStartWork}
            />
          ) : (
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
                <MemoInput
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
                {/* Figma 3235:16439: 결제 금액 묶음과 결제 방식 묶음 사이 12, 묶음 안 이름↔칸 8 */}
                <View style={styles.paymentFields}>
                  <ReportField label="결제 금액">
                    <AmountInput
                      value={shown.amount}
                      onChange={amount => update({ amount })}
                      readOnly={readOnly}
                    />
                  </ReportField>
                  <ReportField label="결제 방식">
                    <PaymentMethodSelect
                      value={shown.paymentMethod}
                      onChange={paymentMethod => {
                        haptic.selection();
                        update({ paymentMethod });
                      }}
                      readOnly={readOnly}
                    />
                  </ReportField>
                </View>
              </Section>
              {/* 스크린리더가 버튼보다 먼저 읽도록 버튼 앞에 둔다 */}
              <Text
                variant="Caption/M/Medium"
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
          )}
        </ScrollView>

        {/* 제출을 마친 작업·쓸 수 없는 작업은 작성할 보고가 없다 */}
        <ReportJumpAnchor
          visible={showJump && writable}
          onPress={jumpToReport}
        />
      </KeyboardAvoidingArea>

      {result && <ResultModal visible result={result} onConfirm={onDone} />}
    </SafeAreaView>
  );
}

const lockedNotices: Partial<Record<WorkStatusCode, string>> = {
  ACCEPTED: '작업을 시작하면 완료 보고를 쓸 수 있어요',
  PENDING_ACCEPT: '수락하고 작업을 시작하면 완료 보고를 쓸 수 있어요',
  CANCELED: '취소된 작업이라 완료 보고를 쓸 수 없어요',
};
const LOCKED_NOTICE = '완료 보고를 쓸 수 없는 작업이에요';

// 작업중이 아닌 작업의 보고 영역 자리. 작업전이면 여기서 바로 시작한다 (홈 진행할 작업 카드의 "작업 시작" 과 같은 동작).
// Figma 에 없어 기존 컴포넌트로 최소 구성한 기본안이다 (Figma 미확인)
function ReportLocked({
  workStatus,
  onStartWork,
}: {
  workStatus: WorkStatusCode;
  onStartWork?: () => void | Promise<void>;
}) {
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const start = async () => {
    if (startingRef.current || !onStartWork) {
      return;
    }
    startingRef.current = true;
    setStarting(true);
    try {
      await onStartWork();
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  return (
    <View testID="work-report-locked" style={styles.locked}>
      <Text
        variant="Body/XS/Medium"
        color={colors.gray[600]}
        style={styles.lockedText}
      >
        {lockedNotices[workStatus] ?? LOCKED_NOTICE}
      </Text>
      {workStatus === 'ACCEPTED' && onStartWork && (
        <CTA
          size="M"
          variant="brand"
          label="작업 시작"
          disabled={starting}
          onPress={start}
          style={styles.lockedStart}
        />
      )}
    </View>
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
  content: { paddingBottom: 32 },
  // Figma 3235:16453: 결제 정보 아래 20, Caption/M/Medium Gray500 가운데
  notice: { marginTop: 20, textAlign: 'center' },
  paymentFields: { gap: 12 },
  locked: { gap: 16, paddingHorizontal: 24, paddingTop: 32 },
  lockedText: { textAlign: 'center' },
  lockedStart: { minHeight: 48 },
  // Figma 3235:16454: 안내 아래 24 에 흰 바(102), 그 안 위 14 에 버튼 → 38. 아래는 content 의 32
  submit: { marginHorizontal: 24, marginTop: 38 },
});
