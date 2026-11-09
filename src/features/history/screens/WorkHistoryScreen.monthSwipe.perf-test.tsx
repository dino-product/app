import { render, screen, userEvent } from '@testing-library/react-native';
import type { ComponentProps, ReactNode } from 'react';
import { measureRenders } from 'reassure';
import { swipeFrom } from '../../../../jest/responder';
import { SWITCH_DISTANCE } from '../../../shared/gesture/tabSwipe';
import { perfBudget } from '../../../shared/perf/budget';
import type { SummaryCard as SummaryCardType } from '../components/SummaryCard';
import { makeHistoryMock } from '../mockData';
import { WorkHistoryScreen } from './WorkHistoryScreen';

// 작업 이력 목록을 밀어 달을 옮길 때의 렌더 예산 (#153).
// 요약 카드는 memo 다. 카드마다 실제로 그려진 횟수를 세어 달을 바꿔도 바뀌지 않는 카드(누적 완료)는 다시 그리지 않는지 본다
const mockSummaryRenders: Record<string, number> = {};
type SummaryProps = ComponentProps<typeof SummaryCardType>;

// memo 로 감싼 카드의 안쪽 함수를 같은 memo 로 감싸 실제로 그려질 때만 센다 (App.tabSwitch.perf-test 와 같은 방법)
function mockCountedSummary(summaryModule: Record<string, unknown>) {
  const { memo } = jest.requireActual<typeof import('react')>('react');
  const inner = (
    summaryModule.SummaryCard as {
      type: (props: SummaryProps) => ReactNode;
    }
  ).type;
  return {
    ...summaryModule,
    SummaryCard: memo((props: SummaryProps) => {
      mockSummaryRenders[props.label] =
        (mockSummaryRenders[props.label] ?? 0) + 1;
      return inner(props);
    }),
  };
}

jest.mock('../components/SummaryCard', () =>
  mockCountedSummary(jest.requireActual('../components/SummaryCard')),
);

const today = new Date(2026, 8, 28);
const works = makeHistoryMock(today);
const onOpenWork = () => {};
const swipeRows = (dx: number) =>
  swipeFrom(screen.getAllByRole('button', { name: /, 완료, / })[0], {
    from: { x: 200, y: 500 },
    dx,
  });

describe('WorkHistoryScreen 월 밀기 렌더 예산 (#153)', () => {
  it('밀어서 달을 바꾸면 한 번만 다시 그린다', async () => {
    const result = await measureRenders(
      <WorkHistoryScreen today={today} works={works} onOpenWork={onOpenWork} />,
      { scenario: () => swipeRows(SWITCH_DISTANCE + 30) },
    );

    // 마운트 1 + 달 바꿈 1
    expect(Math.max(...result.counts)).toBe(2);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);

  it('달을 바꿔도 누적 완료 카드는 다시 그리지 않는다 (밀기·화살표 모두)', async () => {
    await render(
      <WorkHistoryScreen
        today={today}
        works={works}
        onOpenWork={onOpenWork}
        totalCompleted={132}
      />,
    );
    const before = { ...mockSummaryRenders };

    await swipeRows(SWITCH_DISTANCE + 30);
    await userEvent.press(screen.getByRole('button', { name: '다음 달' }));

    expect(mockSummaryRenders['누적 완료']).toBe(before['누적 완료']);
    // 이번 달 완료는 달마다 수가 달라 다시 그린다 (세기가 실제로 걸렸는지)
    expect(mockSummaryRenders['이번 달 완료']).toBeGreaterThan(
      before['이번 달 완료'],
    );
  });
});
