import { computeFrameStats, findFrameBudgetViolations } from './frameStats';

const FRAME_MS = 1000 / 60;
const budget = { minAvgFps: 55, maxDroppedFrameRatio: 0.05, maxFrameMs: 50 };

function evenFrames(count: number, intervalMs = FRAME_MS, start = 0) {
  return Array.from({ length: count + 1 }, (_, i) => start + i * intervalMs);
}

describe('computeFrameStats', () => {
  it('타임스탬프가 2개 미만이면 null 을 반환한다', () => {
    expect(computeFrameStats([], 60)).toBeNull();
    expect(computeFrameStats([100], 60)).toBeNull();
  });

  it('60fps 로 고르게 들어온 프레임은 드랍 0, 평균 60fps 이다', () => {
    const stats = computeFrameStats(evenFrames(60), 60);

    expect(stats).not.toBeNull();
    expect(stats!.frameCount).toBe(60);
    expect(stats!.durationMs).toBeCloseTo(1000);
    expect(stats!.avgFps).toBeCloseTo(60);
    expect(stats!.maxFrameMs).toBeCloseTo(FRAME_MS);
    expect(stats!.droppedFrameRatio).toBe(0);
  });

  it('100ms 짜리 긴 프레임 하나는 5프레임 드랍으로 계산한다', () => {
    const timestamps = evenFrames(59);
    timestamps.push(timestamps[timestamps.length - 1] + 100);

    const stats = computeFrameStats(timestamps, 60)!;

    expect(stats.frameCount).toBe(60);
    expect(stats.maxFrameMs).toBeCloseTo(100);
    // 드랍 5 / (실제 60 + 드랍 5)
    expect(stats.droppedFrameRatio).toBeCloseTo(5 / 65);
  });

  it('프레임 간격의 작은 지터는 드랍으로 세지 않는다', () => {
    const jittered = [0, 17, 33, 50, 66, 84, 100];

    expect(computeFrameStats(jittered, 60)!.droppedFrameRatio).toBe(0);
  });
});

describe('findFrameBudgetViolations', () => {
  it('예산 이내면 빈 배열을 반환한다', () => {
    const stats = computeFrameStats(evenFrames(60), 60)!;

    expect(findFrameBudgetViolations(stats, budget)).toEqual([]);
  });

  it('평균 fps, 드랍 비율, 최장 프레임 위반을 모두 보고한다', () => {
    const stats = computeFrameStats(evenFrames(30, 33.4), 60)!;
    stats.maxFrameMs = 120;

    const violations = findFrameBudgetViolations(stats, budget);

    expect(violations.map(v => v.metric)).toEqual([
      'avgFps',
      'droppedFrameRatio',
      'maxFrameMs',
    ]);
    expect(violations[0]).toEqual({
      metric: 'avgFps',
      actual: stats.avgFps,
      limit: 55,
    });
    expect(violations[2]).toEqual({
      metric: 'maxFrameMs',
      actual: 120,
      limit: 50,
    });
  });
});
