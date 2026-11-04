import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Alert, Platform, type AlertButton } from 'react-native';
import { hideKeyboard, showKeyboard } from '../../../../jest/keyboard';
import {
  createFakeServer,
  fail,
  networkError,
  noContent,
  type FakeResponse,
  type FakeServer,
} from '../../../shared/testing/fakeServer';
import { renderWithApi } from '../../../shared/testing/renderWithApi';
import { testSession } from '../../../shared/testing/session';
import { MY_ACCOUNT_ID } from '../profileTesting';
import {
  withdrawalEligibilityQueryKey,
  withdrawalPath,
} from '../withdrawalApi';
import { WithdrawalScreen } from './WithdrawalScreen';

const WITHDRAWALS_PATH = withdrawalPath(MY_ACCOUNT_ID);

const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const alertButton = (alert: ReturnType<typeof spyAlert>, text: string) => {
  const buttons: AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
  const button = buttons.find(item => item.text === text);
  if (!button) {
    throw new Error(`알림창에 "${text}" 버튼이 없다`);
  }
  return button;
};

async function renderWithdrawal(
  server: FakeServer = createFakeServer().on(
    'POST',
    WITHDRAWALS_PATH,
    noContent(),
  ),
) {
  const onWithdrawn = jest.fn();
  const onBlocked = jest.fn();
  const view = await renderWithApi(
    <WithdrawalScreen
      onBack={jest.fn()}
      onWithdrawn={onWithdrawn}
      onBlocked={onBlocked}
    />,
    { server, session: testSession() },
  );
  return { ...view, onWithdrawn, onBlocked };
}

const reasonInput = () => screen.getByLabelText('탈퇴 사유 입력');
const withdrawButton = () => screen.getByRole('button', { name: '탈퇴하기' });

/** 탈퇴하기 → 최종 확인의 '탈퇴' */
async function confirmWithdraw(alert: ReturnType<typeof spyAlert>) {
  await userEvent.press(withdrawButton());
  await act(() => alertButton(alert, '탈퇴').onPress?.());
}

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

  it('탈퇴 사유는 선택이라 비워도 최종 확인을 거쳐 사유 없이(null) 탈퇴하고, 204 면 onWithdrawn', async () => {
    const alert = spyAlert();
    const { server, onWithdrawn } = await renderWithdrawal();

    expect(reasonInput()).toHaveProp('placeholder', '탈퇴 사유 입력');
    await userEvent.press(withdrawButton());
    expect(alert).toHaveBeenCalledWith(
      '정말 탈퇴할까요?',
      '탈퇴하면 계정과 데이터를 되돌릴 수 없습니다.',
      expect.any(Array),
      { cancelable: true },
    );
    expect(server.callsTo('POST', WITHDRAWALS_PATH)).toHaveLength(0);

    const confirm = alertButton(alert, '탈퇴');
    expect(confirm.style).toBe('destructive');
    await act(() => confirm.onPress?.());

    await waitFor(() => expect(onWithdrawn).toHaveBeenCalledTimes(1));
    expect(server.callsTo('POST', WITHDRAWALS_PATH)[0].body).toEqual({
      reason: null,
    });
  });

  it('입력한 사유는 앞뒤 공백을 지워 보낸다', async () => {
    const alert = spyAlert();
    const { server, onWithdrawn } = await renderWithdrawal();

    await userEvent.type(reasonInput(), ' 더 이상 사용하지 않아요 ');
    await confirmWithdraw(alert);

    await waitFor(() => expect(onWithdrawn).toHaveBeenCalled());
    expect(server.callsTo('POST', WITHDRAWALS_PATH)[0].body).toEqual({
      reason: '더 이상 사용하지 않아요',
    });
  });

  // 서버 한도(200자)를 넘는 사유는 입력에서 막는다
  it('사유 입력은 200자까지다', async () => {
    await renderWithdrawal();

    expect(reasonInput()).toHaveProp('maxLength', 200);
  });

  it('최종 확인에서 취소하면 탈퇴하지 않는다', async () => {
    const alert = spyAlert();
    const { server, onWithdrawn } = await renderWithdrawal();

    await userEvent.press(withdrawButton());
    await act(() => alertButton(alert, '취소').onPress?.());

    expect(server.callsTo('POST', WITHDRAWALS_PATH)).toHaveLength(0);
    expect(onWithdrawn).not.toHaveBeenCalled();
  });

  it('탈퇴하는 동안 탈퇴하기가 꺼져 다시 누를 수 없고, 끝나면 onWithdrawn 을 한 번 부른다', async () => {
    const alert = spyAlert();
    let answer: (response: FakeResponse) => void = () => {};
    const { server, onWithdrawn } = await renderWithdrawal(
      createFakeServer().on(
        'POST',
        WITHDRAWALS_PATH,
        () =>
          new Promise<FakeResponse>(resolve => {
            answer = resolve;
          }),
      ),
    );

    await confirmWithdraw(alert);
    await waitFor(() => expect(withdrawButton()).toBeDisabled());
    await userEvent.press(withdrawButton());
    expect(alert).toHaveBeenCalledTimes(1);

    await act(async () => answer(noContent()));

    await waitFor(() => expect(onWithdrawn).toHaveBeenCalledTimes(1));
    expect(server.callsTo('POST', WITHDRAWALS_PATH)).toHaveLength(1);
    // 로그인 화면으로 가는 동안에도 다시 보내지 않는다
    expect(withdrawButton()).toBeDisabled();
  });

  // 탈퇴 직전에 막는 사유가 생겼다. 사유는 본문에 없어 탈퇴 불가 화면이 가능 여부를 새로 묻는다
  it('PROFILE-006 이면 받아 둔 가능 여부를 버리고 onBlocked 를 부른다', async () => {
    const alert = spyAlert();
    const { onWithdrawn, onBlocked, queryClient } = await renderWithdrawal(
      createFakeServer().on('POST', WITHDRAWALS_PATH, fail(409, 'PROFILE-006')),
    );
    queryClient.setQueryData(withdrawalEligibilityQueryKey, {
      withdrawable: true,
      blocks: [],
    });

    await confirmWithdraw(alert);

    await waitFor(() => expect(onBlocked).toHaveBeenCalledTimes(1));
    expect(
      queryClient.getQueryData(withdrawalEligibilityQueryKey),
    ).toBeUndefined();
    expect(onWithdrawn).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it.each<[string, FakeResponse]>([
    ['서버 오류', fail(500, 'COMMON-500')],
    ['네트워크 오류', networkError()],
    ['사유 오류(PROFILE-007)', fail(400, 'PROFILE-007')],
  ])(
    '%s 면 머물러 입력한 사유를 지키고 다시 시도해 달라고 안내한다',
    async (_, response) => {
      const alert = spyAlert();
      const { onWithdrawn, onBlocked } = await renderWithdrawal(
        createFakeServer().on('POST', WITHDRAWALS_PATH, response),
      );

      await userEvent.type(reasonInput(), '이사');
      await confirmWithdraw(alert);

      await waitFor(() =>
        expect(alert).toHaveBeenLastCalledWith(
          '탈퇴하지 못했어요',
          '잠시 후 다시 시도해 주세요.',
        ),
      );
      expect(onWithdrawn).not.toHaveBeenCalled();
      expect(onBlocked).not.toHaveBeenCalled();
      expect(reasonInput()).toHaveDisplayValue('이사');
      expect(withdrawButton()).toBeEnabled();
    },
  );

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
