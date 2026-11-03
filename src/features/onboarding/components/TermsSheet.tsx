import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native';
import { BottomSheet, colors, CTA, Text } from '../../../shared/design-system';
import {
  allTermsAgreed,
  termsList,
  toggleAllTerms,
  toggleTerm,
  type Terms,
  type TermsAgreement,
  type TermsType,
} from '../model';
import { AgreeAllCheckbox, TermsCheck } from './TermsChecks';

// Figma 약관 동의 시트 (3569:7702 미체크 / 3569:7797 체크). 약관마다 이름과 본문 상자(스크롤)를 보여 준다.
// '확인' 은 전체 동의일 때만 켜지고, 누르면 시트의 체크를 화면에 반영한다 (기본안, 디자인 확인 항목)
export function TermsSheet({
  visible,
  focusType,
  draft,
  onChange,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  /** 화면에서 > 를 누른 약관. 열리면 그 약관이 보이게 스크롤한다 */
  focusType: TermsType | null;
  /** 시트에서 고친 체크. 연 순간의 화면 체크에서 시작한다 */
  draft: TermsAgreement;
  onChange: Dispatch<SetStateAction<TermsAgreement>>;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const allAgreed = allTermsAgreed(draft);
  // TermsCheck 가 memo 라 체크가 바뀔 때마다 다섯 행을 다 그리지 않게 이전 값으로 바꾼다
  const toggle = useCallback(
    (terms: Terms) => onChange(current => toggleTerm(current, terms.type)),
    [onChange],
  );
  const toggleAll = useCallback(() => onChange(toggleAllTerms), [onChange]);

  // 열릴 때 한 번, 누른 약관의 자리(약관 목록 위치 + 그 안의 위치)로 스크롤한다. 자리는 레이아웃으로만 알 수 있어
  // 두 값이 모두 온 순간에 옮기고, 다시 그리지 않게 ref 에 둔다. 시트가 닫히면 다음에 열 때 다시 옮긴다
  const scrollRef = useRef<ScrollViewInstance>(null);
  const positions = useRef<{
    items?: number;
    rows: Partial<Record<TermsType, number>>;
    scrolled: boolean;
  }>({ rows: {}, scrolled: false });
  useEffect(() => {
    if (!visible) {
      positions.current = { rows: {}, scrolled: false };
    }
  }, [visible]);
  const scrollToFocus = () => {
    const { items, rows, scrolled } = positions.current;
    const row = focusType === null ? undefined : rows[focusType];
    if (scrolled || items === undefined || row === undefined) {
      return;
    }
    positions.current.scrolled = true;
    scrollRef.current?.scrollTo({ y: items + row, animated: false });
  };
  const layoutItems = (event: LayoutChangeEvent) => {
    positions.current.items = event.nativeEvent.layout.y;
    scrollToFocus();
  };
  const layoutRow = (type: TermsType) => (event: LayoutChangeEvent) => {
    positions.current.rows[type] = event.nativeEvent.layout.y;
    scrollToFocus();
  };

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
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        // 본문 상자도 스크롤한다 (Android 는 겹친 스크롤을 켜야 안쪽이 먼저 받는다)
        nestedScrollEnabled
      >
        <View style={styles.allRow}>
          <AgreeAllCheckbox
            label="전체 동의"
            checked={allAgreed}
            onPress={toggleAll}
            variant="Body/XS/Medium"
            color={colors.gray[900]}
          />
        </View>
        <View
          onLayout={layoutItems}
          style={styles.items}
          testID="terms-sheet-items"
        >
          {termsList.map(terms => (
            <View
              key={terms.type}
              onLayout={layoutRow(terms.type)}
              style={styles.item}
              testID={`terms-sheet-${terms.type}`}
            >
              <TermsCheck
                terms={terms}
                title={terms.sheetTitle}
                checked={draft[terms.type]}
                onToggle={toggle}
                color={colors.gray[900]}
                gap={8}
              />
              <ScrollView
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
