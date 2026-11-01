import { render, screen } from '@testing-library/react-native';
import { expectIconButtonTouchTarget } from '../../../shared/testing/touchTarget';
import { RejectReasonScreen } from './RejectReasonScreen';

describe('RejectReasonScreen 터치 영역', () => {
  it('뒤로 가기 버튼은 24 아이콘 그대로 최소 터치 영역으로 넓힌다', async () => {
    await render(
      <RejectReasonScreen onBack={jest.fn()} onSubmit={jest.fn()} />,
    );

    expectIconButtonTouchTarget(
      screen.getByRole('button', { name: '뒤로 가기' }),
    );
  });
});
