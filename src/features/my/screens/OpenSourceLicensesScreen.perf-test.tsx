import { measureRenders } from 'reassure';
import { perfBudget } from '../../../shared/perf/budget';
import { OpenSourceLicensesScreen } from './OpenSourceLicensesScreen';

// 오픈소스 라이선스 (#232). 고지 내용이 상수라 마운트 뒤 다시 그릴 일이 없다
describe('OpenSourceLicensesScreen 렌더 예산', () => {
  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(
      <OpenSourceLicensesScreen onBack={() => {}} />,
    );

    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
    // SectionList 화면을 10회 반복 측정하므로 CI 러너에서는 기본 5초를 넘길 수 있다
  }, 30_000);
});
