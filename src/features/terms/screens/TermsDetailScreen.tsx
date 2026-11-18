import { memo, useCallback, useMemo, type Ref } from 'react';
import {
  SectionList,
  StyleSheet,
  View,
  type SectionListData,
  type SectionListRenderItem,
  type TextInstance,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  colors,
  Radio,
  Skeleton,
  SkeletonLine,
  Text,
} from '../../../shared/design-system';
import { LoadStateView } from '../../../shared/layout/LoadStateView';
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { SubScreenHeader } from '../../my/components/SubScreenHeader';
import type { TermsDocument } from '../documents';
import { useTermsDocuments, type TermsDocumentState } from '../termsQueries';
import type { TermsBlock } from '../termsText';

// Figma 약관 상세 페이지 (51019:16927). 뒤로 가기만 있는 머리 아래에 큰 제목, (있으면) 안내, 원격 전문을 보인다 (#192).
// 전문은 '제N조' 를 글머리표 줄로, 그 아래 글을 18 들여 쓴다. 받는 동안은 본문 자리에 스켈레톤, 실패하면 다시 시도.
// 여러 약관을 한 페이지에 차례로 보일 수 있다 (가입 약관 '모두 동의', #193). 본문 덩어리는 길이가 가변이라 SectionList 로 그린다.
// 가입 약관은 전문 아래에 '동의합니다'·'동의하지 않습니다' 라디오(디자인 시스템)를 둔다 (#193, Figma 에 없는 자리라 기본안)

export type TermsDetailSection = {
  /** 약관을 가리키는 키 (가입: TermsType, 마이: MyPageTerms) */
  key: string;
  /** 큰 제목. 가입은 '(필수) 서비스 이용약관' 처럼 앞에 필수·선택을 붙인다 */
  title: string;
  /** 원격 전문. null 이면 전문이 없어 준비 중 안내를 보인다 */
  document: TermsDocument | null;
  /** 제목 아래 안내 (Figma 는 서비스 이용약관에만 있다) */
  intro?: string;
};

export const TERMS_UNAVAILABLE = '약관 전문을 준비하고 있어요.';

type PendingState = Exclude<TermsDocumentState, { status: 'ready' }>;
type Item = TermsBlock | { kind: 'state'; state: PendingState };
type Section = TermsDetailSection & { index: number; data: readonly Item[] };

export const AGREE_LABEL = '동의합니다';
export const DISAGREE_LABEL = '동의하지 않습니다';

export function TermsDetailScreen({
  sections,
  agreement,
  onAgreeChange,
  standalone = false,
  onBack,
  titleRef,
}: {
  /** 보일 약관. 같은 배열을 주어야(상수·useMemo) 전문 상태를 다시 만들지 않는다 */
  sections: readonly TermsDetailSection[];
  /** 약관(key)마다 동의 상태. 주면 전문 아래에 동의 라디오를 둔다 (가입 약관). 없으면 읽기만 한다 (마이 › 약관) */
  agreement?: Readonly<Record<string, boolean>>;
  /** 라디오로 고른 동의 상태 */
  onAgreeChange?: (key: string, agreed: boolean) => void;
  /** 하단 탭 없이 열리면(온보딩) 아래 안전 영역만큼 본문 끝을 띄운다 */
  standalone?: boolean;
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 첫 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const documents = useMemo(
    () => sections.map(section => section.document),
    [sections],
  );
  const states = useTermsDocuments(documents);
  const listSections = useMemo<Section[]>(
    () =>
      sections.map((section, index) => {
        const state = states[index];
        return {
          ...section,
          index,
          data:
            state.status === 'ready'
              ? state.blocks
              : [{ kind: 'state', state }],
        };
      }),
    [sections, states],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<Item, Section> }) => (
      <SectionHeader
        section={section}
        titleRef={section.index === 0 ? titleRef : undefined}
      />
    ),
    [titleRef],
  );

  const renderSectionFooter = useCallback(
    ({ section }: { section: SectionListData<Item, Section> }) =>
      agreement === undefined || onAgreeChange === undefined ? null : (
        <AgreementRadios
          termsKey={section.key}
          title={section.title}
          agreed={agreement[section.key] ?? false}
          onChange={onAgreeChange}
        />
      ),
    [agreement, onAgreeChange],
  );

  const insets = useSafeAreaInsets();
  const bottom = standalone ? insets.bottom : 0;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader onBack={onBack} />
      <SectionList<Item, Section>
        {...noOverscroll}
        sections={listSections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[
          readableColumn,
          styles.content,
          { paddingBottom: CONTENT_BOTTOM + bottom },
        ]}
      />
    </SafeAreaView>
  );
}

const keyExtractor = (_item: Item, index: number) => String(index);

const renderItem: SectionListRenderItem<Item, Section> = ({
  item,
  index,
  section,
}) =>
  item.kind === 'state' ? (
    <PendingBody sectionKey={section.key} state={item.state} />
  ) : (
    <BlockRow block={item} first={index === 0} />
  );

/** 큰 제목과 안내. 두 번째 약관부터는 위에 구분선을 둔다 */
function SectionHeader({
  section,
  titleRef,
}: {
  section: Section;
  titleRef?: Ref<TextInstance>;
}) {
  return (
    <View>
      {section.index > 0 && <View style={styles.divider} />}
      <Text
        ref={titleRef}
        accessibilityRole="header"
        variant="Body/XL/SemiBold"
        color={colors.gray[900]}
      >
        {section.title}
      </Text>
      {section.intro !== undefined && (
        <Text
          variant="Caption/S/Medium"
          color={colors.libraryGray[500]}
          style={styles.intro}
        >
          {section.intro}
        </Text>
      )}
    </View>
  );
}

/**
 * 전문 아래 동의 라디오. 동의하지 않았으면 '동의하지 않습니다' 가 골라져 있다.
 * VoiceOver 는 묶음(radiogroup) 이름을 읽지 않아, 라디오 이름에 약관 제목을 붙인다 ('… 서비스 이용약관, 동의합니다')
 */
const AgreementRadios = memo(function TermsAgreementRadios({
  termsKey,
  title,
  agreed,
  onChange,
}: {
  termsKey: string;
  title: string;
  agreed: boolean;
  onChange: (key: string, agreed: boolean) => void;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={`${title} 동의 여부`}
      style={styles.radios}
      testID={`terms-agreement-${termsKey}`}
    >
      <Radio
        label={AGREE_LABEL}
        accessibilityLabel={`${title}, ${AGREE_LABEL}`}
        checked={agreed}
        onPress={() => onChange(termsKey, true)}
      />
      <Radio
        label={DISAGREE_LABEL}
        accessibilityLabel={`${title}, ${DISAGREE_LABEL}`}
        checked={!agreed}
        onPress={() => onChange(termsKey, false)}
      />
    </View>
  );
});

/** 전문 덩어리 하나. 조 제목은 글머리표 줄, 조 아래 글은 18 들여 쓴다 */
const BlockRow = memo(function TermsBlockRow({
  block,
  first,
}: {
  block: TermsBlock;
  first: boolean;
}) {
  if (block.kind === 'article') {
    return (
      <View
        style={[styles.article, first ? styles.firstGap : styles.articleGap]}
      >
        <Text
          accessible={false}
          importantForAccessibility="no"
          variant="Caption/S/Medium"
          color={colors.gray[600]}
          style={styles.bullet}
        >
          •
        </Text>
        <Text
          variant="Caption/S/Medium"
          color={colors.gray[600]}
          style={styles.flexText}
        >
          {block.text}
        </Text>
      </View>
    );
  }
  return (
    <Text
      variant="Caption/S/Medium"
      color={colors.gray[600]}
      style={[
        styles.body,
        first ? styles.firstGap : styles.paragraphGap,
        block.indented && styles.indented,
      ]}
    >
      {block.text}
    </Text>
  );
});

/** 전문 자리: 받는 중(스켈레톤) · 실패(다시 시도) · 전문 없음(준비 중) */
function PendingBody({
  sectionKey,
  state,
}: {
  sectionKey: string;
  state: PendingState;
}) {
  if (state.status === 'unavailable') {
    return (
      <Text
        variant="Caption/S/Medium"
        color={colors.gray[600]}
        style={[styles.body, styles.firstGap]}
      >
        {TERMS_UNAVAILABLE}
      </Text>
    );
  }
  return (
    <View style={[styles.body, styles.firstGap]}>
      <LoadStateView
        state={state}
        style={styles.failed}
        skeleton={<BodySkeleton testID={`terms-skeleton-${sectionKey}`} />}
      />
    </View>
  );
}

// 전문 자리를 닮은 줄: 조 제목 한 줄과 들여 쓴 본문 세 줄을 두 번
const SKELETON_ROWS = [
  { key: 'a1', article: true, width: '30%' },
  { key: 'a1-1', article: false, width: '100%' },
  { key: 'a1-2', article: false, width: '100%' },
  { key: 'a1-3', article: false, width: '60%' },
  { key: 'a2', article: true, width: '40%' },
  { key: 'a2-1', article: false, width: '100%' },
  { key: 'a2-2', article: false, width: '100%' },
  { key: 'a2-3', article: false, width: '75%' },
] as const;

function BodySkeleton({ testID }: { testID: string }) {
  return (
    <Skeleton testID={testID}>
      {SKELETON_ROWS.map((row, index) => (
        <SkeletonLine
          key={row.key}
          variant="Caption/S/Medium"
          width={row.width}
          style={
            row.article
              ? index > 0 && styles.articleGap
              : [styles.paragraphGap, styles.skeletonIndented]
          }
        />
      ))}
    </Skeleton>
  );
}

// 본문 끝 아래 여백
const CONTENT_BOTTOM = 40;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.gray[0] },
  // 머리 아래 22 에 제목 (Figma 위치 132). 가입 약관 제목(3284:22332, 같은 y132)과 같은 자리라 오갈 때 튀지 않는다
  // (가입 단계 화면 관례: TermsAgreementScreen·OrgJoinScreen). 제목은 24, 안내·본문은 25 에서 시작해 오른쪽 24 에서 끝난다
  content: { paddingTop: 22, paddingHorizontal: 24 },
  // 제목 아래 81 에 안내 (Figma 제목 132+34 → 안내 247), 폭 309
  intro: { marginTop: 81, marginLeft: 1, maxWidth: 309 },
  body: { marginLeft: 1 },
  // 안내(또는 제목) 아래 32 에 본문 (Figma 안내 247+68 → 본문 347)
  firstGap: { marginTop: 32 },
  article: { flexDirection: 'row', marginLeft: 1 },
  // 조 사이 16, 조 제목과 그 글 사이 8 (Figma Group 간격 16, 글 위치 +25 = 줄 17 + 8)
  articleGap: { marginTop: 16 },
  paragraphGap: { marginTop: 8 },
  // 글머리표는 들여 쓴 18 자리 가운데에 둔다 (Figma list-disc, 들여쓰기 18)
  bullet: { width: 18, textAlign: 'center' },
  flexText: { flex: 1 },
  indented: { marginLeft: 1 + 18 },
  skeletonIndented: { marginLeft: 18 },
  failed: { paddingHorizontal: 0, paddingVertical: 40 },
  // 본문 아래 32 에 라디오 두 개를 가로로 (본문 시작과 같은 25)
  radios: { flexDirection: 'row', gap: 24, marginTop: 32, marginLeft: 1 },
  // 여러 약관이면 앞 약관 끝 아래 40 에 구분선, 그 아래 40 에 다음 제목
  divider: {
    height: 1,
    marginVertical: 40,
    backgroundColor: colors.inputDisabled,
  },
});
