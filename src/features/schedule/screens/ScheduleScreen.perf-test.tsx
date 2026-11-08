import { act, fireEvent, screen } from '@testing-library/react-native';
import { measureRenders } from 'reassure';
import { drag, touchesEvent } from '../../../../jest/gesture';
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
  // FlatList(VirtualizedList)는 셀 배치가 바뀌면 약 50ms 뒤 타이머로 한 번 더 그린다.
  // CPU 가 바쁘면 시나리오가 그 시간보다 길어져 타이머가 측정 창에 끼어들고 렌더 수가 +1 로 흔들린다 (#125).
  // 가짜 타이머로 두면 사용자 동작이 일으킨 렌더만 세고, 실행 환경의 속도에 결과가 좌우되지 않는다.
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(
      <ScheduleScreen
        today={today}
        confirmed={confirmed}
        pending={pending}
        onAccept={async () => true}
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
        onAccept={async () => true}
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

  // 주간 줄을 만지는 동안(#99), 펼친 달력을 가로로 미는 동안(#144) 리스트 스크롤을 막는다.
  // 막고 풀 때 리스트만 다시 그리고 달력은 그대로 두며, 방향을 정하는 움직임마다 다시 그리지 않는다
  it.each([
    { label: '주간 줄', testID: 'week-strip', open: false },
    { label: '펼친 달력', testID: 'month-calendar', open: true },
  ])(
    '$label 을 만져 막을 때와 뗄 때 한 번씩만 다시 그린다',
    async ({ testID, open }) => {
      const result = await measureRenders(
        <ScheduleScreen
          today={today}
          confirmed={confirmed}
          pending={pending}
          onAccept={async () => true}
          onReject={() => {}}
          onOpenRequest={() => {}}
        />,
        {
          scenario: async () => {
            if (open) {
              await fireEvent.press(
                screen.getByRole('button', { name: '달력 펼치기' }),
              );
            }
            const area = screen.getByTestId(testID);
            await act(() =>
              area.props.onTouchStart(
                touchesEvent({ changed: [0], touches: [0] }),
              ),
            );
            // 펼친 달력은 가로로 정해질 때 막는다 (iOS)
            for (const x of open ? [-4, -8, -12, -30, -60] : []) {
              await act(() =>
                area.props.onTouchMove(
                  touchesEvent({ changed: [0], touches: [0], x }),
                ),
              );
            }
            await act(() =>
              area.props.onTouchEnd(
                touchesEvent({ changed: [0], touches: [] }),
              ),
            );
          },
        },
      );

      // 마운트 1 (+ 펼치기 1) + 막기 1 + 풀기 1
      expect(Math.max(...result.counts)).toBe(open ? 4 : 3);
      expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
        perfBudget.render.maxRedundantUpdates,
      );
    },
    30_000,
  );

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
          onAccept={async () => true}
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
          onAccept={async () => true}
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
        onAccept={async () => true}
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
