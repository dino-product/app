import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BottomSheet, colors, CTA, Text } from '../../../shared/design-system';
import {
  allTermsAgreed,
  termsList,
  toggleAllTerms,
  toggleTerm,
  type Terms,
  type TermsAgreement,
} from '../model';
import { AgreeAllCheckbox, TermsCheck } from './TermsChecks';

// Figma 약관 동의 시트 (3569:7702 미체크 / 3569:7797 체크). 약관마다 이름과 본문 상자(스크롤)를 보여 준다.
// '확인' 은 전체 동의일 때만 켜지고, 누르면 시트의 체크를 화면에 반영한다 (기본안, 디자인 확인 항목)
export function TermsSheet({
  visible,
  draft,
  onChange,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  /** 시트에서 고친 체크. 연 순간의 화면 체크에서 시작한다 */
  draft: TermsAgreement;
  onChange: (draft: TermsAgreement) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const allAgreed = allTermsAgreed(draft);
  const toggle = useCallback(
    (terms: Terms) => onChange(toggleTerm(draft, terms.type)),
    [draft, onChange],
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="document"
      testID="terms-sheet"
    >
      <View style={styles.titleRow}>
        <Text
          accessibilityRole="header"
          variant="Body/S/SemiBold"
          color={colors.gray[900]}
          style={styles.title}
        >
          약관 동의
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        // 본문 상자도 스크롤한다 (Android 는 겹친 스크롤을 켜야 안쪽이 먼저 받는다)
        nestedScrollEnabled
      >
        <View style={styles.allRow}>
          <AgreeAllCheckbox
            label="전체 동의"
            checked={allAgreed}
            onPress={() => onChange(toggleAllTerms(draft))}
            variant="Body/XS/Medium"
            color={colors.gray[900]}
          />
        </View>
        <View style={styles.items}>
          {termsList.map(terms => (
            <View key={terms.type} style={styles.item}>
              <TermsCheck
                terms={terms}
                title={terms.sheetTitle}
                checked={draft[terms.type]}
                onToggle={toggle}
                color={colors.gray[900]}
                gap={8}
              />
              <ScrollView
                accessibilityLabel={`${terms.sheetTitle} 본문`}
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                nestedScrollEnabled
              >
                <Text
                  variant="Caption/S/Medium"
                  color={colors.libraryGray[500]}
                  style={styles.bodyText}
                >
                  {terms.body}
                </Text>
              </ScrollView>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <CTA
          variant="outline"
          label="닫기"
          onPress={onClose}
          style={styles.action}
        />
        <CTA
          label="확인"
          onPress={onConfirm}
          disabled={!allAgreed}
          style={styles.action}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // 라이브러리 텍스트 스타일 Body L/SemiBold 는 18·행간 140% 에 자간 0 이다 (로컬 Body/S/SemiBold 는 자간 -2.5%)
  title: { letterSpacing: 0 },
  titleRow: { alignItems: 'center', paddingHorizontal: 16 },
  // 시트 칸 사이 12 (Figma Bottom Sheet gap). 내용은 369 높이에서 스크롤한다
  scroll: { height: 369, marginTop: 12 },
  content: { gap: 16, paddingHorizontal: 24 },
  allRow: { paddingRight: 12 },
  items: { gap: 12 },
  item: { gap: 8 },
  body: {
    height: 182,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.libraryGray[200],
  },
  bodyContent: { padding: 16 },
  // Figma 본문은 텍스트 스타일 없이 Medium 12·자간 -2.5% 에 행간 150% 다 (Caption/S/Medium 은 140%)
  bodyText: { lineHeight: 18 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    paddingHorizontal: 24,
  },
  action: { flex: 1 },
});
