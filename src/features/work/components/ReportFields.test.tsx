import {
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import {
  colors,
  typography,
  type TypographyVariant,
} from '../../../shared/design-system';
import type { HostElement } from '../../../shared/testing/touchTarget';
import type { PaymentMethod } from '../model';
import {
  AmountInput,
  LineInput,
  MemoInput,
  PaymentMethodSelect,
  ReportField,
} from './ReportFields';

// 화면처럼 저장 값을 들고 다시 넘겨주는 부모
function ControlledAmount({
  onChange,
}: {
  onChange: (digits: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <AmountInput
      value={value}
      onChange={digits => {
        onChange(digits);
        setValue(digits);
      }}
    />
  );
}

// 한 줄 입력의 글자 모양 (줄 높이는 두지 않는다, #151)
const fontOf = (variant: TypographyVariant) => {
  const { fontFamily, fontSize, letterSpacing } = typography[variant];
  return { fontFamily, fontSize, letterSpacing };
};

// #180: Figma 작업수행-상세/보고제출 활성(3235:16226) 입력칸은 채움 없이 Gray100 1 테두리, 글자는 테두리 안 20 에서 시작한다.
// 모서리는 사용 부품·수행 메모 16 (3235:16434·16430), 결제 금액·결제 방식 14 (3235:16442·16448)
const fieldBox = (borderRadius: 14 | 16) => ({
  borderWidth: 1,
  borderColor: colors.gray[100],
  borderRadius,
  paddingHorizontal: 20,
});
const noFill = (node: HostElement) =>
  expect(StyleSheet.flatten(node.props.style).backgroundColor).toBeUndefined();

describe('AmountInput', () => {
  it('120000 을 넣으면 숫자만 저장하고 화면에는 쉼표를 넣어 보여준다', async () => {
    const onChange = jest.fn();
    await render(<ControlledAmount onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('결제 금액 입력'), '120000');

    expect(onChange).toHaveBeenLastCalledWith('120000');
    expect(screen.getByLabelText('결제 금액 입력')).toHaveDisplayValue(
      '120,000',
    );
  });

  it('쉼표가 들어간 값을 고쳐도 저장 값에는 숫자만 남는다', async () => {
    const onChange = jest.fn();
    await render(<AmountInput value="1200" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('결제 금액 입력'), '5');

    expect(onChange).toHaveBeenLastCalledWith('12005');
  });

  // 쉼표만 지우면 숫자가 그대로라 쉼표가 다시 붙어 백스페이스가 먹지 않는다. 그 앞 숫자를 지운다
  it.each([
    ['12,|000', '12000', '12000', '1000'],
    ['1,|200,000', '1200000', '1200,000', '200000'],
    ['1,200,|000', '1200000', '1,200000', '120000'],
  ])(
    '%s 에서 백스페이스로 쉼표를 지우면 그 앞 숫자를 지운다',
    async (_, value, text, expected) => {
      const onChange = jest.fn();
      await render(<AmountInput value={value} onChange={onChange} />);

      await fireEvent.changeText(screen.getByLabelText('결제 금액 입력'), text);

      expect(onChange).toHaveBeenLastCalledWith(expected);
    },
  );

  it('맨 앞 숫자만 남기고 지우면 0 이 된다', async () => {
    const onChange = jest.fn();
    await render(<AmountInput value="1000" onChange={onChange} />);

    await fireEvent.changeText(screen.getByLabelText('결제 금액 입력'), '1000');

    expect(onChange).toHaveBeenLastCalledWith('0');
  });

  it('채움 없이 Gray100 테두리·모서리 14 다', async () => {
    await render(<AmountInput value="" onChange={jest.fn()} />);

    const box = screen.getByLabelText('결제 금액 입력').parent as HostElement;
    expect(box).toHaveStyle(fieldBox(14));
    noFill(box);
  });

  // Figma 3235:16444·16445: 비었을 때 "0" 은 Gray500, "원" 은 Gray700. 넣은 값은 Gray900 (3235:16144)
  it('빈 칸의 "0" 은 Gray500, 넣은 값은 Gray900, "원" 은 Gray700 이다', async () => {
    await render(<AmountInput value="" onChange={jest.fn()} />);

    const input = screen.getByLabelText('결제 금액 입력');
    expect(input).toHaveProp('placeholderTextColor', colors.gray[500]);
    expect(input).toHaveStyle({ color: colors.gray[900] });
    expect(screen.getByText('원')).toHaveStyle({ color: colors.gray[700] });
  });

  // Figma 작업수행-상세/보고제출 활성 3235:16442, 작업이력 상세 3463:17299: 여백 가로 20·세로 16 + 한 줄 22 = 56
  it('Figma 대로 칸 높이 56·가로 여백 20 이고, 값과 "원" 은 Body/XS/Medium 이다', async () => {
    await render(<AmountInput value="" onChange={jest.fn()} />);

    const input = screen.getByLabelText('결제 금액 입력');
    expect(input.parent as HostElement).toHaveStyle({
      minHeight: 56,
      paddingHorizontal: 20,
    });
    expect(input).toHaveStyle(fontOf('Body/XS/Medium'));
    expect(screen.getByText('원')).toHaveStyle(typography['Body/XS/Medium']);
  });

  it('readOnly 면 쉼표 넣은 값을 보여주기만 하고 고칠 수 없다', async () => {
    await render(<AmountInput value="120000" onChange={jest.fn()} readOnly />);

    const input = screen.getByLabelText('결제 금액 입력');
    expect(input).toHaveDisplayValue('120,000');
    expect(input).toHaveProp('editable', false);
  });
});

describe('PaymentMethodSelect', () => {
  function ControlledSelect() {
    const [value, setValue] = useState<PaymentMethod | null>(null);
    return <PaymentMethodSelect value={value} onChange={setValue} />;
  }

  it('펼치면 결제 방식 이름이 바뀐 목록대로 보이고, 고른 값을 보여준다', async () => {
    await render(<ControlledSelect />);

    await userEvent.press(
      screen.getByRole('button', { name: '결제 방식 선택' }),
    );
    const names = ['현장 카드', '현장 현금', '계좌 이체', '청구서 발행(후불)'];
    for (const name of names) {
      expect(screen.getByRole('button', { name })).toBeOnTheScreen();
    }
    await userEvent.press(
      screen.getByRole('button', { name: '청구서 발행(후불)' }),
    );

    expect(
      screen.getByRole('button', { name: '결제 방식 선택' }),
    ).toHaveAccessibilityValue({ text: '청구서 발행(후불)' });
  });

  // Figma 3235:16450: Body/XS/Medium Gray500
  it('고르기 전에는 "결제 방식 선택" 을 Body/XS/Medium Gray500 으로 보여준다', async () => {
    await render(<PaymentMethodSelect value={null} onChange={jest.fn()} />);

    expect(screen.getByText('결제 방식 선택')).toHaveStyle({
      ...typography['Body/XS/Medium'],
      color: colors.gray[500],
    });
  });

  it('고른 값은 Body/XS/Medium Gray900 이다', async () => {
    await render(<PaymentMethodSelect value="card" onChange={jest.fn()} />);

    expect(screen.getByText('현장 카드')).toHaveStyle({
      ...typography['Body/XS/Medium'],
      color: colors.gray[900],
    });
  });

  // Figma 3235:16448: 높이 58 (여백 16 + 24 아이콘 줄 + 테두리), 펼침 화살표는 24·Gray700
  it('채움 없이 Gray100 테두리·모서리 14, 높이 58 이고 펼침 화살표는 24·Gray700 이다', async () => {
    await render(<PaymentMethodSelect value={null} onChange={jest.fn()} />);

    const box = screen.getByRole('button', { name: '결제 방식 선택' });
    expect(box).toHaveStyle({ ...fieldBox(14), minHeight: 58 });
    noFill(box);
    const arrow = screen.getByTestId('payment-method-arrow', {
      includeHiddenElements: true,
    });
    expect(arrow).toHaveStyle({ width: 24, height: 24 });
    const [svg] = arrow.children;
    expect(typeof svg === 'string' ? svg : svg.props.color).toBe(
      colors.gray[700],
    );
  });

  // Figma 작업이력- 작업상세 (선택중) 3463:16846: 칸 아래 12 에 흰 채움·Gray100 테두리·모서리 14·안쪽 6·항목 사이 2.
  // 항목은 안쪽 12·모서리 8, 글자 Body/XS/Medium Gray600. 고른 항목은 Gray50 채움에 Gray800 글자
  it('펼친 목록과 항목은 Figma 선택창 모양이고, 고른 항목은 Gray50 채움에 Gray800 글자다', async () => {
    await render(<PaymentMethodSelect value="transfer" onChange={jest.fn()} />);

    await userEvent.press(
      screen.getByRole('button', { name: '결제 방식 선택' }),
    );

    const option = screen.getByRole('button', { name: '현장 카드' });
    const list = option.parent as HostElement;
    expect(list).toHaveStyle({
      padding: 6,
      gap: 2,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.gray[100],
      backgroundColor: colors.white[100],
    });
    expect(list.parent).toHaveStyle({ gap: 12 });
    expect(option).toHaveStyle({ padding: 12, borderRadius: 8 });
    expect(
      StyleSheet.flatten(option.props.style).backgroundColor,
    ).toBeUndefined();
    expect(screen.getByText('현장 카드')).toHaveStyle({
      ...typography['Body/XS/Medium'],
      color: colors.gray[600],
    });

    const picked = screen.getByRole('button', { name: '계좌 이체' });
    expect(picked).toHaveStyle({ backgroundColor: colors.gray[50] });
    expect(within(picked).getByText('계좌 이체')).toHaveStyle({
      color: colors.gray[800],
    });
  });

  it('readOnly 면 고른 값만 보이고 펼칠 수 없다', async () => {
    await render(
      <PaymentMethodSelect value="card" onChange={jest.fn()} readOnly />,
    );

    expect(screen.getByText('현장 카드')).toHaveStyle({
      ...typography['Body/XS/Medium'],
      color: colors.gray[900],
    });
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});

// #180: Figma 3235:16226·3235:15926 결제 정보: 이름(Caption/M/Medium Gray600) 아래 8 에 칸이 온다
describe('ReportField', () => {
  it('이름 아래 8 에 칸을 둔다', async () => {
    await render(
      <ReportField label="결제 금액">
        <AmountInput value="" onChange={jest.fn()} />
      </ReportField>,
    );

    const label = screen.getByText('결제 금액');
    expect(label).toHaveStyle({
      ...typography['Caption/M/Medium'],
      color: colors.gray[600],
    });
    expect(label.parent).toHaveStyle({ gap: 8 });
  });
});

// #180: Figma 3235:16430 수행 메모: 채움 없이 Gray100 테두리·모서리 16, 안쪽 위아래 16·좌우 20, 높이 113.
// 글자는 14 Regular(Caption/M/Regular), 비었을 때 안내는 Gray500
describe('MemoInput', () => {
  it('여러 줄 입력이고 Figma 수행 메모 칸 모양이다', async () => {
    const onChangeText = jest.fn();
    await render(
      <MemoInput
        label="수행 메모 입력"
        placeholder="수행 메모 작성"
        value=""
        onChangeText={onChangeText}
      />,
    );

    const input = screen.getByLabelText('수행 메모 입력');
    expect(input).toHaveProp('multiline', true);
    expect(input).toHaveProp('placeholder', '수행 메모 작성');
    expect(input).toHaveProp('placeholderTextColor', colors.gray[500]);
    expect(input).toHaveStyle({
      ...typography['Caption/M/Regular'],
      color: colors.gray[900],
      minHeight: 113,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.gray[100],
      textAlignVertical: 'top',
    });
    noFill(input);

    await userEvent.type(input, '밸');
    expect(onChangeText).toHaveBeenLastCalledWith('밸');
  });

  it('readOnly 면 고칠 수 없다', async () => {
    await render(
      <MemoInput
        label="수행 메모 입력"
        placeholder="수행 메모 작성"
        value="배터리 교체"
        onChangeText={jest.fn()}
        readOnly
      />,
    );

    const input = screen.getByLabelText('수행 메모 입력');
    expect(input).toHaveDisplayValue('배터리 교체');
    expect(input).toHaveProp('editable', false);
  });
});

describe('LineInput', () => {
  it('한 줄 입력이고 채움 없이 Gray100 테두리·모서리 16, 비었을 때 안내는 Gray500 이다', async () => {
    const onChangeText = jest.fn();
    await render(
      <LineInput
        label="사용 부품 입력"
        placeholder="사용 부품 작성"
        value=""
        onChangeText={onChangeText}
      />,
    );

    const input = screen.getByLabelText('사용 부품 입력');
    expect(input).not.toHaveProp('multiline', true);
    expect(input).toHaveProp('placeholder', '사용 부품 작성');
    expect(input).toHaveProp('placeholderTextColor', colors.gray[500]);
    expect(input.parent as HostElement).toHaveStyle(fieldBox(16));
    noFill(input.parent as HostElement);

    await userEvent.type(input, '밸');
    expect(onChangeText).toHaveBeenLastCalledWith('밸');
  });

  // Figma 작업수행-상세/보고제출 활성 3235:16434, 작업이력 상세 3463:17291: 여백 가로 20·세로 16 + 한 줄 21 = 55
  it('Figma 대로 칸 높이 55·가로 여백 20 이고, 글자는 Caption/M/Regular 다', async () => {
    await render(
      <LineInput
        label="사용 부품 입력"
        placeholder="사용 부품 작성"
        value=""
        onChangeText={jest.fn()}
      />,
    );

    const input = screen.getByLabelText('사용 부품 입력');
    expect(input.parent as HostElement).toHaveStyle({
      minHeight: 55,
      paddingHorizontal: 20,
    });
    expect(input).toHaveStyle(fontOf('Caption/M/Regular'));
  });

  it('readOnly 면 고칠 수 없다', async () => {
    await render(
      <LineInput
        label="사용 부품 입력"
        placeholder="사용 부품 작성"
        value="밸브"
        onChangeText={jest.fn()}
        readOnly
      />,
    );

    expect(screen.getByLabelText('사용 부품 입력')).toHaveProp(
      'editable',
      false,
    );
  });
});
