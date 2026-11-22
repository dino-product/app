import { fireEvent, screen } from '@testing-library/react-native';
import { measureRenders } from 'reassure';
import { holdNativeAnimations } from '../../../../jest/nativeAnimation';
import { perfBudget } from '../../../shared/perf/budget';
import { makeHistoryMock } from '../mockData';
import { WorkHistoryScreen } from './WorkHistoryScreen';

// 작업 이력 날짜 선택(#203)의 렌더 예산.
// 휠 줄의 위치·크기·기울기·투명도는 스크롤 위치를 UI 스레드에서 보간한다 (Animated.event 네이티브 드라이버).
// 굴리는 동안은 React 가 다시 그리지 않고, 멈췄을 때(머리 글자를 그 달로 바꿀 때) 한 번만 그린다.
// 상자 열기·닫기 전환도 UI 스레드다. 애니메이션은 끝내지 않고 붙잡아 둔다 (프리셋 목은 16ms 뒤 저절로 끝나 측정이 흔들린다)

const today = new Date(2026, 8, 28);
const works = makeHistoryMock(today);
const onOpenWork = () => {};
const hidden = { includeHiddenElements: true };
const wheel = () => screen.getByTestId('month-picker-year-wheel', hidden);
const scrollWheel = (y: number) =>
  fireEvent.scroll(wheel(), { nativeEvent: { contentOffset: { x: 0, y } } });

describe('WorkHistoryScreen 날짜 선택 렌더 예산 (#203)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('월 글자를 누르면 한 번 그려 상자를 연다', async () => {
    holdNativeAnimations();
    const result = await measureRenders(
      <WorkHistoryScreen today={today} works={works} onOpenWork={onOpenWork} />,
      {
        scenario: async () => {
          await fireEvent.press(
            screen.getByRole('button', { name: '2026년 9월' }),
          );
        },
      },
    );

    // 마운트 1 + 열기 1
    expect(Math.max(...result.counts)).toBe(2);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);

  it('휠을 굴리는 동안은 다시 그리지 않고, 멈추면 한 번 그린다', async () => {
    holdNativeAnimations();
    const result = await measureRenders(
      <WorkHistoryScreen today={today} works={works} onOpenWork={onOpenWork} />,
      {
        scenario: async () => {
          await fireEvent.press(
            screen.getByRole('button', { name: '2026년 9월' }),
          );
          for (const y of [190, 180, 170, 165]) {
            await scrollWheel(y);
          }
          // 줄 사이에서 손을 떼면 붙을 줄까지 관성으로 간다. 그 사이에도 그리지 않는다
          await fireEvent(wheel(), 'scrollEndDrag', {
            nativeEvent: { contentOffset: { x: 0, y: 165 } },
          });
          await scrollWheel(160);
          await fireEvent(wheel(), 'momentumScrollEnd', {
            nativeEvent: { contentOffset: { x: 0, y: 160 } },
          });
        },
      },
    );

    // 마운트 1 + 열기 1 + 멈춤(2025년) 1
    expect(Math.max(...result.counts)).toBe(3);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);
});
