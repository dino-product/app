import { toDateKey } from '../schedule/model';
import type { CompletedWork } from './model';

// Figma 작업이력 섹션의 예시 데이터. 화면 테스트의 픽스처다 (운영 경로는 작업 저장소 features/work/data 를 쓴다).
// 어느 날 열어도 이번 달에 보이도록 오늘을 기준으로 만든다.

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
