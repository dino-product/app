import { memo, type Ref } from 'react';
import {
  SectionList,
  StyleSheet,
  View,
  type SectionListData,
  type SectionListRenderItem,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Text } from '../../../shared/design-system';
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { SubScreenHeader } from '../components/SubScreenHeader';
import {
  licenseTexts,
  OPEN_SOURCE_INTRO,
  openSourceGroups,
  type OpenSourceComponent,
} from '../licenses/openSourceNotices';

// 마이 › 약관 및 앱 정보 › 오픈소스 라이선스 (#232). 앱에 실은 고지 문서(features/my/licenses)를 읽기만 한다.
// Figma 마이페이지-약관(2889:13917)에 이 행은 있지만 상세 프레임은 없어, 마이 하위 화면 머리(제목 가운데)에
// 약관 상세(51019:16927)의 본문 글 스타일을 쓴다. 표는 폭이 좁아 항목마다 이름 · 버전·라이선스 · 저작권 세 줄로 보인다.
// 항목·문단이 200 개 가까워 SectionList 로 그린다 (docs/performance.md 리스트 규칙)

type Item =
  | { kind: 'component'; component: OpenSourceComponent }
  | { kind: 'paragraph'; text: string };

export type LicenseSection = {
  /** group: 표 묶음 제목, lead: '라이선스 전문' 큰 제목(항목 없음), license: 라이선스 하나의 전문 */
  kind: 'group' | 'lead' | 'license';
  title: string;
  data: readonly Item[];
};

export const LICENSE_TEXTS_TITLE = '라이선스 전문';

/** 화면 목록 구성. 고지 내용이 정해진 상수라 한 번만 만든다 */
export const licenseSections: readonly LicenseSection[] = [
  ...openSourceGroups.map<LicenseSection>(group => ({
    kind: 'group',
    title: group.title,
    data: group.components.map(component => ({
      kind: 'component',
      component,
    })),
  })),
  { kind: 'lead', title: LICENSE_TEXTS_TITLE, data: [] },
  ...licenseTexts.map<LicenseSection>(text => ({
    kind: 'license',
    title: text.title,
    data: text.paragraphs.map(paragraph => ({
      kind: 'paragraph',
      text: paragraph,
    })),
  })),
];

export function OpenSourceLicensesScreen({
  onBack,
  titleRef,
}: {
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader
        title="오픈소스 라이선스"
        onBack={onBack}
        titleRef={titleRef}
      />
      <SectionList<Item, LicenseSection>
        {...noOverscroll}
        sections={licenseSections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={Intro}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[readableColumn, styles.content]}
      />
    </SafeAreaView>
  );
}

const keyExtractor = (item: Item, index: number) =>
  item.kind === 'component' ? item.component.name : String(index);

const renderItem: SectionListRenderItem<Item, LicenseSection> = ({ item }) =>
  item.kind === 'component' ? (
    <ComponentRow component={item.component} />
  ) : (
    <Paragraph text={item.text} />
  );

const renderSectionHeader = ({
  section,
}: {
  section: SectionListData<Item, LicenseSection>;
}) => <SectionHeader kind={section.kind} title={section.title} />;

function Intro() {
  return (
    <Text variant="Caption/S/Medium" color={colors.gray[600]}>
      {OPEN_SOURCE_INTRO}
    </Text>
  );
}

/** 묶음 제목은 약관 및 앱 정보의 '약관 및 정책' 과 같은 글, '라이선스 전문' 은 한 단계 큰 글, 라이선스 이름은 항목 이름과 같은 굵기 */
function SectionHeader({
  kind,
  title,
}: {
  kind: LicenseSection['kind'];
  title: string;
}) {
  if (kind === 'lead') {
    return (
      <View>
        <View style={styles.divider} />
        <Text
          accessibilityRole="header"
          variant="Body/XL/SemiBold"
          color={colors.gray[900]}
        >
          {title}
        </Text>
      </View>
    );
  }
  return (
    <Text
      accessibilityRole="header"
      variant={kind === 'group' ? 'Body/S/SemiBold' : 'Body/XS/SemiBold'}
      color={colors.gray[900]}
      style={kind === 'group' ? styles.groupTitle : styles.licenseTitle}
    >
      {title}
    </Text>
  );
}

/** 표 한 줄: 이름 / 버전 · 라이선스 / 저작권. 스크린리더는 한 덩어리로 읽는다 */
const ComponentRow = memo(function OpenSourceComponentRow({
  component,
}: {
  component: OpenSourceComponent;
}) {
  const { name, version, license, copyright } = component;
  return (
    <View accessible style={styles.component}>
      <Text variant="Body/XS/SemiBold" color={colors.gray[900]}>
        {name}
      </Text>
      <Text variant="Caption/S/Medium" color={colors.gray[600]}>
        {version === '-' ? license : `${version} · ${license}`}
      </Text>
      <Text variant="Caption/S/Medium" color={colors.libraryGray[500]}>
        {copyright}
      </Text>
    </View>
  );
});

const Paragraph = memo(function LicenseParagraph({ text }: { text: string }) {
  return (
    <Text
      variant="Caption/S/Medium"
      color={colors.gray[600]}
      style={styles.paragraph}
    >
      {text}
    </Text>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.gray[0] },
  // 마이 하위 화면처럼 머리 아래 8, 좌우 24. 끝은 약관 상세처럼 40 띄운다
  content: { paddingTop: 8, paddingHorizontal: 24, paddingBottom: 40 },
  // 묶음 사이 32, 제목 아래 첫 항목까지 4 (+ 항목 위 12)
  groupTitle: { marginTop: 32, marginBottom: 4 },
  component: { gap: 2, marginTop: 12 },
  // 표와 전문 사이는 약관 상세의 약관 사이처럼 위아래 40 에 구분선
  divider: {
    height: 1,
    marginVertical: 40,
    backgroundColor: colors.inputDisabled,
  },
  licenseTitle: { marginTop: 32 },
  // 약관 상세 문단 간격 8
  paragraph: { marginTop: 8 },
});
