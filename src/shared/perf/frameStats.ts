export type FrameStats = {
  /** 측정된 프레임 간격 수 */
  frameCount: number;
  durationMs: number;
  avgFps: number;
  maxFrameMs: number;
  /** 드랍된 프레임 / (그려진 프레임 + 드랍된 프레임) */
  droppedFrameRatio: number;
};

export type FrameBudget = {
  minAvgFps: number;
  maxDroppedFrameRatio: number;
  maxFrameMs: number;
};

export type FrameBudgetViolation = {
  metric: 'avgFps' | 'droppedFrameRatio' | 'maxFrameMs';
  actual: number;
  limit: number;
};

export function computeFrameStats(
  timestamps: readonly number[],
  targetFps: number,
): FrameStats | null {
  if (timestamps.length < 2) {
    return null;
  }

  const frameMs = 1000 / targetFps;
  let maxFrameMs = 0;
  let dropped = 0;
  for (let i = 1; i < timestamps.length; i++) {
    const interval = timestamps[i] - timestamps[i - 1];
    maxFrameMs = Math.max(maxFrameMs, interval);
    // 반올림으로 vsync 지터(±1ms)는 드랍으로 세지 않는다
    dropped += Math.max(0, Math.round(interval / frameMs) - 1);
  }

  const frameCount = timestamps.length - 1;
  const durationMs = timestamps[timestamps.length - 1] - timestamps[0];
  return {
    frameCount,
    durationMs,
    avgFps: (frameCount * 1000) / durationMs,
    maxFrameMs,
    droppedFrameRatio: dropped / (frameCount + dropped),
  };
}

export function findFrameBudgetViolations(
  stats: FrameStats,
  budget: FrameBudget,
): FrameBudgetViolation[] {
  const violations: FrameBudgetViolation[] = [];
  if (stats.avgFps < budget.minAvgFps) {
    violations.push({
      metric: 'avgFps',
      actual: stats.avgFps,
      limit: budget.minAvgFps,
    });
  }
  if (stats.droppedFrameRatio > budget.maxDroppedFrameRatio) {
    violations.push({
      metric: 'droppedFrameRatio',
      actual: stats.droppedFrameRatio,
      limit: budget.maxDroppedFrameRatio,
    });
  }
  if (stats.maxFrameMs > budget.maxFrameMs) {
    violations.push({
      metric: 'maxFrameMs',
      actual: stats.maxFrameMs,
      limit: budget.maxFrameMs,
    });
  }
  return violations;
}
