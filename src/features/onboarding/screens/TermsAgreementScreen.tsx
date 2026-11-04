import { useCallback, useState, type Ref } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
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
import { readableColumn } from '../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import {
  STANDALONE_SCREEN_EDGES,
  standaloneScreen,
} from '../../../shared/layout/standaloneScreen';
import { SubScreenHeader } from '../../my/components/SubScreenHeader';
import { AgreeAllCheckbox, TermsCheck } from '../components/TermsChecks';
import { TermsSheet } from '../components/TermsSheet';
import {
  allTermsAgreed,
  canSignUp,
  noTermsAgreed,
  requiredLabel,
  termsList,
  toggleAllTerms,
  toggleTerm,
  type Terms,
  type TermsAgreement,
  type TermsType,
} from '../model';

// Figma 약관 동의 (3284:22327 빈 / 3278:19869 전체 체크). 필수 네 개에 모두 동의해야 '가입하기' 가 켜진다.
// 행의 > 를 누르면 약관 시트를 연다 (Figma 에 연결이 없어 기본안, 디자인 확인 항목)
export function TermsAgreementScreen({
  submitting = false,
  onBack,
  onSignUp,
  titleRef,
}: {
  /** 서버에 동의를 보내는 동안 '가입하기' 를 끈다 */
  submitting?: boolean;
  onBack: () => void;
  /** 가입하기. 동의한 약관을 넘긴다 (바깥이 POST /terms-agreements 로 보낸다) */
  onSignUp: (agreement: TermsAgreement) => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const [agreement, setAgreement] = useState(noTermsAgreed);
  const [sheetOpen, setSheetOpen] = useState(false);
  // > 를 누른 약관. 시트가 그 약관이 보이게 열린다
  const [focusType, setFocusType] = useState<TermsType | null>(null);
  // 시트에서 고치는 체크. 열 때 화면 체크로 시작하고, '확인' 을 눌러야 화면에 반영한다
  const [draft, setDraft] = useState(noTermsAgreed);

  // TermsCheck 가 memo 라 렌더마다 새로 만들지 않는다
  const toggle = useCallback(
    (terms: Terms) => setAgreement(current => toggleTerm(current, terms.type)),
    [],
  );
  const openSheet = (type: TermsType) => {
    setDraft(agreement);
    setFocusType(type);
    setSheetOpen(true);
  };
  const confirmSheet = () => {
    setAgreement(draft);
    setSheetOpen(false);
  };

  return (
    <SafeAreaView
      edges={STANDALONE_SCREEN_EDGES}
      style={standaloneScreen.screen}
    >
      <SubScreenHeader onBack={onBack} />

      <ScrollView
        {...noOverscroll}
        contentContainerStyle={[readableColumn, styles.content]}
      >
        <Text
          ref={titleRef}
          accessibilityRole="header"
          accessibilityLabel="서비스 이용을 위해 동의가 필요해요"
          variant="Body/L/Bold"
        >
          {'서비스 이용을 위해\n동의가 필요해요'}
        </Text>

        <View style={styles.agreements}>
          <View style={styles.allRow}>
            <AgreeAllCheckbox
              label="모든 약관에 동의합니다."
              checked={allTermsAgreed(agreement)}
              onPress={() => setAgreement(toggleAllTerms)}
              variant="Body/S/SemiBold"
              color={colors.gray[800]}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.rows}>
            {termsList.map(terms => (
              <View key={terms.type} style={styles.row}>
                <TermsCheck
                  terms={terms}
                  title={terms.title}
                  checked={agreement[terms.type]}
                  onToggle={toggle}
                  color={colors.gray[600]}
                  gap={4}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${terms.title} ${requiredLabel(
                    terms,
                  )} 보기`}
                  hitSlop={ICON_HIT_SLOP}
                  onPress={() => openSheet(terms.type)}
                  style={styles.more}
                >
                  <Icon
                    name="chevron-right-line"
                    color={colors.inputDisabled}
                  />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[readableColumn, standaloneScreen.actions]}>
        <CTA
          label="가입하기"
          onPress={() => onSignUp(agreement)}
          disabled={!canSignUp(agreement) || submitting}
        />
      </View>

      <TermsSheet
        visible={sheetOpen}
        focusType={focusType}
        draft={draft}
        onChange={setDraft}
        onClose={() => setSheetOpen(false)}
        onConfirm={confirmSheet}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 머리 아래 22 에 제목, 제목 아래 54 에 약관 (Figma 위치 132·248)
  content: {
    gap: 54,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 24,
  },
  agreements: { gap: 24 },
  allRow: { flexDirection: 'row' },
  divider: { height: 1, backgroundColor: colors.inputDisabled },
  // Figma 는 행 20 에 간격 24 이고 체크 표시(24)가 위아래로 2씩 넘친다. 행을 체크 표시 높이로 두고 간격 20 으로
  // 같은 44 간격을 맞춘다. 높이를 묶지 않아 큰 글자로 이름이 두 줄이 돼도 옆 행과 겹치지 않는다
  rows: { gap: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // 화살표 선이 행 오른쪽 끝에서 5 안쪽에 오도록 아이콘 틀(24)을 바깥으로 민다
  more: { marginRight: -4 },
});
