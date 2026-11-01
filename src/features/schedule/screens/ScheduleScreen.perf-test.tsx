import { screen } from '@testing-library/react-native';
import { measureRenders } from 'reassure';
import { drag } from '../../../../jest/gesture';
import { perfBudget } from '../../../shared/perf/budget';
import { makeScheduleMock } from '../mockData';
import { ScheduleScreen } from './ScheduleScreen';

const today = new Date(2026, 11, 15);
const { confirmed, pending } = makeScheduleMock(today);

describe('ScheduleScreen 렌더 예산', () => {
  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(
      <ScheduleScreen
        today={today}
        confirmed={confirmed}
        pending={pending}
        onAccept={() => {}}
        onReject={() => {}}
        onOpenRequest={() => {}}
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

  it('주간 줄을 밀어 주를 넘기면 한 번만 다시 그린다', async () => {
    const result = await measureRenders(
      <ScheduleScreen
        today={today}
        confirmed={confirmed}
        pending={pending}
        onAccept={() => {}}
        onReject={() => {}}
        onOpenRequest={() => {}}
      />,
      {
        scenario: async () => {
          await drag(screen.getByTestId('week-strip').props, { dx: -80 });
        },
      },
    );

    // 마운트 1 + 주 넘김 1. 선택 날짜와 보이는 달을 바꾸는 두 setState 는 한 번에 처리된다
    expect(Math.max(...result.counts)).toBe(2);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);
});
