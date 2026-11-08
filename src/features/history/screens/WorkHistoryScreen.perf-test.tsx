import { fireEvent, screen } from '@testing-library/react-native';
import { measureRenders } from 'reassure';
import { holdNativeAnimations } from '../../../../jest/nativeAnimation';
import { perfBudget } from '../../../shared/perf/budget';
import {
  scrollDownFromTop,
  scrollListTo,
} from '../../../shared/testing/autoHideHeader';
import { makeHistoryMock } from '../mockData';
import { WorkHistoryScreen } from './WorkHistoryScreen';

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

  // #148: 상단 바를 숨기고 다시 보이는 것은 UI 스레드 애니메이션이다. 스크롤 중에 화면을 다시 그리지 않는다.
  // 애니메이션은 끝내지 않고 붙잡아 둔다 (프리셋 목은 16ms 뒤 저절로 끝나 측정이 흔들린다). 끝날 때는 RN Animated 가
  // 끝난 값을 맞추려고 머리 뷰(Animated.View)만 한 번 다시 그린다
  it('스크롤해 상단 바를 숨겼다 다시 보여도 다시 그리지 않는다', async () => {
    holdNativeAnimations();
    const result = await measureRenders(
      <WorkHistoryScreen today={today} works={works} onOpenWork={onOpenWork} />,
      {
        scenario: async () => {
          const list = screen.getByTestId('work-history-list');
          await scrollDownFromTop(list);
          await scrollListTo(list, 250);
          await scrollListTo(list, 0);
        },
      },
    );

    expect(Math.max(...result.counts)).toBe(1);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);
});
