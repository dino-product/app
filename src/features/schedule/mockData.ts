import { workDetail } from '../work/mockData';
import type { WorkDetail } from '../work/model';
import {
  toDateKey,
  WEEKDAYS,
  type ConfirmedSchedule,
  type PendingRequest,
} from './model';

// Figma 스케줄 섹션의 예시 데이터. 어느 날 열어도 보이도록 오늘을 기준으로 만든다.

const place = {
  company: '한빛 설비',
  customerName: '정다은',
  address: '서울 용산구 이태원로 202',
};

const shift = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export function makeScheduleMock(today: Date): {
  confirmed: ConfirmedSchedule[];
  pending: PendingRequest[];
} {
  const todayKey = toDateKey(today);
  const tomorrowKey = toDateKey(shift(today, 1));
  const requestDay = shift(today, 5);

  return {
    confirmed: [
      {
        ...place,
        id: 'schedule-1',
        dateKey: todayKey,
        title: '세탁기 설치',
        status: 'assigned',
        timeRange: '08:00 - 09:00',
      },
      {
        ...place,
        id: 'schedule-2',
        dateKey: todayKey,
        title: '세탁기 설치',
        status: 'beforeWork',
        timeRange: '10:00 - 11:00',
      },
      {
        ...place,
        id: 'schedule-3',
        dateKey: tomorrowKey,
        title: '세탁기 설치',
        status: 'inProgress',
        timeRange: '08:00 - 09:00',
      },
    ],
    pending: ['1', '2'].map(n => ({
      ...place,
      id: `request-${n}`,
      dateKey: toDateKey(requestDay),
      dateLabel: `${requestDay.getMonth() + 1}/${requestDay.getDate()}`,
      title: '에어컨 필터 교체',
      status: 'assigned',
      timeRange: '14:00 – 15:00',
    })),
  };
}

/** 응답 필요 상세에 보여줄 작업 정보 (요청 + 작업 상세 예시) */
export function requestToWorkDetail(request: PendingRequest): WorkDetail {
  const [year, month, day] = request.dateKey.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return {
    ...workDetail,
    title: request.title,
    date: `${request.dateKey} (${weekday})`,
    status: request.status,
    timeRange: request.timeRange,
    address: request.address,
  };
}
