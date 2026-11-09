import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps, ReactNode } from 'react';
import { measureRenders } from 'reassure';
import { holdNativeAnimations } from '../../../../jest/nativeAnimation';
import { perfBudget } from '../../../shared/perf/budget';
import { scrollListTo } from '../../../shared/testing/autoHideHeader';
import type { CompletedWorkRow as CompletedWorkRowType } from '../components/CompletedWorkRow';
import { makeHistoryMock } from '../mockData';
import { WorkHistoryScreen } from './WorkHistoryScreen';

// 목록 행(memo)이 실제로 그려진 횟수를 센다 (WorkHistoryScreen.monthSwipe.perf-test 의 요약 카드와 같은 방법)
const mockRowRenders = { count: 0 };
type RowProps = ComponentProps<typeof CompletedWorkRowType>;

function mockCountedRow(rowModule: Record<string, unknown>) {
  const { memo } = jest.requireActual<typeof import('react')>('react');
  const inner = (
    rowModule.CompletedWorkRow as { type: (props: RowProps) => ReactNode }
  ).type;
  return {
    ...rowModule,
    CompletedWorkRow: memo((props: RowProps) => {
      mockRowRenders.count += 1;
      return inner(props);
    }),
  };
}

jest.mock('../components/CompletedWorkRow', () =>
  mockCountedRow(jest.requireActual('../components/CompletedWorkRow')),
);

const today = new Date(2026, 8, 28);
const works = makeHistoryMock(today);
const onOpenWork = () => {};

describe('WorkHistoryScreen 렌더 예산', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  // #175: 상단 바 접힘·펼침은 UI 스레드 애니메이션이다. 스크롤하는 동안 화면을 다시 그리지 않는다.
  // 애니메이션은 끝내지 않고 붙잡아 둔다 (프리셋 목은 16ms 뒤 저절로 끝나 측정이 흔들린다)
  it('기준값(12) 안에서 스크롤하는 동안은 다시 그리지 않는다', async () => {
    holdNativeAnimations();
    const result = await measureRenders(
      <WorkHistoryScreen today={today} works={works} onOpenWork={onOpenWork} />,
      {
        scenario: async () => {
          const list = screen.getByTestId('work-history-list');
          for (const y of [0, 4, 8, 12, 6, 0]) {
            await scrollListTo(list, y);
          }
        },
      },
    );

    expect(Math.max(...result.counts)).toBe(1);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);

  // 접히는 순간 화살표·제목을 스크린리더에서 빼고 누를 수 없게 하려고 상단 바만 한 번 다시 그린다 (목록은 그리지 않는다)
  it('접히면 한 번만 다시 그리고, 접힌 채 오르내리는 동안은 다시 그리지 않는다', async () => {
    holdNativeAnimations();
    const result = await measureRenders(
      <WorkHistoryScreen today={today} works={works} onOpenWork={onOpenWork} />,
      {
        scenario: async () => {
          const list = screen.getByTestId('work-history-list');
          for (const y of [0, 100, 300, 800, 250, 40, 600]) {
            await scrollListTo(list, y);
          }
        },
      },
    );

    // 마운트 1 + 접힘 1
    expect(Math.max(...result.counts)).toBe(2);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);

  it('접었다 펼쳐도 목록 행은 다시 그리지 않는다', async () => {
    const animations = holdNativeAnimations();
    await render(
      <WorkHistoryScreen today={today} works={works} onOpenWork={onOpenWork} />,
    );
    const list = screen.getByTestId('work-history-list');
    const before = mockRowRenders.count;

    await scrollListTo(list, 300);
    await animations.finish();
    await scrollListTo(list, 0);
    await animations.finish();

    expect(mockRowRenders.count).toBe(before);
    // 세기가 실제로 걸렸는지
    expect(before).toBeGreaterThan(0);
  });
});
