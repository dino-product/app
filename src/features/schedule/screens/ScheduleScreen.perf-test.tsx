import { fireEvent, screen } from '@testing-library/react-native';
import { measureRenders } from 'reassure';
import { drag } from '../../../../jest/gesture';
import { holdNativeAnimations } from '../../../../jest/nativeAnimation';
import { perfBudget } from '../../../shared/perf/budget';
import { makeScheduleMock } from '../mockData';
import { ScheduleScreen } from './ScheduleScreen';

const today = new Date(2026, 11, 15);
const { confirmed, pending } = makeScheduleMock(today);

// 폭을 재야 미끄러져 넘긴다 (재기 전에는 바로 넘긴다)
const layoutTrack = (testID: string) =>
  fireEvent(screen.getByTestId(testID), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 69 } },
  });

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

    // 마운트 1 + 주 넘김 1. 보이는 주만 바꾸고 고른 날·날짜 머리·일정은 다시 계산하지 않는다
    expect(Math.max(...result.counts)).toBe(2);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);

  describe('넘김 애니메이션', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('주간 줄을 끌어 넘기면 끄는 동안 다시 그리지 않고, 다 넘어간 뒤 한 번만 다시 그린다', async () => {
      const { finish } = holdNativeAnimations();
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
            await layoutTrack('week-strip-track');
            await drag(screen.getByTestId('week-strip').props, { dx: -80 });
            await finish();
          },
        },
      );

      // 마운트 1 + 넘김 확정 1. 트랙의 페이지 자리와 보이는 주가 한 번에 바뀐다
      expect(Math.max(...result.counts)).toBe(2);
      expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
        perfBudget.render.maxRedundantUpdates,
      );
    }, 30_000);

    it('펼친 달력을 다음 달 버튼으로 넘기면 다 넘어간 뒤 한 번만 다시 그린다', async () => {
      const { finish } = holdNativeAnimations();
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
            await fireEvent.press(
              screen.getByRole('button', { name: '달력 펼치기' }),
            );
            await layoutTrack('month-calendar-track');
            await fireEvent.press(
              screen.getByRole('button', { name: '다음 달' }),
            );
            await finish();
          },
        },
      );

      // 마운트 1 + 펼치기 1 + 넘김 확정 1
      expect(Math.max(...result.counts)).toBe(3);
      expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
        perfBudget.render.maxRedundantUpdates,
      );
    }, 30_000);
  });

  it('달력을 펼쳐 날짜를 골라도 한 번씩만 다시 그린다', async () => {
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
        // userEvent 는 Pressable 의 눌림 상태 렌더까지 세므로 onPress 만 부른다
        scenario: async () => {
          await fireEvent.press(
            screen.getByRole('button', { name: '달력 펼치기' }),
          );
          await fireEvent.press(
            screen.getByRole('button', { name: '12월 16일 수요일' }),
          );
        },
      },
    );

    // 마운트 1 + 펼치기 1 + 날짜 고르기 1. 날짜별 일정 개수는 렌더 중에 세고(useMemo) 상태로 따로 두지 않는다
    expect(Math.max(...result.counts)).toBe(3);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);
});
