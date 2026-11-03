import { act, screen, userEvent } from '@testing-library/react-native';
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
});
