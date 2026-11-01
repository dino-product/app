import { render, screen } from '@testing-library/react-native';
import { expectIconButtonTouchTarget } from '../../../shared/testing/touchTarget';
import { workDetail } from '../mockData';
import { WorkDetailScreen } from './WorkDetailScreen';

describe('WorkDetailScreen 터치 영역', () => {
  it('뒤로 가기 버튼은 24 아이콘 그대로 최소 터치 영역으로 넓힌다', async () => {
    await render(
      <WorkDetailScreen
        work={workDetail}
        onBack={jest.fn()}
        onSubmitReport={jest.fn(() => ({
          kind: 'submitted' as const,
          at: '10.01 15:15',
        }))}
        onDone={jest.fn()}
        onCall={jest.fn()}
        onNavigate={jest.fn()}
        onPickPhoto={jest.fn(async () => 'mock://photo')}
      />,
    );

    expectIconButtonTouchTarget(
      screen.getByRole('button', { name: '뒤로 가기' }),
    );
  });
});
