import { render, screen, userEvent } from '@testing-library/react-native';
import { dragFrom } from '../../../../jest/responder';
import { noTermsAgreed } from '../model';
import { TermsSheet } from './TermsSheet';

// 약관 동의 시트의 끌어 닫기 (#93). 본문 상자·시트 목록은 스크롤 몫이고, 제목 줄을 끌면 닫는다
const renderSheet = async () => {
  const props = {
    onChange: jest.fn(),
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };
  await render(
    <TermsSheet visible focusType={null} draft={noTermsAgreed} {...props} />,
  );
  return props;
};

describe('TermsSheet 끌기', () => {
  it('약관 본문 상자를 위·아래로 스크롤해도 시트는 움직이지 않고 닫히지 않는다', async () => {
    const { onClose } = await renderSheet();
    const body = screen.getAllByText(/^제1조 \(목적\)/)[0];

    for (const dy of [160, -160]) {
      expect((await dragFrom(body, { dy })).granted).toBe(false);
    }
    expect(onClose).not.toHaveBeenCalled();
  });

  it('시트 목록(전체 동의~약관 다섯 개)을 위·아래로 스크롤해도 닫히지 않는다', async () => {
    const { onClose } = await renderSheet();
    const items = screen.getByTestId('terms-sheet-items');

    for (const dy of [160, -160]) {
      expect((await dragFrom(items, { dy })).granted).toBe(false);
    }
    expect(onClose).not.toHaveBeenCalled();
  });

  it('제목 줄을 아래로 끌면 닫는다', async () => {
    const { onClose } = await renderSheet();

    const result = await dragFrom(
      screen.getByRole('header', { name: '약관 동의' }),
      { dy: 160 },
    );

    expect(result.granted).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('닫기 버튼으로 닫는다', async () => {
    const { onClose } = await renderSheet();

    await userEvent.press(screen.getByRole('button', { name: '닫기' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
