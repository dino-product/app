import { render, screen, userEvent } from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import { haptic } from '../../../shared/haptics';
import { workDetail } from '../../work/mockData';
import { RequestDetailScreen } from './RequestDetailScreen';

jest.mock('../../../shared/haptics', () => ({
  haptic: { success: jest.fn(), warning: jest.fn(), selection: jest.fn() },
}));

describe('RequestDetailScreen', () => {
  it('수락하면 성공 햅틱을, 거절 화면으로 갈 때는 울리지 않는다', async () => {
    jest.mocked(haptic.success).mockClear();
    await render(
      <RequestDetailScreen
        work={workDetail}
        onBack={jest.fn()}
        onAccept={jest.fn()}
        onReject={jest.fn()}
        onCall={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );

    await userEvent.press(screen.getByRole('button', { name: '거절' }));
    expect(haptic.success).not.toHaveBeenCalled();

    await userEvent.press(screen.getByRole('button', { name: '수락' }));
    expect(haptic.success).toHaveBeenCalledTimes(1);
  });

  it('작업 정보를 보여주고 하단의 거절·수락·뒤로가 콜백을 부른다', async () => {
    const onAccept = jest.fn();
    const onReject = jest.fn();
    const onBack = jest.fn();
    await render(
      <RequestDetailScreen
        work={workDetail}
        onBack={onBack}
        onAccept={onAccept}
        onReject={onReject}
        onCall={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );

    expect(screen.getByRole('header', { name: '작업 상세' })).toBeOnTheScreen();
    expect(screen.getByText('도어록 교체')).toBeOnTheScreen();
    expect(screen.getByText('박민지')).toBeOnTheScreen();
    expect(screen.getByText('75,000원')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '수락' }));
    await userEvent.press(screen.getByRole('button', { name: '거절' }));
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onAccept).toHaveBeenCalled();
    expect(onReject).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });

  // 작업 정보 영역은 작업 수행 상세와 같은 컴포넌트를 쓴다
  it('작업 내용 카드는 회색 채움이다', async () => {
    await render(
      <RequestDetailScreen
        work={workDetail}
        onBack={jest.fn()}
        onAccept={jest.fn()}
        onReject={jest.fn()}
        onCall={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );

    expect(screen.getByTestId('work-content-card')).toHaveStyle({
      backgroundColor: colors.gray[50],
    });
  });
});
