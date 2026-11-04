import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import {
  createFakeServer,
  fail,
  hang,
  ok,
  type FakeServer,
} from '../../../shared/testing/fakeServer';
import {
  createTestApi,
  renderWithApi,
} from '../../../shared/testing/renderWithApi';
import { testSession } from '../../../shared/testing/session';
import type { WithdrawalBlock, WithdrawalEligibility } from '../model';
import { MY_ELIGIBILITY_PATH, seedMyCache } from '../profileTesting';
import { withdrawalEligibilityQueryKey } from '../withdrawalApi';
import { WithdrawalBlockedScreen } from './WithdrawalBlockedScreen';

const blocked = (
  blocks: readonly WithdrawalBlock[],
): WithdrawalEligibility => ({
  withdrawable: false,
  blocks,
});

const eligibilityServer = (...responses: WithdrawalEligibility[]) =>
  createFakeServer().on(
    'GET',
    MY_ELIGIBILITY_PATH,
    ...responses.map(response => ok(response)),
  );

/** 가짜 서버로 열고 사유를 받을 때까지 기다린다 */
/** 가짜 서버로 열고 받은 결과(사유·안내 또는 실패)가 그려질 때까지 기다린다. loaded: false 면 기다리지 않는다 */
async function renderBlocked(
  server: FakeServer,
  onOpenBlock = jest.fn(),
  { loaded = true } = {},
) {
  const view = await renderWithApi(
    <WithdrawalBlockedScreen onOpenBlock={onOpenBlock} onBack={jest.fn()} />,
    { server, session: testSession() },
  );
  await screen.findByRole('header', { name: '계정 탈퇴 불가' });
  if (loaded) {
    await waitFor(() =>
      expect(screen.queryByLabelText('불러오는 중')).toBeNull(),
    );
  }
  return view;
}

const both: WithdrawalBlock[] = [
  { reason: 'WORK_IN_PROGRESS', count: 1 },
  { reason: 'WORK_PENDING_ACCEPT', count: 2 },
];
const cards = () => screen.queryAllByTestId(/^withdrawal-block-[A-Z_]+$/);
const NO_REASON =
  '지금은 탈퇴를 막는 사유가 없어요. 계정 관리에서 다시 시도해 주세요.';

describe('WithdrawalBlockedScreen', () => {
  it('제목은 계정 관리이고 탈퇴 불가 안내를 보여준다', async () => {
    await renderBlocked(eligibilityServer(blocked(both)));

    expect(screen.getByRole('header', { name: '계정 관리' })).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: '계정 탈퇴 불가' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('현재 다음 사유로 인해 탈퇴가 불가능합니다'),
    ).toBeOnTheScreen();
  });

  it('서버가 준 사유마다 건수와 카드를 보여준다 (진행 중인 작업은 연주황, 미완료 배정은 회색)', async () => {
    await renderBlocked(eligibilityServer(blocked(both)));

    expect(
      await screen.findByTestId('withdrawal-block-WORK_IN_PROGRESS'),
    ).toHaveStyle({ backgroundColor: colors.inProgress[4] });
    expect(cards()).toHaveLength(2);
    expect(
      screen.getByTestId('withdrawal-block-WORK_PENDING_ACCEPT'),
    ).toHaveStyle({ backgroundColor: colors.registered[2] });
    expect(
      screen.getByText('현재 작업 중 상태인 작업 1건이 있습니다'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('수락 대기 중인 작업 2건이 있습니다'),
    ).toBeOnTheScreen();
  });

  it('사유가 하나뿐이면 그 카드만 보인다', async () => {
    await renderBlocked(
      eligibilityServer(blocked([{ reason: 'WORK_PENDING_ACCEPT', count: 2 }])),
    );

    expect(
      await screen.findByTestId('withdrawal-block-WORK_PENDING_ACCEPT'),
    ).toBeOnTheScreen();
    expect(cards()).toHaveLength(1);
  });

  it('카드의 > 버튼을 누르면 그 사유를 정리할 곳으로 간다', async () => {
    const onOpenBlock = jest.fn();
    await renderBlocked(eligibilityServer(blocked(both)), onOpenBlock);

    await userEvent.press(
      await screen.findByRole('button', { name: '진행 중인 작업 1건 보기' }),
    );
    await userEvent.press(
      screen.getByRole('button', { name: '미완료 작업 배정 2건 보기' }),
    );

    expect(onOpenBlock).toHaveBeenNthCalledWith(1, 'WORK_IN_PROGRESS');
    expect(onOpenBlock).toHaveBeenNthCalledWith(2, 'WORK_PENDING_ACCEPT');
  });

  it('보일 사유가 없으면 카드 대신 다시 시도하라는 안내를 보여준다', async () => {
    await renderBlocked(eligibilityServer({ withdrawable: true, blocks: [] }));

    expect(await screen.findByText(NO_REASON)).toBeOnTheScreen();
    expect(cards()).toHaveLength(0);
  });

  // 총관리자 넘기기는 웹 관리자에서 하므로 앱 안에 갈 곳이 없다
  it('유일한 총관리자 카드는 > 버튼이 없다', async () => {
    await renderBlocked(
      eligibilityServer(blocked([{ reason: 'SOLE_OWNER', count: 1 }])),
    );

    expect(
      await screen.findByText('총관리자가 나 혼자인 발주사 1곳이 있습니다'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /보기$/ })).toBeNull();
  });

  describe('가능 여부 불러오기', () => {
    it('받는 동안 안내 아래에 진행 표시를 보인다', async () => {
      await renderBlocked(
        createFakeServer().on('GET', MY_ELIGIBILITY_PATH, hang()),
        jest.fn(),
        { loaded: false },
      );

      expect(screen.getByLabelText('불러오는 중')).toBeOnTheScreen();
      expect(cards()).toHaveLength(0);
      expect(screen.queryByText(NO_REASON)).toBeNull();
    });

    it('받지 못하면 안내와 다시 시도를 보이고, 다시 시도로 받아 온다', async () => {
      await renderBlocked(
        createFakeServer().on(
          'GET',
          MY_ELIGIBILITY_PATH,
          fail(500, 'COMMON-500'),
          ok(blocked(both)),
        ),
      );

      expect(
        await screen.findByText('탈퇴할 수 있는지 확인하지 못했어요.'),
      ).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

      expect(
        await screen.findByTestId('withdrawal-block-WORK_IN_PROGRESS'),
      ).toBeOnTheScreen();
    });

    // 계정 관리가 탈퇴를 누른 때 물어 둔 결과를 쓴다. 정하지 않은 경로는 가짜 서버가 실패로 잡는다
    it('계정 관리에서 방금 물은 결과로 바로 그리고 다시 묻지 않는다', async () => {
      const api = createTestApi({ session: testSession() });
      seedMyCache(api.queryClient, { eligibility: blocked(both) });

      await render(
        <WithdrawalBlockedScreen onOpenBlock={jest.fn()} onBack={jest.fn()} />,
        { wrapper: api.wrapper },
      );

      expect(cards()).toHaveLength(2);
      expect(api.server.calls).toHaveLength(0);
    });

    // 보이지 않는 동안에는 캐시가 바뀌어도 다시 그리지 않는다 (subscribed)
    it('다른 화면에 가 있는 동안에는 가능 여부 캐시를 구독하지 않는다', async () => {
      const api = createTestApi({ session: testSession() });
      seedMyCache(api.queryClient, { eligibility: blocked(both) });
      const ui = (focused: boolean) => (
        <WithdrawalBlockedScreen
          focused={focused}
          onOpenBlock={jest.fn()}
          onBack={jest.fn()}
        />
      );
      const { rerender } = await render(ui(true), { wrapper: api.wrapper });

      await rerender(ui(false));
      // React Query 는 구독자에게 다음 차례(setTimeout 0)에 알린다. 그 알림까지 기다린다
      await act(async () => {
        api.queryClient.setQueryData(withdrawalEligibilityQueryKey, {
          withdrawable: true,
          blocks: [],
        });
        await new Promise<void>(resolve => setTimeout(resolve, 10));
      });

      expect(cards()).toHaveLength(2);
    });

    // 사유를 정리하러 다른 탭에 갔다가 돌아왔다
    it('다른 화면에 갔다가 돌아오면 다시 물어 바뀐 사유를 보인다', async () => {
      const api = createTestApi({
        server: eligibilityServer({ withdrawable: true, blocks: [] }),
        session: testSession(),
      });
      seedMyCache(api.queryClient, { eligibility: blocked(both) });
      const ui = (focused: boolean) => (
        <WithdrawalBlockedScreen
          focused={focused}
          onOpenBlock={jest.fn()}
          onBack={jest.fn()}
        />
      );
      const { rerender } = await render(ui(true), { wrapper: api.wrapper });

      await rerender(ui(false));
      expect(api.server.calls).toHaveLength(0);
      await rerender(ui(true));

      expect(await screen.findByText(NO_REASON)).toBeOnTheScreen();
      expect(cards()).toHaveLength(0);
      expect(api.server.callsTo('GET', MY_ELIGIBILITY_PATH)).toHaveLength(1);
    });
  });
});
