import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, Icon, Text, typography } from '../../../shared/design-system';
import { paymentMethodLabels, type PaymentMethod } from '../model';

// 완료 보고 입력 필드 (수행 메모·사용 부품, 결제 금액, 결제 방식)

export function MemoInput({
  label,
  placeholder,
  value,
  onChangeText,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <TextInput
      accessibilityLabel={label}
      multiline
      placeholder={placeholder}
      placeholderTextColor={colors.gray[400]}
      value={value}
      onChangeText={onChangeText}
      style={[styles.memo, typography['Caption/M/Regular']]}
    />
  );
}

export function FieldLabel({ children }: { children: string }) {
  return (
    <Text variant="Caption/M/Medium" color={colors.gray[600]}>
      {children}
    </Text>
  );
}

// 숫자만 남기고 앞자리 0 은 지운다 ("0" 하나는 남긴다)
const onlyDigits = (text: string) =>
  text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

export function AmountInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (digits: string) => void;
}) {
  return (
    <View style={styles.box}>
      <TextInput
        accessibilityLabel="결제 금액 입력"
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.gray[400]}
        value={value}
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
}: {
  value: PaymentMethod | null;
  onChange: (method: PaymentMethod) => void;
}) {
  const [open, setOpen] = useState(false);

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
        <Icon name="chevron-down" />
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
  memo: {
    minHeight: 110,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
    color: colors.gray[900],
    textAlignVertical: 'top',
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.gray[50],
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
