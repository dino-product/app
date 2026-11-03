import { fireEvent, screen } from '@testing-library/react-native';
import { measureRenders } from 'reassure';
import { perfBudget } from '../../../shared/perf/budget';
import { makeHistoryMock } from '../mockData';
import { WorkHistoryScreen } from './WorkHistoryScreen';

const today = new Date(2026, 8, 28);
const works = makeHistoryMock(today);
const onOpenWork = () => {};

describe('WorkHistoryScreen 렌더 예산', () => {
  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(
      <WorkHistoryScreen today={today} works={works} onOpenWork={onOpenWork} />,
    );

    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
    // FlatList 화면을 10회 반복 측정하므로 CI 러너에서는 기본 5초를 넘긴다
  }, 30_000);

  it('◀ 로 달을 바꾸면 한 번만 다시 그린다', async () => {
    const result = await measureRenders(
      <WorkHistoryScreen today={today} works={works} onOpenWork={onOpenWork} />,
      {
        scenario: async () => {
          await fireEvent.press(
            screen.getByRole('button', { name: '이전 달' }),
          );
        },
      },
    );

    // 마운트 1 + 달 바꿈 1
    expect(Math.max(...result.counts)).toBe(2);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);
});
