import { memo, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { colors, Text, typography } from '../../../shared/design-system';

// 라벨 + 한 줄 입력칸. 포커스되면 보라 테두리 (Figma 마이페이지-프로필 수정 3255:19478)
export type FormFieldProps = {
  /** 보이는 라벨이자 스크린리더 이름 */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
};

export const FormField = memo(function MyFormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      {/* 입력칸이 같은 이름을 읽으므로 라벨 글자는 스크린리더에서 뺀다 */}
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        variant="Caption/M/SemiBold"
        color={colors.gray[800]}
      >
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray[300]}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && styles.focused]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: 8 },
  input: {
    ...typography['Body/XS/Medium'],
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: colors.white[100],
    color: colors.gray[900],
  },
  focused: { borderColor: colors.secondary },
});
