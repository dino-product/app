import { render, screen, userEvent } from '@testing-library/react-native';
import { SessionRestoreFailedScreen } from './SessionRestoreFailedScreen';

// 앱을 다시 켤 때 저장된 세션으로 프로필을 받지 못한 경우 (#113). Figma 에 없는 화면이라 기본 구성이다
describe('SessionRestoreFailedScreen', () => {
  it('연결할 수 없다고 알리고 다시 시도를 누르면 알린다', async () => {
    const onRetry = jest.fn();
    await render(<SessionRestoreFailedScreen onRetry={onRetry} />);

    expect(
      screen.getByRole('header', { name: '연결할 수 없어요' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('인터넷 연결을 확인한 뒤 다시 시도해 주세요.'),
    ).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
