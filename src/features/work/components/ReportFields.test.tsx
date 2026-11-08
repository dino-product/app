import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { useState } from 'react';
import {
  colors,
  typography,
  type TypographyVariant,
} from '../../../shared/design-system';
import type { HostElement } from '../../../shared/testing/touchTarget';
import type { PaymentMethod } from '../model';
import { AmountInput, LineInput, PaymentMethodSelect } from './ReportFields';

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

// 흰 배경, Gray200 테두리, 모서리 12 (수행 메모 TextArea 와 같은 모양).
// 글자는 테두리 안 20 에서 시작한다 (Figma 3235:16434 / 16442 / 16448, #151)
const fieldBox = {
  backgroundColor: colors.white[100],
  borderWidth: 1,
  borderColor: colors.gray[200],
  borderRadius: 12,
  paddingHorizontal: 20,
};

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

  it('흰 배경에 Gray200 테두리다', async () => {
    await render(<AmountInput value="" onChange={jest.fn()} />);

    const box = screen.getByLabelText('결제 금액 입력').parent as HostElement;
    expect(box).toHaveStyle(fieldBox);
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

  it('고르기 전에는 "결제 방식 선택" 을 회색으로 보여준다', async () => {
    await render(<PaymentMethodSelect value={null} onChange={jest.fn()} />);

    expect(screen.getByText('결제 방식 선택')).toHaveStyle({
      color: colors.gray[400],
    });
  });

  it('흰 배경에 Gray200 테두리다', async () => {
    await render(<PaymentMethodSelect value={null} onChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: '결제 방식 선택' })).toHaveStyle(
      fieldBox,
    );
  });

  it('readOnly 면 고른 값만 보이고 펼칠 수 없다', async () => {
    await render(
      <PaymentMethodSelect value="card" onChange={jest.fn()} readOnly />,
    );

    expect(screen.getByText('현장 카드')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});

describe('LineInput', () => {
  it('한 줄 입력이고 흰 배경에 Gray200 테두리다', async () => {
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
    expect(input.parent as HostElement).toHaveStyle(fieldBox);

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
