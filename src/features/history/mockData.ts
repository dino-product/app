import { toDateKey, WEEKDAYS } from '../schedule/model';
import { workDetail } from '../work/mockData';
import type { WorkDetail, WorkReport } from '../work/model';
import { parseDate, type CompletedWork } from './model';

// Figma 작업이력 섹션의 예시 데이터. 어느 날 열어도 이번 달에 보이도록 오늘을 기준으로 만든다.

const place = {
  company: '한빛 설비',
  customerName: '정다은',
  address: '서울 용산구 이태원로 202',
};

const titles = ['세탁기 설치', '에어컨 청소', '보일러 점검', '도어록 교체'];

const times = [
  { start: '13:00', end: '14:00' },
  { start: '08:00', end: '09:00' },
];

// 오늘부터 며칠 전에 완료했는지. 두 달 남짓 이어지고, 그 앞 달부터는 비어 있어 빈 상태를 볼 수 있다
const DAYS_AGO = [0, 0, 1, 3, 6, 9, 13, 18, 24, 31, 38, 45, 52];

const shift = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export function makeHistoryMock(today: Date): CompletedWork[] {
  return DAYS_AGO.map((days, i) => ({
    ...place,
    ...times[i % times.length],
    id: `history-${i + 1}`,
    dateKey: toDateKey(shift(today, -days)),
    title: titles[i % titles.length],
  }));
}

// 완료한 작업마다 제출된 완료 보고 예시. 사진은 회색 자리 사진이다
const submittedReport: WorkReport = {
  beforePhotos: ['mock://history-before-1', 'mock://history-before-2'],
  afterPhotos: ['mock://history-after-1'],
  memo: '작업 완료 후 정상 작동 확인',
  parts: '배수 호스 1개',
  amount: '75000',
  paymentMethod: 'card',
};

/** 완료 작업 상세에 보여줄 작업 정보 (완료 작업 + 작업 상세 예시). 보고를 제출한 작업이라 읽기 전용으로 열린다 */
export function completedToWorkDetail(work: CompletedWork): WorkDetail {
  const weekday = WEEKDAYS[parseDate(work.dateKey).getDay()];
  return {
    ...workDetail,
    title: work.title,
    status: 'completed',
    date: `${work.dateKey} (${weekday})`,
    timeRange: `${work.start} - ${work.end}`,
    customer: { ...workDetail.customer, name: work.customerName },
    address: work.address,
    // 완료 시각이 따로 없어 작업이 끝난 시각에 제출한 것으로 둔다
    submission: {
      submittedAt: `${work.dateKey} ${work.end}`,
      report: submittedReport,
    },
  };
}
