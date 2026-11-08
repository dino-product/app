import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { measureRenders } from 'reassure';
import { perfBudget } from '../../../shared/perf/budget';
import { RejectReasonScreen } from './RejectReasonScreen';

// jest 프리셋의 네이티브 애니메이션 목은 16ms 뒤에 끝난다
const settleAnimation = () =>
  act(() => new Promise<void>(resolve => setTimeout(resolve, 50)));

describe('RejectReasonScreen 렌더 예산', () => {
  // 동작 줄이기 설정은 비동기로 읽지만 ref 에만 두어 다시 그리지 않는다
  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(
      <RejectReasonScreen onBack={() => {}} onSubmit={() => {}} />,
      { scenario: () => act(async () => {}) },
    );

    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
    // 10회 반복 측정이 로컬에서도 6초 남짓이라 CI 러너에서는 기본 5초를 넘긴다
  }, 30_000);

  it('기타를 펼칠 때 한 번, 접을 때 두 번(선택·섹션 내리기)만 다시 그린다', async () => {
    const result = await measureRenders(
      <RejectReasonScreen onBack={() => {}} onSubmit={() => {}} />,
      {
        scenario: async () => {
          await userEvent.press(
            screen.getByRole('radio', { name: '기타 (직접 입력)' }),
          );
          await settleAnimation();
          await userEvent.press(
            screen.getByRole('radio', { name: '일정이 맞지 않습니다' }),
          );
          await settleAnimation();
        },
      },
    );

    // 마운트 1 + 펼침 1 + 접힘 1 + 접힌 뒤 섹션 내리기 1.
    // 애니메이션 값·잰 높이는 네이티브로만 보내고, 다 펼친 뒤 스크린리더 포커스 이동도 다시 그리지 않는다
    expect(Math.max(...result.counts)).toBe(4);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);

  // #152: 스크롤 끝 가까이에서 접으면 줄어들 끝까지 스크롤이 올 때까지 섹션을 남겨 둔다.
  // 스크롤 위치·크기는 ref 에만 두므로 기다리는 동안 스크롤 이벤트가 와도 다시 그리지 않는다
  it('스크롤 끝 가까이에서 접어 스크롤을 기다렸다 내려도 펼침·접힘·내리기에 한 번씩만 다시 그린다', async () => {
    const result = await measureRenders(
      <RejectReasonScreen onBack={() => {}} onSubmit={() => {}} />,
      {
        scenario: async () => {
          const scroll = screen.getByTestId('reject-reason-scroll');
          const scrollToY = (y: number) =>
            fireEvent.scroll(scroll, {
              nativeEvent: { contentOffset: { x: 0, y } },
            });
          const other = () =>
            screen.getByRole('radio', { name: '기타 (직접 입력)' });
          // 스크롤 영역 600, 펼친 내용 900, 섹션 190 → 접힌 뒤 끝은 110
          await fireEvent(scroll, 'layout', {
            nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 600 } },
          });
          await fireEvent(scroll, 'contentSizeChange', 360, 900);
          await userEvent.press(other());
          await fireEvent(
            screen.getByTestId('reject-other-content'),
            'layout',
            {
              nativeEvent: { layout: { x: 0, y: 0, width: 312, height: 190 } },
            },
          );
          await settleAnimation();
          await scrollToY(300);
          await userEvent.press(other());
          await settleAnimation();
          await scrollToY(200);
          await scrollToY(110);
        },
      },
    );

    // 마운트 1 + 펼침 1 + 풀기(접힘) 1 + 스크롤이 닿은 뒤 섹션 내리기 1
    expect(Math.max(...result.counts)).toBe(4);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);

  // 고른 사유를 다시 누르면 선택을 푼다 (#101). 다른 선택지로 바꿔 접을 때와 같다
  it('기타를 다시 눌러 풀면 한 번, 접힌 뒤 섹션 내리기에 한 번만 다시 그린다', async () => {
    const result = await measureRenders(
      <RejectReasonScreen onBack={() => {}} onSubmit={() => {}} />,
      {
        scenario: async () => {
          const other = () =>
            screen.getByRole('radio', { name: '기타 (직접 입력)' });
          await userEvent.press(other());
          await settleAnimation();
          await userEvent.press(other());
          await settleAnimation();
        },
      },
    );

    // 마운트 1 + 펼침 1 + 풀기(접힘) 1 + 접힌 뒤 섹션 내리기 1
    expect(Math.max(...result.counts)).toBe(4);
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);
});
