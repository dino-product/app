import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { measureRenders } from 'reassure';
import { perfBudget } from '../../../shared/perf/budget';
import { currentWork, homeToday, weeklySchedule } from '../mockData';
import type { LoadState } from '../../../shared/layout/LoadStateView';
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

  // #139: 첫 응답 전에는 스켈레톤, 받으면 내용. 스켈레톤이 깜빡여도 다시 그리지 않고 바뀔 때 한 번만 그린다
  it('스켈레톤에서 받은 내용으로 바뀔 때 한 번만 다시 그린다', async () => {
    let finishLoading = () => {};
    function Harness() {
      const [load, setLoad] = useState<LoadState>({ status: 'loading' });
      finishLoading = () => setLoad({ status: 'ready' });
      return (
        <WorkHomeScreen
          currentWork={load.status === 'ready' ? currentWork : null}
          schedule={load.status === 'ready' ? weeklySchedule : []}
          today={homeToday}
          weekLabel="9. 14. – 9. 20."
          started={false}
          onStartWork={noop}
          onOpenWork={noop}
          onOpenNotifications={noop}
          load={load}
        />
      );
    }

    const result = await measureRenders(<Harness />, {
      scenario: async () => {
        // 스켈레톤이 동작 줄이기 설정을 읽고 깜빡이기 시작할 때까지
        await act(async () => {});
        expect(screen.getByTestId('work-home-skeleton')).toBeOnTheScreen();
        await act(() => finishLoading());
        expect(screen.queryByTestId('work-home-skeleton')).toBeNull();
      },
    });

    // 마운트 1 + 받은 내용 1
    expect(Math.max(...result.counts)).toBe(2);
    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);
});
