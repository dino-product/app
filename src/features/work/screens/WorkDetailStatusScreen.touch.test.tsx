import { render, screen } from '@testing-library/react-native';
import { expectIconButtonTouchTarget } from '../../../shared/testing/touchTarget';
import { WorkDetailStatusScreen } from './WorkDetailStatusScreen';

describe('WorkDetailStatusScreen 터치 영역', () => {
  it('뒤로 가기 버튼은 24 아이콘 그대로 최소 터치 영역으로 넓힌다', async () => {
    await render(
      <WorkDetailStatusScreen
        state={{ status: 'unavailable' }}
        onBack={jest.fn()}
      />,
    );

    expectIconButtonTouchTarget(
      screen.getByRole('button', { name: '뒤로 가기' }),
    );
  });
});
