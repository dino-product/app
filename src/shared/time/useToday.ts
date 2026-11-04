import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// 화면이 보는 오늘. 처음 그릴 때의 지금이고, 앱이 background 에 있다가 다른 날에 다시 active 가 되면 새 지금으로 바꾼다.
// 오늘로 정하는 조회 구간(이번 주·응답 필요 등)이 날짜가 바뀐 뒤에도 맞게 한다. 같은 날이면 바꾸지 않아 다시 그리지 않는다

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const subscription = AppState.addEventListener('change', status => {
      if (status !== 'active') {
        return;
      }
      const now = new Date();
      setToday(prev => (sameDay(prev, now) ? prev : now));
    });
    return () => subscription.remove();
  }, []);
  return today;
}
