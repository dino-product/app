import {
  useCallback,
  type Dispatch,
  type Ref,
  type SetStateAction,
} from 'react';
import { ScrollView, StyleSheet, View, type TextInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, CTA, Text } from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import {
  STANDALONE_SCREEN_EDGES,
  standaloneScreen,
} from '../../../shared/layout/standaloneScreen';
import { SubScreenHeader } from '../../my/components/SubScreenHeader';
import { AgreeAllCheckbox, TermsRow } from '../components/TermsChecks';
import {
  ALL_TERMS_TYPES,
  allTermsAgreed,
  canSignUp,
  noTermsAgreed,
  termsList,
  type Terms,
  type TermsAgreement,
  type TermsType,
} from '../model';

// Figma 약관 동의 (3284:22327 빈 / 3278:19869 전체 체크). 필수 네 개에 모두 동의해야 '가입하기' 가 켜진다.
// 약관 행을 누르면 동의를 바꾸지 않고 그 약관 상세(Figma 약관 상세 페이지 51019:16927)를 연다. 동의는 상세의 라디오로 한다 (#193).
// '모든 약관에 동의합니다' 는 모두 동의한 채로 모든 약관 상세를 연다(모두 동의돼 있으면 모두 끈다).
// 동의 상태는 경로가 들고 있다: 약관 상세(다른 경로)에서 고른 라디오가 이 화면의 체크가 된다
export function TermsAgreementScreen({
  agreement,
  onChangeAgreement,
  onOpenTerms,
  submitting = false,
  onBack,
  onSignUp,
  titleRef,
}: {
  agreement: TermsAgreement;
  onChangeAgreement: Dispatch<SetStateAction<TermsAgreement>>;
  /** 약관 상세를 연다. 행은 그 약관 하나, 전체 동의는 모든 약관 (행 순서) */
  onOpenTerms: (types: readonly TermsType[]) => void;
  /** 서버에 동의를 보내는 동안 '가입하기' 를 끈다 */
  submitting?: boolean;
  onBack: () => void;
  /** 가입하기. 동의한 약관을 넘긴다 (바깥이 POST /terms-agreements 로 보낸다) */
  onSignUp: (agreement: TermsAgreement) => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const allAgreed = allTermsAgreed(agreement);
  // TermsRow 가 memo 라 렌더마다 새로 만들지 않는다
  const openTerms = useCallback(
    (terms: Terms) => onOpenTerms([terms.type]),
    [onOpenTerms],
  );
  const agreeAll = () => {
    if (allAgreed) {
      onChangeAgreement(noTermsAgreed);
      return;
    }
    onChangeAgreement(everyTermsAgreed);
    onOpenTerms(ALL_TERMS_TYPES);
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
            <AgreeAllCheckbox checked={allAgreed} onPress={agreeAll} />
          </View>
          <View style={styles.divider} />
          <View style={styles.rows}>
            {termsList.map(terms => (
              <TermsRow
                key={terms.type}
                terms={terms}
                agreed={agreement[terms.type]}
                onOpen={openTerms}
              />
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
    </SafeAreaView>
  );
}

const everyTermsAgreed: TermsAgreement = {
  SERVICE: true,
  PRIVACY: true,
  THIRD_PARTY: true,
  LOCATION: true,
  MARKETING: true,
};

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
});
