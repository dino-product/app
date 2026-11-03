import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
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

  // 끌기 자리를 좁혀도 다른 닫기 방법은 그대로다
  it('닫기 버튼·배경·Android 뒤로가기·VoiceOver 두 손가락 Z 로 닫는다', async () => {
    const { onClose } = await renderSheet();

    await userEvent.press(screen.getByRole('button', { name: '닫기' }));
    await fireEvent.press(
      screen.getByTestId('terms-sheet-backdrop', {
        includeHiddenElements: true,
      }),
    );
    await act(() =>
      modalOf(screen.getByTestId('terms-sheet')).onRequestClose(),
    );
    await fireEvent(screen.getByTestId('terms-sheet'), 'accessibilityEscape');

    expect(onClose).toHaveBeenCalledTimes(4);
  });
});

/** 시트를 감싼 RN Modal 의 props (호스트 요소 이름이 Modal 이다) */
function modalOf(element: ReturnType<typeof screen.getByTestId>) {
  let node = element.parent;
  while (node && node.type !== 'Modal') {
    node = node.parent;
  }
  if (!node) {
    throw new Error('시트가 Modal 안에 있지 않다');
  }
  return node.props as { onRequestClose: () => void };
}
