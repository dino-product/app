import { measureRenders } from 'reassure';
import { perfBudget } from '../../../../shared/perf/budget';
import { participationRequestsMock } from '../mockData';
import { pendingRequests } from '../model';
import { JoinRequestsScreen } from './JoinRequestsScreen';

const requests = pendingRequests(participationRequestsMock);

describe('JoinRequestsScreen 렌더 예산', () => {
  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(
      <JoinRequestsScreen
        requests={requests}
        onCancel={() => {}}
        onJoin={() => {}}
        onBack={() => {}}
      />,
    );

    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
    // FlatList 화면을 10회 반복 측정하므로 CI 러너에서는 기본 5초를 넘긴다
  }, 30_000);
});
