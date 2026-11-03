import { memo, type Ref } from 'react';
import { ScrollView, StyleSheet, View, type TextInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Text } from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import { MenuRow } from '../components/MenuRow';
import { SubScreenHeader } from '../components/SubScreenHeader';

// Figma 마이페이지-약관 (2889:13917)
export type TermsLinks = {
  terms: string;
  privacy: string;
  openSource: string;
};

export function TermsScreen({
  links,
  appVersion,
  onOpenLink,
  onBack,
  titleRef,
}: {
  /** 비어 있으면(주소가 아직 없음) 그 행을 비활성으로 둔다 */
  links: TermsLinks;
  appVersion: string;
  onOpenLink: (url: string) => void;
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader
        title="약관 및 앱 정보"
        onBack={onBack}
        titleRef={titleRef}
      />
      <ScrollView {...noOverscroll} contentContainerStyle={styles.content}>
        <View style={[readableColumn, styles.section]}>
          <Text accessibilityRole="header" variant="Body/S/SemiBold">
            약관 및 정책
          </Text>
          <LinkRow
            label="서비스 이용약관"
            url={links.terms}
            onOpenLink={onOpenLink}
          />
          <LinkRow
            label="개인정보 처리방침"
            url={links.privacy}
            onOpenLink={onOpenLink}
          />
          <LinkRow
            label="오픈소스 라이선스"
            url={links.openSource}
            onOpenLink={onOpenLink}
          />
        </View>

        <View style={styles.band} />

        <View style={[readableColumn, styles.section]}>
          <Text accessibilityRole="header" variant="Body/S/SemiBold">
            앱 정보
          </Text>
          <View style={styles.versionRow}>
            <Text variant="Body/XS/Medium" color={colors.gray[700]}>
              현재 버전 {appVersion}
            </Text>
            {/* 스토어 최신 버전과 비교하는 판정은 별도 티켓이다. 지금은 Figma 대로 표시만 한다 */}
            <Text variant="Caption/M/Medium" color={colors.secondary}>
              최신 버전
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// 주소가 비어 있으면(아직 정해지지 않음) 비활성 행이다
const LinkRow = memo(function MyLinkRow({
  label,
  url,
  onOpenLink,
}: {
  label: string;
  url: string;
  onOpenLink: (url: string) => void;
}) {
  return (
    <MenuRow
      label={label}
      tone="muted"
      disabled={url === ''}
      onPress={() => onOpenLink(url)}
    />
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  content: { paddingTop: 8, paddingBottom: 24 },
  section: { gap: 12, paddingHorizontal: 24 },
  // 약관과 앱 정보 사이 두꺼운 회색 띠는 화면 끝까지 칠한다
  band: {
    height: 12,
    marginTop: 12,
    marginBottom: 16,
    backgroundColor: colors.background[3],
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.background[3],
  },
});
