import { useCallback, useState } from 'react';
import type { ConfirmedSchedule, PendingRequest } from './model';

// 목 데이터 단계의 일정 상태. API 연동 시 서버 상태(조회·수락·거절)로 바꾼다.
export function useScheduleStore(initial: {
  confirmed: ConfirmedSchedule[];
  pending: PendingRequest[];
}) {
  const [state, setState] = useState(initial);

  const accept = useCallback((id: string) => {
    setState(prev => {
      const request = prev.pending.find(item => item.id === id);
      if (!request) {
        return prev;
      }
      const schedule: ConfirmedSchedule = {
        id: request.id,
        dateKey: request.dateKey,
        title: request.title,
        status: request.status,
        timeRange: request.timeRange,
        company: request.company,
        customerName: request.customerName,
        address: request.address,
      };
      return {
        confirmed: [...prev.confirmed, schedule],
        pending: prev.pending.filter(item => item.id !== id),
      };
    });
  }, []);

  const reject = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      pending: prev.pending.filter(item => item.id !== id),
    }));
  }, []);

  return { ...state, accept, reject };
}
