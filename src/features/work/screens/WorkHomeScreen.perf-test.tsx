import { fireEvent, screen } from '@testing-library/react-native';
import { measureRenders } from 'reassure';
import { perfBudget } from '../../../shared/perf/budget';
import { currentWork, homeToday, weeklySchedule } from '../mockData';
import { WorkHomeScreen } from './WorkHomeScreen';

const noop = () => {};

describe('WorkHomeScreen 렌더 예산', () => {
  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(
      <WorkHomeScreen
        currentWork={currentWork}
        schedule={weeklySchedule}
        today={homeToday}
        weekLabel="9. 14. – 9. 20."
        started={false}
        onStartWork={noop}
        onOpenWork={noop}
        onOpenNotifications={noop}
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

  it('진행할 작업도 이번 주 일정도 없는 빈 상태에서도 예산 이내다', async () => {
    const result = await measureRenders(
      <WorkHomeScreen
        currentWork={null}
        schedule={[]}
        today={homeToday}
        weekLabel="9. 14. – 9. 20."
        started={false}
        onStartWork={noop}
        onOpenWork={noop}
        onOpenNotifications={noop}
      />,
    );

    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);

  // #94·#147: 블록 보기(기본)에서 목록으로 바꿨다가 돌아오고 날짜를 고를 때마다 한 번씩만 다시 그린다.
  // 측정을 여러 번 되풀이하므로 시나리오는 처음과 같은 보기(블록)로 끝나 다음 측정도 같은 보기로 연다
  it('보기를 바꾸고 날짜를 고르면 동작마다 한 번만 다시 그린다', async () => {
    const result = await measureRenders(
      <WorkHomeScreen
        currentWork={currentWork}
        schedule={weeklySchedule}
        today={homeToday}
        weekLabel="9. 14. – 9. 20."
        started={false}
        onStartWork={noop}
        onOpenWork={noop}
        onOpenNotifications={noop}
      />,
      {
        scenario: async () => {
          await fireEvent.press(
            screen.getByRole('button', { name: '목록 보기' }),
          );
          await fireEvent.press(
            screen.getByRole('button', { name: '블록 보기' }),
          );
          await fireEvent.press(
            screen.getByRole('button', { name: '9월 15일 화요일' }),
          );
        },
      },
    );

    // 마운트 1 + 목록으로 1 + 블록으로 1 + 날짜 고름 1
    expect(Math.max(...result.counts)).toBe(4);
    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);

  // #147: 이미 고른 보기를 다시 눌러도 다시 그리지 않는다
  it('고른 보기를 다시 누르면 다시 그리지 않는다', async () => {
    const result = await measureRenders(
      <WorkHomeScreen
        currentWork={currentWork}
        schedule={weeklySchedule}
        today={homeToday}
        weekLabel="9. 14. – 9. 20."
        started={false}
        onStartWork={noop}
        onOpenWork={noop}
        onOpenNotifications={noop}
      />,
      {
        scenario: async () => {
          await fireEvent.press(
            screen.getByRole('button', { name: '블록 보기' }),
          );
        },
      },
    );

    expect(Math.max(...result.counts)).toBe(1);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);
});
