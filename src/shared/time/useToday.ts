import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// 화면이 보는 오늘. 처음 그릴 때의 지금이고, 날짜가 바뀌면 새 지금으로 바꾼다:
// - 켜 둔 채 자정을 넘기면 (다음 자정까지 타이머 하나. 화면이 사라지거나 background 로 가면 지운다)
// - background 에 있다가 다른 날에 다시 active 가 되면
// 오늘로 정하는 조회 구간(이번 주·응답 필요 등)이 날짜가 바뀐 뒤에도 맞게 한다. 같은 날이면 바꾸지 않아 다시 그리지 않는다

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// 다음 자정까지 (자정 정각에 깨면 아직 앞날일 수 있어 조금 넘겨 깬다)
const MIDNIGHT_SLACK_MS = 1000;
const untilNextMidnight = (now: Date) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() -
  now.getTime() +
  MIDNIGHT_SLACK_MS;

export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    const refresh = () => {
      const now = new Date();
      setToday(prev => (sameDay(prev, now) ? prev : now));
      stop();
      timer = setTimeout(refresh, untilNextMidnight(now));
    };
    timer = setTimeout(refresh, untilNextMidnight(new Date()));
    const subscription = AppState.addEventListener('change', status => {
      if (status === 'active') {
        refresh();
      } else {
        stop();
      }
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, []);
  return today;
}
