import { measureRenders } from 'reassure';
import { perfBudget } from '../../../shared/perf/budget';
import { membershipsMock, profileMock } from '../mockData';
import { MyPageScreen } from './MyPageScreen';

describe('MyPageScreen 렌더 예산', () => {
  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(
      <MyPageScreen
        profile={profileMock}
        memberships={membershipsMock}
        pendingRequestCount={3}
        onOpenNotifications={() => {}}
        onEditProfile={() => {}}
        onOpenRequestStatus={() => {}}
        onJoinOrganization={() => {}}
        onOpenNotificationSettings={() => {}}
        onOpenTerms={() => {}}
        onOpenAccount={() => {}}
      />,
    );

    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  });
});
