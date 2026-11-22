import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, BackHandler } from 'react-native';
import { useReduceMotion } from '../../shared/accessibility/useReduceMotion';
import type { YearMonth } from './model';
import { clampPickerMonth, PICKER_MS, pickerEasing } from './monthPicker';

// 작업 이력 날짜 선택 상자의 상태 (#203). 그리기는 MonthPickerBox(상단 바 안 흰 상자)·MonthPickerOverlay(휠·바깥)가 한다.
// - 열기: 보던 달에서 시작해 진행도 하나를 240ms 감속 곡선으로 0 → 1 (UI 스레드). 동작 줄이기면 바로 연다.
// - 휠이 멈추면 select 로 고른 달을 바꾼다 (머리 글자가 그 달이 된다). 목록은 닫을 때까지 그대로다.
// - 닫기(상자 바깥·머리 글자·Android 뒤로 가기·스크린리더 닫기): 고른 달을 onApply 로 적용하고 같은 곡선으로 1 → 0.
//   다 닫히면 상자를 치운다. 닫는 동안 다시 열 수 있다
export type MonthPickerPhase = 'closed' | 'open' | 'closing';

export type MonthPicker = {
  phase: MonthPickerPhase;
  /** 고른 달. 열린 동안 머리 글자가 이 달이다 */
  month: YearMonth;
  /** 열림 진행도 (네이티브 값). 0 닫힘, 1 열림 */
  progress: Animated.Value;
  open: () => void;
  close: () => void;
  select: (month: YearMonth) => void;
};

export function useMonthPicker({
  today,
  viewMonth,
  onApply,
}: {
  today: Date;
  /** 화면이 보는 달. 열 때 휠이 이 달에서 시작한다 */
  viewMonth: YearMonth;
  /** 닫을 때 고른 달을 적용한다 (보던 달과 같아도 부른다) */
  onApply: (month: YearMonth) => void;
}): MonthPicker {
  const reduceMotion = useReduceMotion();
  const [progress] = useState(
    () => new Animated.Value(0, { useNativeDriver: true }),
  );
  const [phase, setPhase] = useState<MonthPickerPhase>('closed');
  const [month, setMonth] = useState(viewMonth);

  // 핸들러는 최신 값을 읽는다. 고른 달은 두 휠이 잇달아 멈춰도 잃지 않게 바로 적어 둔다
  const latest = useRef({ phase, today, viewMonth, onApply, month });
  useLayoutEffect(() => {
    latest.current = { ...latest.current, phase, today, viewMonth, onApply };
  });

  const run = useCallback(
    (toValue: 0 | 1, onFinish?: () => void) => {
      progress.stopAnimation();
      if (reduceMotion.current) {
        progress.setValue(toValue);
        onFinish?.();
        return;
      }
      Animated.timing(progress, {
        toValue,
        duration: PICKER_MS,
        easing: pickerEasing,
        useNativeDriver: true,
      }).start(({ finished }) => {
        // 다시 열거나 화면을 떠나 멈춘 것이면 치우지 않는다
        if (finished) {
          onFinish?.();
        }
      });
    },
    [progress, reduceMotion],
  );

  const open = useCallback(() => {
    const current = latest.current;
    if (current.phase === 'open') {
      return;
    }
    const start = clampPickerMonth(current.viewMonth, current.today);
    current.month = start;
    current.phase = 'open';
    setMonth(start);
    setPhase('open');
    run(1);
  }, [run]);

  const close = useCallback(() => {
    const current = latest.current;
    if (current.phase !== 'open') {
      return;
    }
    current.phase = 'closing';
    current.onApply(current.month);
    setPhase('closing');
    run(0, () => {
      latest.current.phase = 'closed';
      setPhase('closed');
    });
  }, [run]);

  const select = useCallback((next: YearMonth) => {
    const current = latest.current;
    if (
      current.phase !== 'open' ||
      (current.month.year === next.year && current.month.month === next.month)
    ) {
      return;
    }
    current.month = next;
    setMonth(next);
  }, []);

  // Android 뒤로 가기는 열린 상자만 닫는다 (나중에 등록한 핸들러가 먼저 불린다: 화면·탭보다 먼저다)
  useEffect(() => {
    if (phase !== 'open') {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        close();
        return true;
      },
    );
    return () => subscription.remove();
  }, [phase, close]);

  useEffect(() => () => progress.stopAnimation(), [progress]);

  return useMemo(
    () => ({ phase, month, progress, open, close, select }),
    [phase, month, progress, open, close, select],
  );
}
