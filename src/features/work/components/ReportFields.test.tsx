import { render, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';
import { colors } from '../../../shared/design-system';
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

// 흰 배경, Gray200 테두리, 모서리 12 (수행 메모 TextArea 와 같은 모양)
const fieldBox = {
  backgroundColor: colors.white[100],
  borderWidth: 1,
  borderColor: colors.gray[200],
  borderRadius: 12,
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

  it('흰 배경에 Gray200 테두리다', async () => {
    await render(<AmountInput value="" onChange={jest.fn()} />);

    const box = screen.getByLabelText('결제 금액 입력').parent as HostElement;
    expect(box).toHaveStyle(fieldBox);
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
    for (const name of ['카드결제', '현금결제', '계좌이체']) {
      expect(screen.getByRole('button', { name })).toBeOnTheScreen();
    }
    await userEvent.press(screen.getByRole('button', { name: '카드결제' }));

    expect(
      screen.getByRole('button', { name: '결제 방식 선택' }),
    ).toHaveAccessibilityValue({ text: '카드결제' });
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

    expect(screen.getByText('카드결제')).toBeOnTheScreen();
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
