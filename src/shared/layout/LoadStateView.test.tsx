import { render, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { LoadStateView } from './LoadStateView';

describe('LoadStateView', () => {
  it('불러오는 중에는 스크린리더가 읽는 진행 표시를 보인다', async () => {
    await render(<LoadStateView state={{ status: 'loading' }} />);

    expect(screen.getByLabelText('불러오는 중')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
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
