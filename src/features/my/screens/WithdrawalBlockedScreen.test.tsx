import { render, screen, userEvent } from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import type { WithdrawalBlock } from '../model';
import { WithdrawalBlockedScreen } from './WithdrawalBlockedScreen';

const renderBlocked = (
  blocks: readonly WithdrawalBlock[],
  onOpenBlock = jest.fn(),
) =>
  render(
    <WithdrawalBlockedScreen
      blocks={blocks}
      onOpenBlock={onOpenBlock}
      onBack={jest.fn()}
    />,
  );

const both: WithdrawalBlock[] = [
  { reason: 'WORK_IN_PROGRESS', count: 1 },
  { reason: 'WORK_PENDING_ACCEPT', count: 2 },
];

describe('WithdrawalBlockedScreen', () => {
  it('제목은 계정 관리이고 탈퇴 불가 안내를 보여준다', async () => {
    await renderBlocked(both);

    expect(screen.getByRole('header', { name: '계정 관리' })).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: '계정 탈퇴 불가' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('현재 다음 사유로 인해 탈퇴가 불가능합니다'),
    ).toBeOnTheScreen();
  });

  it('사유마다 카드를 보여준다 (진행 중인 작업은 연주황, 미완료 배정은 회색)', async () => {
    await renderBlocked(both);

    expect(screen.getAllByTestId(/^withdrawal-block-[A-Z_]+$/)).toHaveLength(2);
    expect(screen.getByTestId('withdrawal-block-WORK_IN_PROGRESS')).toHaveStyle(
      { backgroundColor: colors.inProgress[4] },
    );
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
    await renderBlocked([{ reason: 'WORK_PENDING_ACCEPT', count: 2 }]);

    expect(screen.getAllByTestId(/^withdrawal-block-[A-Z_]+$/)).toHaveLength(1);
    expect(
      screen.queryByTestId('withdrawal-block-WORK_IN_PROGRESS'),
    ).toBeNull();
  });

  it('카드의 > 버튼을 누르면 그 사유를 정리할 곳으로 간다', async () => {
    const onOpenBlock = jest.fn();
    await renderBlocked(both, onOpenBlock);

    await userEvent.press(
      screen.getByRole('button', { name: '진행 중인 작업 1건 보기' }),
    );
    await userEvent.press(
      screen.getByRole('button', { name: '미완료 작업 배정 2건 보기' }),
    );

    expect(onOpenBlock).toHaveBeenNthCalledWith(1, 'WORK_IN_PROGRESS');
    expect(onOpenBlock).toHaveBeenNthCalledWith(2, 'WORK_PENDING_ACCEPT');
  });

  it('보일 사유가 없으면 카드 대신 다시 시도하라는 안내를 보여준다', async () => {
    await renderBlocked([{ reason: 'WORK_IN_PROGRESS', count: 0 }]);

    expect(screen.queryAllByTestId(/^withdrawal-block-[A-Z_]+$/)).toHaveLength(
      0,
    );
    expect(
      screen.getByText(
        '지금은 탈퇴를 막는 사유가 없어요. 계정 관리에서 다시 시도해 주세요.',
      ),
    ).toBeOnTheScreen();
  });

  // 총관리자 넘기기는 웹 관리자에서 하므로 앱 안에 갈 곳이 없다
  it('유일한 총관리자 카드는 > 버튼이 없다', async () => {
    await renderBlocked([{ reason: 'SOLE_OWNER', count: 1 }]);

    expect(
      screen.getByText('총관리자가 나 혼자인 발주사 1곳이 있습니다'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /보기$/ })).toBeNull();
  });
});
