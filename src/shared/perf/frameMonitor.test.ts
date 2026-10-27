import {
  createFrameMonitor,
  formatFrameReport,
  type FrameScheduler,
} from './frameMonitor';

const FRAME_MS = 1000 / 60;
const budget = { minAvgFps: 55, maxDroppedFrameRatio: 0.05, maxFrameMs: 50 };

/** 테스트에서 프레임을 직접 흘려보내는 가짜 rAF */
function createFakeScheduler() {
  let pending: ((timestamp: number) => void) | null = null;
  let now = 0;
  const scheduler: FrameScheduler = {
    request: jest.fn(cb => {
      pending = cb;
      return 1;
    }),
    cancel: jest.fn(() => {
      pending = null;
    }),
  };
  return {
    scheduler,
    hasPendingFrame: () => pending !== null,
    /** intervalMs 간격으로 count 개 프레임을 발생시킨다 */
    tick(count: number, intervalMs = FRAME_MS) {
      for (let i = 0; i < count; i++) {
        const cb = pending;
        pending = null;
        now += intervalMs;
        cb?.(now);
      }
    },
  };
}

function setup(overrides: { reportCooldownMs?: number } = {}) {
  const fake = createFakeScheduler();
  const onViolation = jest.fn();
  const monitor = createFrameMonitor({
    budget,
    targetFps: 60,
    windowMs: 1000,
    reportCooldownMs: overrides.reportCooldownMs ?? 0,
    onViolation,
    scheduler: fake.scheduler,
  });
  return { fake, onViolation, monitor };
}

describe('createFrameMonitor', () => {
  it('start 전에는 프레임을 요청하지 않는다', () => {
    const { fake, monitor } = setup();

    expect(monitor.isRunning()).toBe(false);
    expect(fake.scheduler.request).not.toHaveBeenCalled();
  });

  it('start 를 여러 번 호출해도 프레임 루프는 하나만 돈다', () => {
    const { fake, monitor } = setup();

    monitor.start();
    monitor.start();

    expect(monitor.isRunning()).toBe(true);
    expect(fake.scheduler.request).toHaveBeenCalledTimes(1);
  });

  it('예산 이내로 프레임이 들어오면 보고하지 않는다', () => {
    const { fake, onViolation, monitor } = setup();

    monitor.start();
    fake.tick(130);

    expect(onViolation).not.toHaveBeenCalled();
  });

  it('윈도우 안에서 긴 프레임이 생기면 위반을 보고한다', () => {
    const { fake, onViolation, monitor } = setup();

    monitor.start();
    fake.tick(30);
    fake.tick(1, 200);
    fake.tick(50);

    expect(onViolation).toHaveBeenCalledTimes(1);
    const report = onViolation.mock.calls[0][0];
    expect(
      report.violations.map((v: { metric: string }) => v.metric),
    ).toContain('maxFrameMs');
    expect(report.stats.maxFrameMs).toBeCloseTo(200);
  });

  it('쿨다운 동안에는 위반을 다시 보고하지 않는다', () => {
    const { fake, onViolation, monitor } = setup({ reportCooldownMs: 5000 });

    monitor.start();
    for (let i = 0; i < 3; i++) {
      fake.tick(1, 200);
      fake.tick(60);
    }

    expect(onViolation).toHaveBeenCalledTimes(1);
  });

  it('stop 하면 대기 중인 프레임을 취소하고, 재시작 시 정지 구간을 긴 프레임으로 세지 않는다', () => {
    const { fake, onViolation, monitor } = setup();

    monitor.start();
    fake.tick(10);
    monitor.stop();

    expect(monitor.isRunning()).toBe(false);
    expect(fake.scheduler.cancel).toHaveBeenCalled();
    expect(fake.hasPendingFrame()).toBe(false);

    // 백그라운드에 5초 있다가 복귀한 상황
    fake.tick(1, 5000);
    monitor.start();
    fake.tick(130);

    expect(onViolation).not.toHaveBeenCalled();
  });
});

describe('formatFrameReport', () => {
  it('위반 지표를 실제값과 예산으로 읽기 쉽게 만든다', () => {
    const message = formatFrameReport({
      stats: {
        frameCount: 50,
        durationMs: 2000,
        avgFps: 25,
        maxFrameMs: 120,
        droppedFrameRatio: 0.12,
      },
      violations: [
        { metric: 'avgFps', actual: 42.123, limit: 55 },
        { metric: 'droppedFrameRatio', actual: 0.12, limit: 0.05 },
        { metric: 'maxFrameMs', actual: 120, limit: 50 },
      ],
    });

    expect(message).toBe(
      '[perf] JS 프레임 예산 초과 — avgFps 42.1 (예산 ≥ 55), droppedFrameRatio 12.0% (예산 ≤ 5.0%), maxFrameMs 120.0 (예산 ≤ 50)',
    );
  });
});
