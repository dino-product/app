import { render, screen, userEvent } from '@testing-library/react-native';
import { expectOnlySkeletons } from '../../../shared/testing/skeleton';
import { WorkDetailStatusScreen } from './WorkDetailStatusScreen';

describe('WorkDetailStatusScreen', () => {
  it('불러오는 동안 "작업 상세" 제목과 진행 표시를 보이고 뒤로 갈 수 있다', async () => {
    const onBack = jest.fn();
    await render(
      <WorkDetailStatusScreen state={{ status: 'loading' }} onBack={onBack} />,
    );

    expect(screen.getByRole('header', { name: '작업 상세' })).toBeOnTheScreen();
    // 제목·정보 카드를 닮은 스켈레톤이고 스피너는 없다 (#139)
    expectOnlySkeletons('work-detail-skeleton');
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('불러오지 못하면 문구와 다시 시도를 보인다', async () => {
    const onRetry = jest.fn();
    await render(
      <WorkDetailStatusScreen
        state={{ status: 'error', message: '네트워크 문구', onRetry }}
        onBack={jest.fn()}
      />,
    );

    await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

    expect(screen.getByText('네트워크 문구')).toBeOnTheScreen();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('볼 수 없는 작업이면 그렇게 알리고 다시 시도는 없다 (뒤로 가기만)', async () => {
    const onBack = jest.fn();
    await render(
      <WorkDetailStatusScreen
        state={{ status: 'unavailable' }}
        onBack={onBack}
      />,
    );

    expect(screen.getByText('볼 수 없는 작업이에요')).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: '다시 시도' }),
    ).not.toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
