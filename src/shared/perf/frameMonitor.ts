import {
  computeFrameStats,
  findFrameBudgetViolations,
  type FrameBudget,
  type FrameBudgetViolation,
  type FrameStats,
} from './frameStats';

export type FrameScheduler = {
  request: (callback: (timestamp: number) => void) => number;
  cancel: (handle: number) => void;
};

export type FrameReport = {
  stats: FrameStats;
  violations: FrameBudgetViolation[];
};

export type FrameMonitorOptions = {
  budget: FrameBudget;
  targetFps: number;
  windowMs: number;
  reportCooldownMs: number;
  onViolation: (report: FrameReport) => void;
  scheduler?: FrameScheduler;
};

export type FrameMonitor = {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
};

// 테스트에서 spyOn 할 수 있도록 호출 시점에 전역을 참조한다
const animationFrameScheduler: FrameScheduler = {
  request: callback => requestAnimationFrame(callback),
  cancel: handle => cancelAnimationFrame(handle),
};

/**
 * JS 스레드의 requestAnimationFrame 주기를 windowMs 단위로 집계해 프레임 예산 위반을 보고한다.
 * JS 스레드가 막히면 rAF 콜백도 밀리므로, 긴 간격 = JS 스레드 블로킹(버벅임)이다.
 */
export function createFrameMonitor({
  budget,
  targetFps,
  windowMs,
  reportCooldownMs,
  onViolation,
  scheduler = animationFrameScheduler,
}: FrameMonitorOptions): FrameMonitor {
  let handle: number | null = null;
  let timestamps: number[] = [];
  let lastReportAt = -Infinity;

  const onFrame = (timestamp: number) => {
    timestamps.push(timestamp);
    if (timestamp - timestamps[0] >= windowMs) {
      const stats = computeFrameStats(timestamps, targetFps);
      const violations = stats ? findFrameBudgetViolations(stats, budget) : [];
      if (
        stats &&
        violations.length > 0 &&
        timestamp - lastReportAt >= reportCooldownMs
      ) {
        lastReportAt = timestamp;
        onViolation({ stats, violations });
      }
      timestamps = [timestamp];
    }
    handle = scheduler.request(onFrame);
  };

  return {
    start() {
      if (handle === null) {
        handle = scheduler.request(onFrame);
      }
    },
    stop() {
      if (handle !== null) {
        scheduler.cancel(handle);
        handle = null;
      }
      // 정지 구간이 다음 윈도우의 긴 프레임으로 잡히지 않게 비운다
      timestamps = [];
    },
    isRunning: () => handle !== null,
  };
}

function formatViolation({ metric, actual, limit }: FrameBudgetViolation) {
  switch (metric) {
    case 'avgFps':
      return `avgFps ${actual.toFixed(1)} (예산 ≥ ${limit})`;
    case 'droppedFrameRatio':
      return `droppedFrameRatio ${(actual * 100).toFixed(1)}% (예산 ≤ ${(
        limit * 100
      ).toFixed(1)}%)`;
    case 'maxFrameMs':
      return `maxFrameMs ${actual.toFixed(1)} (예산 ≤ ${limit})`;
  }
}

export function formatFrameReport({ violations }: FrameReport): string {
  return `[perf] JS 프레임 예산 초과 — ${violations
    .map(formatViolation)
    .join(', ')}`;
}
