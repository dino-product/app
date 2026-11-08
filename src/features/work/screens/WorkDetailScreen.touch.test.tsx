import { render, screen } from '@testing-library/react-native';
import {
  expectIconButtonTouchTarget,
  expectMinTouchTarget,
  stylePt,
} from '../../../shared/testing/touchTarget';
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
        onOpenMap={jest.fn()}
        onPickPhoto={jest.fn(async () => ['mock://photo'])}
      />,
    );

    expectIconButtonTouchTarget(
      screen.getByRole('button', { name: '뒤로 가기' }),
    );
  });

  it('작업전 작업의 "작업 시작" 은 최소 터치 영역 이상이다', async () => {
    await render(
      <WorkDetailScreen
        work={{ ...workDetail, workStatus: 'ACCEPTED' }}
        onBack={jest.fn()}
        onSubmitReport={jest.fn()}
        onDone={jest.fn()}
        onCall={jest.fn()}
        onNavigate={jest.fn()}
        onOpenMap={jest.fn()}
        onPickPhoto={jest.fn(async () => [])}
        onStartWork={jest.fn()}
      />,
    );

    const start = screen.getByRole('button', { name: '작업 시작' });
    expectMinTouchTarget(start, { height: stylePt(start, 'minHeight') });
  });
});
