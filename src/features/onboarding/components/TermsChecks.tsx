import { memo } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { colors, Icon, Text, touchSlop } from '../../../shared/design-system';
import { requiredLabel, type Terms } from '../model';

// 가입 약관 화면의 체크 (Figma 3284:22327). Check Box(22, 전체 동의)와 Check(24, 약관 하나). 켜지면 Secondary, 꺼지면 Gray300 이다

/** 전체 동의: 네모 체크박스 + 글자 (Figma 3284:22327 '모든 약관에 동의합니다.') */
export const AgreeAllCheckbox = memo(function OnboardingAgreeAllCheckbox({
  checked,
  onPress,
}: {
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={CHECK_BOX_SLOP}
      onPress={onPress}
      style={styles.allRow}
    >
      <Icon
        name="check-box"
        color={checked ? colors.secondary : colors.gray[300]}
      />
      <Text variant="Body/S/SemiBold" color={colors.gray[800]}>
        모든 약관에 동의합니다.
      </Text>
    </Pressable>
  );
});

export const TERMS_AGREED = '동의함';
export const TERMS_NOT_AGREED = '동의 안 함';

/**
 * 약관 행: 체크 표시 + 이름 + (필수)·(선택), 오른쪽 끝에 >. (필수) 만 Secondary 다.
 * 행 전체가 그 약관 상세를 여는 버튼이고(#193), 체크 표시는 동의 상태를 보인다 (동의는 상세의 라디오로 한다).
 * 스크린리더는 "서비스 이용약관 (필수), 동의 안 함, 버튼" 처럼 읽는다
 */
export const TermsRow = memo(function OnboardingTermsRow({
  terms,
  agreed,
  onOpen,
}: {
  terms: Terms;
  agreed: boolean;
  onOpen: (terms: Terms) => void;
}) {
  const tag = requiredLabel(terms);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${terms.title} ${tag}`}
      accessibilityValue={{ text: agreed ? TERMS_AGREED : TERMS_NOT_AGREED }}
      hitSlop={CHECK_MARK_SLOP}
      onPress={() => onOpen(terms)}
      style={styles.row}
    >
      <Icon
        name="check-mark"
        color={agreed ? colors.secondary : colors.gray[300]}
      />
      <Text
        variant="Caption/M/Medium"
        color={colors.gray[600]}
        style={styles.label}
      >
        {`${terms.title} `}
        <Text
          variant="Caption/M/Medium"
          color={terms.required ? colors.secondary : colors.gray[600]}
        >
          {tag}
        </Text>
      </Text>
      <Icon
        name="chevron-right-line"
        color={colors.inputDisabled}
        style={styles.more}
      />
    </Pressable>
  );
});

/**
 * 약관 행 사이 간격. Figma 는 행 20 에 간격 24 이고 체크 표시(24)가 위아래로 2씩 넘친다. 행을 체크 표시 높이(24)로 두고
 * 간격 20 으로 같은 44 간격을 맞춘다. 넓힌 터치 영역(위아래 각각 간격의 절반까지)이 이웃 행과 겹치지 않으면서
 * Android 최소 터치 영역 48 을 채우도록 Android 만 간격을 24 로 둔다 (행 사이 4 더 넓다)
 */
export const TERMS_ROW_GAP = Platform.select({ android: 24, default: 20 });

// 상자·체크 표시는 Figma 크기 그대로 두고 위아래를 최소 터치 영역까지 넓힌다.
// 약관 행은 이웃 행과 겹치지 않게 간격의 절반을 넘기지 않는다
const CHECK_BOX_SLOP = { top: touchSlop(22), bottom: touchSlop(22) };
const ROW_SLOP = Math.min(touchSlop(24), TERMS_ROW_GAP / 2);
const CHECK_MARK_SLOP = { top: ROW_SLOP, bottom: ROW_SLOP };

const styles = StyleSheet.create({
  allRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // 체크 표시와 이름 사이 4 (Figma Frame 2147239647: 체크 24, 글자 x 28)
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { flex: 1 },
  // 화살표 선이 행 오른쪽 끝에서 5 안쪽에 오도록 아이콘 틀(24)을 바깥으로 민다
  more: { marginRight: -4 },
});
