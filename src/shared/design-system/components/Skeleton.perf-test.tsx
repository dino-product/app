import { act } from '@testing-library/react-native';
import { measureRenders } from 'reassure';
import { perfBudget } from '../../perf/budget';
import { Skeleton, SkeletonBlock, SkeletonLine } from './Skeleton';

describe('Skeleton 렌더 예산', () => {
  // 깜빡임은 네이티브 루프라, 설정을 읽고 루프를 시작해도 다시 그리지 않는다 (#139)
  it('마운트한 뒤 동작 줄이기 설정을 읽고 깜빡이기 시작해도 다시 그리지 않는다', async () => {
    const result = await measureRenders(
      <Skeleton>
        <SkeletonBlock width={60} height={60} radius={30} />
        <SkeletonLine variant="Body/S/SemiBold" width={120} />
      </Skeleton>,
      {
        scenario: async () => {
          await act(async () => {});
        },
      },
    );

    expect(Math.max(...result.counts)).toBe(1);
    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  });
});
