import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  colors,
  Icon,
  singleLineInputText,
  Text,
} from '../../../shared/design-system';
import {
  formatAmount,
  paymentMethodLabels,
  type PaymentMethod,
} from '../model';

// 완료 보고 입력 필드 (결제 금액, 결제 방식, 사용 부품 같은 한 줄 입력). 여러 줄 메모는 디자인 시스템 TextArea 를 쓴다.
// 세 칸 모두 수행 메모 TextArea 와 같은 테두리 모양이다. 지금은 완료 보고에서만 써서 기능 폴더에 둔다.
// 한 줄 입력은 칸 높이를 채우고 값·플레이스홀더를 그 세로 가운데에 둔다 (#151, singleLineInputText).
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
    <View style={[styles.box, styles.lineBox]}>
      <TextInput
        accessibilityLabel={label}
        editable={!readOnly}
        placeholder={placeholder}
        placeholderTextColor={colors.gray[400]}
        value={value}
        onChangeText={onChangeText}
        style={[styles.boxInput, styles.lineText]}
      />
    </View>
  );
}

// 숫자만 남기고 앞자리 0 은 지운다 ("0" 하나는 남긴다)
const onlyDigits = (text: string) =>
  text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

// 보이는 값(쉼표 포함)에서 바뀐 글자로 새 저장 값을 만든다.
// 쉼표만 지웠으면 숫자가 그대로라 쉼표가 다시 붙고 백스페이스가 먹지 않으므로, 그 쉼표 앞 숫자를 지운다
function nextAmount(digits: string, text: string): string {
  const shown = formatAmount(digits);
  const next = onlyDigits(text);
  if (next !== digits || text.length !== shown.length - 1) {
    return next;
  }
  let removed = 0;
  while (removed < text.length && text[removed] === shown[removed]) {
    removed += 1;
  }
  const digitsBefore = shown.slice(0, removed).replace(/\D/g, '').length;
  if (digitsBefore === 0) {
    return next;
  }
  return onlyDigits(
    digits.slice(0, digitsBefore - 1) + digits.slice(digitsBefore),
  );
}

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
    <View style={[styles.box, styles.amountBox]}>
      <TextInput
        accessibilityLabel="결제 금액 입력"
        editable={!readOnly}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.gray[400]}
        value={formatAmount(value)}
        onChangeText={text => onChange(nextAmount(value, text))}
        style={[styles.boxInput, styles.amountText]}
      />
      <Text variant="Body/XS/Medium" color={colors.gray[500]}>
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
        <Text variant="Body/XS/Regular" style={styles.grow}>
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
          style={styles.grow}
        >
          {value ? paymentMethodLabels[value] : '결제 방식 선택'}
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
  // Figma 세 칸 모두 글자가 테두리 안 20 에서 시작한다 (3235:16434 / 16442 / 16448)
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    gap: 8,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: colors.white[100],
  },
  // 칸 높이를 채워 칸 어디를 눌러도 입력이 포커스되고, 글자는 그 세로 가운데에 온다
  boxInput: { flex: 1, alignSelf: 'stretch', color: colors.gray[900] },
  // Figma 사용 부품 (3235:16434): 여백 세로 16 + 한 줄 21 + 테두리 = 55
  lineBox: { minHeight: 55 },
  lineText: singleLineInputText('Caption/M/Regular'),
  // Figma 결제 금액 (3235:16442): 여백 세로 16 + 한 줄 22 + 테두리 = 56
  amountBox: { minHeight: 56 },
  amountText: singleLineInputText('Body/XS/Medium'),
  // Text 는 글자색을 color prop 으로 정한다. 스타일에 색을 넣으면 prop 을 덮어쓴다
  grow: { flex: 1 },
  select: { gap: 8 },
  options: {
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  option: { paddingHorizontal: 16, paddingVertical: 14 },
});
