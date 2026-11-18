import { useLayoutEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

// 화면이 보는 지금 (ms). 처음 그릴 때의 지금이고, 그 뒤로는 화면이 정한 다음 경계 시각에 닿을 때만 그때의 지금으로 바꾼다
// (예: 작업의 예정 시작·종료, #205). 같은 경계 안에서는 바꾸지 않아 다시 그리지 않는다.
// - nextChangeAfter(now): now 뒤에 화면이 바뀔 수 있는 가장 이른 시각 (now 보다 크다). 없으면 undefined 이고 타이머도 없다.
//   같은 계산이면 같은 함수로 준다 (useCallback)
// - 타이머는 다음 경계까지 하나뿐이다 (주기 폴링 없음)
// - 화면을 떠나거나(active false) 앱이 active 가 아니면(background·inactive) 타이머를 지운다.
//   다시 돌아오면 그사이 경계를 지났는지 보고, 지났으면 바로 바꾸고 아니면 남은 시간만큼 기다린다

// setTimeout 이 받는 가장 긴 대기 (약 24.8일). 넘기면 바로 불린다
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export function useNow(
  nextChangeAfter: (now: number) => number | undefined,
  active = true,
): number {
  const [now, setNow] = useState(Date.now);
  const changesAt = useMemo(() => nextChangeAfter(now), [nextChangeAfter, now]);

  // 레이아웃 효과로 둬, 돌아왔을 때 이미 지난 경계는 그리기 전에 반영한다 (지난 화면이 한 프레임 보이지 않게)
  useLayoutEffect(() => {
    if (!active || changesAt === undefined) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    // 경계를 지났으면 지금으로 바꾼다 (새 경계로 이 효과가 다시 돈다). 아직이면 경계까지 기다린다.
    // 앱이 background·inactive 인 동안(그사이 경계가 바뀌어 이 효과가 다시 돌 때도)은 걸지 않고 active 로 돌아올 때 깬다.
    // 모르는 상태(unknown 등)는 active 로 본다
    const wake = (status: unknown = AppState.currentState) => {
      stop();
      if (status === 'background' || status === 'inactive') {
        return;
      }
      const current = Date.now();
      if (current >= changesAt) {
        setNow(current);
        return;
      }
      timer = setTimeout(
        () => wake(),
        Math.min(changesAt - current, MAX_TIMEOUT_MS),
      );
    };
    wake();
    const subscription = AppState.addEventListener('change', status => {
      if (status === 'active') {
        wake(status);
      } else {
        stop();
      }
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, [active, changesAt]);

  return now;
}
