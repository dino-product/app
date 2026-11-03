import { measureRenders } from 'reassure';
import { perfBudget } from '../shared/perf/budget';
import { signedInAuth } from '../features/onboarding/model';
import App from './App';

describe('App 렌더 예산', () => {
  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(<App initialAuth={signedInAuth()} />);

    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  });

  // 처음 켜면 로그인 화면부터 연다 (#85)
  it('로그아웃 상태로 마운트해도 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(<App />);

    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  });
});
