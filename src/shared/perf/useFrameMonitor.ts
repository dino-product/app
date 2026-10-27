import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { perfBudget } from './budget';
import {
  createFrameMonitor,
  formatFrameReport,
  type FrameReport,
} from './frameMonitor';

type Options = {
  /** 기본값 __DEV__. 프로덕션 번들에서는 rAF 루프 자체가 CPU·배터리 비용이므로 켜지 않는다. */
  enabled?: boolean;
  onViolation?: (report: FrameReport) => void;
};

const warnFrameReport = (report: FrameReport) =>
  console.warn(formatFrameReport(report));

/**
 * 개발 중 JS 스레드 프레임 예산(performance-budget.json 의 frame) 위반을 경고한다.
 * 앱이 foreground(active) 일 때만 측정하고, background 로 가면 즉시 멈춘다.
 */
export function useFrameMonitor({
  enabled = __DEV__,
  onViolation = warnFrameReport,
}: Options = {}) {
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const monitor = createFrameMonitor({
      budget: perfBudget.frame,
      targetFps: perfBudget.frame.targetFps,
      windowMs: perfBudget.devMonitor.windowMs,
      reportCooldownMs: perfBudget.devMonitor.reportCooldownMs,
      onViolation: report => onViolationRef.current(report),
    });
    const sync = (state?: string | null) =>
      state === 'active' ? monitor.start() : monitor.stop();

    sync(AppState.currentState);
    const subscription = AppState.addEventListener('change', sync);
    return () => {
      subscription.remove();
      monitor.stop();
    };
  }, [enabled]);
}
