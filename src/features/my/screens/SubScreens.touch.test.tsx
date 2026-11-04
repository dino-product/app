import { render, screen } from '@testing-library/react-native';
import { createTestApi } from '../../../shared/testing/renderWithApi';
import { testSession } from '../../../shared/testing/session';
import {
  expectIconButtonTouchTarget,
  expectMinTouchTarget,
  stylePt,
} from '../../../shared/testing/touchTarget';
import { seedMyCache } from '../profileTesting';
import { AccountScreen } from './AccountScreen';
import { WithdrawalBlockedScreen } from './WithdrawalBlockedScreen';

// 마이 탭 하위 화면이 같이 쓰는 머리(SubScreenHeader)·메뉴 행(MenuRow)과 탈퇴 불가의 > 버튼
describe('마이 하위 화면 터치 영역', () => {
  const renderAccount = () =>
    render(
      <AccountScreen
        onBack={jest.fn()}
        onLogout={jest.fn()}
        checkWithdrawal={jest.fn()}
        onOpenWithdrawal={jest.fn()}
        onOpenWithdrawalBlocked={jest.fn()}
      />,
    );

  it('뒤로 가기 버튼은 24 아이콘 그대로 최소 터치 영역으로 넓힌다', async () => {
    await renderAccount();

    expectIconButtonTouchTarget(
      screen.getByRole('button', { name: '뒤로 가기' }),
    );
  });

  it('메뉴 행은 넓히지 않아도 최소 터치 영역 이상이다', async () => {
    await renderAccount();

    const row = screen.getByRole('button', { name: '로그아웃' });
    expectMinTouchTarget(row, { height: stylePt(row, 'minHeight') });
  });

  it('탈퇴 불가 카드의 > 버튼은 32 원을 최소 터치 영역으로 넓힌다', async () => {
    const api = createTestApi({ session: testSession() });
    seedMyCache(api.queryClient, {
      eligibility: {
        withdrawable: false,
        blocks: [{ reason: 'WORK_IN_PROGRESS', count: 1 }],
      },
    });
    await render(
      <WithdrawalBlockedScreen onOpenBlock={jest.fn()} onBack={jest.fn()} />,
      { wrapper: api.wrapper },
    );

    const button = screen.getByRole('button', {
      name: '진행 중인 작업 1건 보기',
    });
    expectMinTouchTarget(button, {
      width: stylePt(button, 'width'),
      height: stylePt(button, 'height'),
    });
  });
});
