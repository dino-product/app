import { render, screen } from '@testing-library/react-native';
import { expectIconButtonTouchTarget } from '../../../shared/testing/touchTarget';
import { workDetail } from '../../work/mockData';
import { RequestDetailScreen } from './RequestDetailScreen';

describe('RequestDetailScreen 터치 영역', () => {
  it('뒤로 가기 버튼은 24 아이콘 그대로 최소 터치 영역으로 넓힌다', async () => {
    await render(
      <RequestDetailScreen
        work={workDetail}
        onBack={jest.fn()}
        onAccept={jest.fn()}
        onReject={jest.fn()}
        onCall={jest.fn()}
        onNavigate={jest.fn()}
        onOpenMap={jest.fn()}
      />,
    );

    expectIconButtonTouchTarget(
      screen.getByRole('button', { name: '뒤로 가기' }),
    );
  });
});
