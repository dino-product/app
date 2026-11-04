import { memo } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';

// 여러 줄 입력 (수행 메모, 기타 거절 사유)
export type TextAreaProps = {
  /** 스크린리더 이름. 화면의 제목과 겹치지 않게 "… 입력" 처럼 쓴다 */
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: boolean;
  /** 값은 보이고 고칠 수 없다 (제출을 마친 완료 보고) */
  readOnly?: boolean;
  /** 이 길이를 넘게 입력할 수 없다 (서버 길이 제한) */
  maxLength?: number;
};

export const TextArea = memo(function DesignSystemTextArea({
  label,
  placeholder,
  value,
  onChangeText,
  error = false,
  readOnly = false,
  maxLength,
}: TextAreaProps) {
  return (
    <TextInput
      accessibilityLabel={label}
      editable={!readOnly}
      maxLength={maxLength}
      multiline
      placeholder={placeholder}
      placeholderTextColor={colors.gray[400]}
      value={value}
      onChangeText={onChangeText}
      style={[styles.input, error && styles.error]}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    ...typography['Caption/M/Regular'],
    minHeight: 110,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
    color: colors.gray[900],
    textAlignVertical: 'top',
  },
  error: { borderColor: colors.warning[1] },
});
