import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, Icon, Text, typography } from '../../../shared/design-system';
import {
  formatAmount,
  paymentMethodLabels,
  type PaymentMethod,
} from '../model';

// 완료 보고 입력 필드 (결제 금액, 결제 방식, 사용 부품 같은 한 줄 입력). 여러 줄 메모는 디자인 시스템 TextArea 를 쓴다.
// 세 칸 모두 수행 메모 TextArea 와 같은 테두리 모양이다. 지금은 완료 보고에서만 써서 기능 폴더에 둔다.
// readOnly 는 제출을 마친 보고다. 값은 그대로 보이고 고칠 수 없다.

export function FieldLabel({ children }: { children: string }) {
  return (
    <Text variant="Caption/M/Medium" color={colors.gray[600]}>
      {children}
    </Text>
  );
}

export function LineInput({
  label,
  placeholder,
  value,
  onChangeText,
  readOnly = false,
}: {
  /** 스크린리더 이름. 화면의 제목과 겹치지 않게 "… 입력" 처럼 쓴다 */
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  readOnly?: boolean;
}) {
  return (
    <View style={styles.box}>
      <TextInput
        accessibilityLabel={label}
        editable={!readOnly}
        placeholder={placeholder}
        placeholderTextColor={colors.gray[400]}
        value={value}
        onChangeText={onChangeText}
        style={[styles.boxInput, typography['Caption/M/Regular']]}
      />
    </View>
  );
}

// 숫자만 남기고 앞자리 0 은 지운다 ("0" 하나는 남긴다)
const onlyDigits = (text: string) =>
  text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

export function AmountInput({
  value,
  onChange,
  readOnly = false,
}: {
  /** 숫자만 담은 저장 값. 보여줄 때만 쉼표를 넣는다 */
  value: string;
  onChange: (digits: string) => void;
  readOnly?: boolean;
}) {
  return (
    <View style={styles.box}>
      <TextInput
        accessibilityLabel="결제 금액 입력"
        editable={!readOnly}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.gray[400]}
        value={formatAmount(value)}
        onChangeText={text => onChange(onlyDigits(text))}
        style={[styles.boxInput, typography['Body/XS/Regular']]}
      />
      <Text variant="Body/XS/Regular" color={colors.gray[500]}>
        원
      </Text>
    </View>
  );
}

const paymentMethods = Object.keys(paymentMethodLabels) as PaymentMethod[];

export function PaymentMethodSelect({
  value,
  onChange,
  readOnly = false,
}: {
  value: PaymentMethod | null;
  onChange: (method: PaymentMethod) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Figma 제출 후 화면은 펼침 화살표 없이 고른 값만 보인다
  if (readOnly) {
    return (
      <View style={styles.box}>
        <Text variant="Body/XS/Regular" style={styles.boxInput}>
          {value ? paymentMethodLabels[value] : ''}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.select}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="결제 방식 선택"
        accessibilityState={{ expanded: open }}
        accessibilityValue={
          value ? { text: paymentMethodLabels[value] } : undefined
        }
        onPress={() => setOpen(prev => !prev)}
        style={styles.box}
      >
        <Text
          variant="Body/XS/Regular"
          color={value ? colors.gray[900] : colors.gray[400]}
          style={styles.boxInput}
        >
          {value ? paymentMethodLabels[value] : '결제 방식을 선택해주세요'}
        </Text>
        <Icon name="chevron-down" size={20} color={colors.gray[500]} />
      </Pressable>
      {open && (
        <View style={styles.options}>
          {paymentMethods.map(method => (
            <Pressable
              key={method}
              accessibilityRole="button"
              accessibilityLabel={paymentMethodLabels[method]}
              accessibilityState={{ selected: method === value }}
              onPress={() => {
                onChange(method);
                setOpen(false);
              }}
              style={styles.option}
            >
              <Text variant="Body/XS/Regular">
                {paymentMethodLabels[method]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: colors.white[100],
  },
  boxInput: { flex: 1, color: colors.gray[900] },
  select: { gap: 8 },
  options: {
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  option: { paddingHorizontal: 16, paddingVertical: 14 },
});
