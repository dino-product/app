import { render, screen, userEvent } from '@testing-library/react-native';
import { workDetail } from '../../work/mockData';
import { RequestDetailScreen } from './RequestDetailScreen';

describe('RequestDetailScreen', () => {
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
});
