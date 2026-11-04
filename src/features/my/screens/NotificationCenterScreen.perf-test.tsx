import { measureRenders } from 'reassure';
import { perfBudget } from '../../../shared/perf/budget';
import { cachedNotificationTestApi } from '../notificationTesting';
import { NotificationCenterScreen } from './NotificationCenterScreen';

const now = new Date(2026, 10, 2, 15, 0);

describe('NotificationCenterScreen 렌더 예산', () => {
  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    // 캐시에 미리 넣은 목록으로 그린다. 마운트 때 다시 받지 않아 서버 응답이 렌더 횟수에 섞이지 않는다
    const api = cachedNotificationTestApi(now);

    const result = await measureRenders(
      <NotificationCenterScreen onOpen={() => {}} onBack={() => {}} />,
      { wrapper: api.wrapper },
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
