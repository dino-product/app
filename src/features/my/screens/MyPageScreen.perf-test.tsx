import { useState } from 'react';
import { measureRenders } from 'reassure';
import { perfBudget } from '../../../shared/perf/budget';
import { createTestApi } from '../../../shared/testing/renderWithApi';
import { testSession } from '../../../shared/testing/session';
import { myServer, seedMyCache } from '../profileTesting';
import { MyPageScreen } from './MyPageScreen';

// 렌더마다 프로필·소속을 받아 둔 새 캐시로 연다 (켤 때 가입 단계 확인이 프로필을 받아 둔 경우와 같다)
function SeededMyPage() {
  const [api] = useState(() => {
    const created = createTestApi({
      server: myServer(),
      session: testSession(),
    });
    seedMyCache(created.queryClient);
    return created;
  });
  return (
    <api.wrapper>
      <MyPageScreen
        pendingRequestCount={3}
        onOpenNotifications={() => {}}
        onEditProfile={() => {}}
        onOpenRequestStatus={() => {}}
        onJoinOrganization={() => {}}
        onOpenNotificationSettings={() => {}}
        onOpenTerms={() => {}}
        onOpenAccount={() => {}}
      />
    </api.wrapper>
  );
}

describe('MyPageScreen 렌더 예산', () => {
  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(<SeededMyPage />);

    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  });
});
