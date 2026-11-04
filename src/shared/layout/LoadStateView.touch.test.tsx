import { render, screen } from '@testing-library/react-native';
import { expectMinTouchTarget, stylePt } from '../testing/touchTarget';
import { LoadStateView } from './LoadStateView';

describe('LoadStateView 터치 영역', () => {
  it('"다시 시도" 버튼은 최소 터치 영역 이상이다', async () => {
    await render(
      <LoadStateView
        state={{ status: 'error', message: '실패', onRetry: jest.fn() }}
      />,
    );

    const button = screen.getByRole('button', { name: '다시 시도' });
    expectMinTouchTarget(button, { height: stylePt(button, 'minHeight') });
  });
});
