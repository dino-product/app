import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import {
  colors,
  Icon,
  Text,
  touchSlop,
  type TypographyVariant,
} from '../../../shared/design-system';
import { requiredLabel, type Terms } from '../model';

// 약관 동의 화면과 약관 시트의 체크. 스크린리더는 "서비스 이용약관 (필수), 체크박스, 선택됨" 처럼 읽는다.
// Figma Check Box(22, 전체 동의)와 Check(24, 약관 하나). 켜지면 Secondary, 꺼지면 Gray300 이다

/** 전체 동의: 네모 체크박스 + 글자 (Figma 3284:22327 '모든 약관에 동의합니다.', 3569:7702 '전체 동의') */
export const AgreeAllCheckbox = memo(function OnboardingAgreeAllCheckbox({
  label,
  checked,
  onPress,
  variant,
  color,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  variant: TypographyVariant;
  color: string;
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
      <Text variant={variant} color={color}>
        {label}
      </Text>
    </Pressable>
  );
});

/** 약관 하나: 체크 표시 + 이름 + (필수)·(선택). (필수) 만 Secondary 다 */
export const TermsCheck = memo(function OnboardingTermsCheck({
  terms,
  title,
  checked,
  onToggle,
  color,
  gap,
}: {
  terms: Terms;
  /** 화면은 terms.title, 시트는 terms.sheetTitle */
  title: string;
  checked: boolean;
  onToggle: (terms: Terms) => void;
  color: string;
  /** 체크 표시와 이름 사이 (화면 4, 시트 8) */
  gap: number;
}) {
  const tag = requiredLabel(terms);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={`${title} ${tag}`}
      accessibilityState={{ checked }}
      hitSlop={CHECK_MARK_SLOP}
      onPress={() => onToggle(terms)}
      style={[styles.row, { gap }]}
    >
      <Icon
        name="check-mark"
        color={checked ? colors.secondary : colors.gray[300]}
      />
      <Text variant="Caption/M/Medium" color={color} style={styles.label}>
        {`${title} `}
        <Text
          variant="Caption/M/Medium"
          color={terms.required ? colors.secondary : color}
        >
          {tag}
        </Text>
      </Text>
    </Pressable>
  );
});

// 상자·체크 표시는 Figma 크기 그대로 두고 위아래를 최소 터치 영역까지 넓힌다
const CHECK_BOX_SLOP = { top: touchSlop(22), bottom: touchSlop(22) };
const CHECK_MARK_SLOP = { top: touchSlop(24), bottom: touchSlop(24) };

const styles = StyleSheet.create({
  allRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  label: { flexShrink: 1 },
});
