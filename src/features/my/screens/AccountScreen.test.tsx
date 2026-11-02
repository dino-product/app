import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { colors } from '../../../shared/design-system';
import type { WithdrawalEligibility } from '../model';
import { AccountScreen } from './AccountScreen';

// 프리셋의 Alert 는 네이티브 목으로 이어지므로 띄우지 않게 막는다
const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// 넘긴 버튼을 꺼내 직접 누른다
const pressAlertButton = async (
  alert: ReturnType<typeof spyAlert>,
  text: string,
) => {
  const buttons: AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
  const button = buttons.find(item => item.text === text);
  if (!button) {
    throw new Error(`알림창에 "${text}" 버튼이 없다`);
  }
  await act(() => button.onPress?.());
};

const renderAccount = (
  overrides: Partial<Parameters<typeof AccountScreen>[0]> = {},
) => {
  const props = {
    onBack: jest.fn(),
    onLogout: jest.fn(),
    checkWithdrawal: jest.fn(
      async (): Promise<WithdrawalEligibility> => ({
        withdrawable: true,
        blocks: [],
      }),
    ),
    onOpenWithdrawal: jest.fn(),
    onOpenWithdrawalBlocked: jest.fn(),
    ...overrides,
  };
  return render(<AccountScreen {...props} />).then(() => props);
};

describe('AccountScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('제목과 로그아웃, 빨간 계정 탈퇴 행을 보여준다', async () => {
    await renderAccount();

    // 화면 제목과 같은 섹션 이름은 한 번만 읽는다
    expect(screen.getAllByRole('header', { name: '계정 관리' })).toHaveLength(
      1,
    );
    expect(
      screen.getAllByText('계정 관리', { includeHiddenElements: true }),
    ).toHaveLength(2);
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeOnTheScreen();
    expect(screen.getByText('계정 탈퇴')).toHaveStyle({
      color: colors.warning[1],
    });
  });

  it('로그아웃을 누르면 확인 알림창을 띄우고, 확인하면 로그아웃한다', async () => {
    const alert = spyAlert();
    const props = await renderAccount();

    await userEvent.press(screen.getByRole('button', { name: '로그아웃' }));
    expect(alert).toHaveBeenCalledWith(
      '로그아웃할까요?',
      undefined,
      expect.any(Array),
      { cancelable: true },
    );
    expect(props.onLogout).not.toHaveBeenCalled();

    await pressAlertButton(alert, '로그아웃');
    expect(props.onLogout).toHaveBeenCalledTimes(1);
  });

  it('로그아웃 확인창에서 취소하면 로그아웃하지 않는다', async () => {
    const alert = spyAlert();
    const props = await renderAccount();

    await userEvent.press(screen.getByRole('button', { name: '로그아웃' }));
    await pressAlertButton(alert, '취소');

    expect(props.onLogout).not.toHaveBeenCalled();
  });

  it('탈퇴할 수 있으면 계정 탈퇴 화면으로 간다', async () => {
    const props = await renderAccount();

    await userEvent.press(screen.getByRole('button', { name: '계정 탈퇴' }));

    expect(props.checkWithdrawal).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(props.onOpenWithdrawal).toHaveBeenCalled());
    expect(props.onOpenWithdrawalBlocked).not.toHaveBeenCalled();
  });

  it('탈퇴할 수 없으면 막는 사유와 함께 탈퇴 불가 화면으로 간다', async () => {
    const blocks = [{ reason: 'WORK_PENDING_ACCEPT' as const, count: 2 }];
    const props = await renderAccount({
      checkWithdrawal: jest.fn(async () => ({ withdrawable: false, blocks })),
    });

    await userEvent.press(screen.getByRole('button', { name: '계정 탈퇴' }));

    await waitFor(() =>
      expect(props.onOpenWithdrawalBlocked).toHaveBeenCalledWith(blocks),
    );
    expect(props.onOpenWithdrawal).not.toHaveBeenCalled();
  });

  it('확인 중에 한 번 더 눌러도 한 번만 확인한다', async () => {
    let resolve: (value: WithdrawalEligibility) => void = () => {};
    const checkWithdrawal = jest.fn(
      () =>
        new Promise<WithdrawalEligibility>(done => {
          resolve = done;
        }),
    );
    const props = await renderAccount({ checkWithdrawal });

    const row = screen.getByRole('button', { name: '계정 탈퇴' });
    await userEvent.press(row);
    expect(row).toBeDisabled();
    await userEvent.press(row);
    await act(async () => resolve({ withdrawable: true, blocks: [] }));

    expect(checkWithdrawal).toHaveBeenCalledTimes(1);
    expect(props.onOpenWithdrawal).toHaveBeenCalledTimes(1);
    expect(row).toBeEnabled();
  });

  it('확인하는 동안 화면을 떠나면 늦게 온 결과로 이동하지 않는다', async () => {
    let resolve: (value: WithdrawalEligibility) => void = () => {};
    const props = await renderAccount({
      checkWithdrawal: jest.fn(
        () =>
          new Promise<WithdrawalEligibility>(done => {
            resolve = done;
          }),
      ),
    });

    await userEvent.press(screen.getByRole('button', { name: '계정 탈퇴' }));
    await screen.unmount();
    await act(async () => resolve({ withdrawable: true, blocks: [] }));

    expect(props.onOpenWithdrawal).not.toHaveBeenCalled();
  });

  it('확인에 실패하면 알리고 다시 누를 수 있다', async () => {
    const alert = spyAlert();
    const props = await renderAccount({
      checkWithdrawal: jest.fn(async () => {
        throw new Error('network');
      }),
    });

    await userEvent.press(screen.getByRole('button', { name: '계정 탈퇴' }));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        '탈퇴할 수 있는지 확인하지 못했어요',
        '잠시 후 다시 시도해 주세요.',
      ),
    );
    expect(props.onOpenWithdrawal).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '계정 탈퇴' })).toBeEnabled();
  });
});
