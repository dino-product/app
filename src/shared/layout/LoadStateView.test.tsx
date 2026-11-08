import { render, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { Skeleton, SkeletonBlock } from '../design-system/components/Skeleton';
import { LoadStateView } from './LoadStateView';

describe('LoadStateView', () => {
  // 스피너(ActivityIndicator)도 '불러오는 중' 으로 읽혔다. 그렇게 읽히는 요소가 스켈레톤 하나뿐이면 스피너가 없다
  it('불러오는 중에는 스피너 대신 기본 스켈레톤을 보이고, 스크린리더는 "불러오는 중" 하나로 읽는다', async () => {
    await render(<LoadStateView state={{ status: 'loading' }} />);

    expect(screen.getAllByLabelText('불러오는 중')).toEqual([
      screen.getByTestId('load-state-skeleton'),
    ]);
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('화면이 그 자리를 닮은 스켈레톤을 주면 기본 스켈레톤 대신 그것을 보인다', async () => {
    await render(
      <LoadStateView
        state={{ status: 'loading' }}
        skeleton={
          <Skeleton testID="card-skeleton">
            <SkeletonBlock height={120} />
          </Skeleton>
        }
      />,
    );

    expect(screen.getAllByLabelText('불러오는 중')).toEqual([
      screen.getByTestId('card-skeleton'),
    ]);
    expect(screen.queryByTestId('load-state-skeleton')).not.toBeOnTheScreen();
  });

  it('실패하면 스켈레톤 없이 문구와 "다시 시도" 만 보인다', async () => {
    await render(
      <LoadStateView
        state={{
          status: 'error',
          message: '네트워크 문구',
          onRetry: jest.fn(),
        }}
        skeleton={
          <Skeleton testID="card-skeleton">
            <SkeletonBlock height={120} />
          </Skeleton>
        }
      />,
    );

    expect(screen.queryByLabelText('불러오는 중')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeOnTheScreen();
  });

  it('실패하면 문구와 "다시 시도" 를 보이고, 누르면 다시 시도한다', async () => {
    const onRetry = jest.fn();
    await render(
      <LoadStateView
        state={{ status: 'error', message: '네트워크 문구', onRetry }}
      />,
    );

    expect(screen.getByText('네트워크 문구')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // accessibilityLiveRegion 은 Android 만 읽어 iOS 는 따로 알린다
  it('오류가 나타나면 그 문구를 스크린리더로 알리고, 같은 문구로 다시 그려도 다시 알리지 않는다', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {})
      .mockClear();
    const state = {
      status: 'error',
      message: '네트워크 문구',
      onRetry: jest.fn(),
    } as const;
    const { rerender } = await render(<LoadStateView state={state} />);

    expect(announce).toHaveBeenCalledWith('네트워크 문구');
    await rerender(<LoadStateView state={{ ...state, onRetry: jest.fn() }} />);
    expect(announce).toHaveBeenCalledTimes(1);

    announce.mockRestore();
  });

  it('불러오는 중에는 알리지 않는다', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockClear();

    await render(<LoadStateView state={{ status: 'loading' }} />);

    expect(announce).not.toHaveBeenCalled();
    announce.mockRestore();
  });
});
