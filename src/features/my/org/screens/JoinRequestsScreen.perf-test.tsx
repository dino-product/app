import { useState } from 'react';
import { measureRenders } from 'reassure';
import { ApiProvider } from '../../../../shared/api';
import { perfBudget } from '../../../../shared/perf/budget';
import { createTestApi } from '../../../../shared/testing/renderWithApi';
import { testSession } from '../../../../shared/testing/session';
import { parseParticipationRequest } from '../participationApi';
import { participationRequestsKey } from '../participationQueries';
import { createParticipationServer, EXISTING_REQUESTS } from '../testing';
import { JoinRequestsScreen } from './JoinRequestsScreen';

// 렌더마다 새 기기(서버·캐시)로 연다. 신청 현황은 마이페이지 배지가 이미 받아 둔 상태라 캐시에 있고,
// 열 때 뒤에서 다시 받는 목록이 같으면 다시 그리지 않는다 (#116)
function SeededRequests() {
  const [api] = useState(() => {
    const created = createTestApi({
      server: createParticipationServer({ requests: EXISTING_REQUESTS }).server,
      session: testSession(),
    });
    created.queryClient.setQueryData(
      participationRequestsKey,
      EXISTING_REQUESTS.map(parseParticipationRequest),
    );
    return created;
  });
  return (
    <ApiProvider client={api.client} queryClient={api.queryClient}>
      <JoinRequestsScreen onJoin={() => {}} onBack={() => {}} />
    </ApiProvider>
  );
}

describe('JoinRequestsScreen 렌더 예산', () => {
  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(<SeededRequests />);

    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
    // FlatList 화면을 10회 반복 측정하므로 CI 러너에서는 기본 5초를 넘긴다
  }, 30_000);
});
