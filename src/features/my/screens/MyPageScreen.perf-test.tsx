import { measureRenders } from 'reassure';
import { perfBudget } from '../../../shared/perf/budget';
import { myMemberships, myProfile } from '../profileTesting';
import { MyPageScreen } from './MyPageScreen';

describe('MyPageScreen 렌더 예산', () => {
  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(
      <MyPageScreen
        profile={{ status: 'ready', data: myProfile }}
        memberships={{ status: 'ready', data: myMemberships }}
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
