import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { Alert, Platform, type AlertButton } from 'react-native';
import { hideKeyboard, showKeyboard } from '../../../../jest/keyboard';
import { WithdrawalScreen } from './WithdrawalScreen';

const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const alertButton = (alert: ReturnType<typeof spyAlert>, text: string) => {
  const buttons: AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
  const button = buttons.find(item => item.text === text);
  if (!button) {
    throw new Error(`알림창에 "${text}" 버튼이 없다`);
  }
  return button;
};

const renderWithdrawal = (onWithdraw = jest.fn()) =>
  render(<WithdrawalScreen onBack={jest.fn()} onWithdraw={onWithdraw} />);

describe('WithdrawalScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('제목은 계정 관리이고 탈퇴 안내와 유의사항을 보여준다', async () => {
    await renderWithdrawal();

    expect(screen.getByRole('header', { name: '계정 관리' })).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: '정말 Orbit을 탈퇴하시겠습니까?' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('탈퇴 전 꼭 확인해주세요')).toBeOnTheScreen();
    expect(screen.getByText('서비스 탈퇴 유의사항')).toBeOnTheScreen();
    expect(
      screen.getByText('탈퇴 즉시 모든 발주사 소속이 해제됩니다.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('복구 불가 안내')).toBeOnTheScreen();
  });

  it('탈퇴 사유는 선택이라 비워도 최종 확인을 거쳐 탈퇴한다', async () => {
    const alert = spyAlert();
    const onWithdraw = jest.fn();
    await renderWithdrawal(onWithdraw);

    expect(screen.getByLabelText('탈퇴 사유 입력')).toHaveProp(
      'placeholder',
      '탈퇴 사유 입력',
    );
    await userEvent.press(screen.getByRole('button', { name: '탈퇴하기' }));
    expect(alert).toHaveBeenCalledWith(
      '정말 탈퇴할까요?',
      '탈퇴하면 계정과 데이터를 되돌릴 수 없습니다.',
      expect.any(Array),
      { cancelable: true },
    );
    expect(onWithdraw).not.toHaveBeenCalled();

    const confirm = alertButton(alert, '탈퇴');
    expect(confirm.style).toBe('destructive');
    await act(() => confirm.onPress?.());
    expect(onWithdraw).toHaveBeenCalledWith('');
  });

  it('입력한 사유는 앞뒤 공백을 지워 넘긴다', async () => {
    const alert = spyAlert();
    const onWithdraw = jest.fn();
    await renderWithdrawal(onWithdraw);

    await userEvent.type(
      screen.getByLabelText('탈퇴 사유 입력'),
      ' 더 이상 사용하지 않아요 ',
    );
    await userEvent.press(screen.getByRole('button', { name: '탈퇴하기' }));
    await act(() => alertButton(alert, '탈퇴').onPress?.());

    expect(onWithdraw).toHaveBeenCalledWith('더 이상 사용하지 않아요');
  });

  it('최종 확인에서 취소하면 탈퇴하지 않는다', async () => {
    const alert = spyAlert();
    const onWithdraw = jest.fn();
    await renderWithdrawal(onWithdraw);

    await userEvent.press(screen.getByRole('button', { name: '탈퇴하기' }));
    await act(() => alertButton(alert, '취소').onPress?.());

    expect(onWithdraw).not.toHaveBeenCalled();
  });

  describe('키보드', () => {
    afterEach(async () => {
      await hideKeyboard();
    });

    it('Android 는 키보드에 가린 만큼 스크롤 영역을 줄여 사유 입력칸이 키보드 위에 남는다', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await renderWithdrawal();
      const body = screen.getByTestId('withdrawal-body');
      await fireEvent(body, 'layout', {
        nativeEvent: { layout: { x: 0, y: 80, width: 360, height: 620 } },
      });

      await showKeyboard(500);

      expect(body).toHaveStyle({ paddingBottom: 200 });
    });
  });
});
