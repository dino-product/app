import type { CurrentWork, ScheduleItem, WorkDetail } from './model';

// Figma 작업 수행 섹션의 예시 데이터. 화면 테스트의 픽스처다 (운영 경로는 작업 저장소 data/ 를 쓴다).

export const currentWork: CurrentWork = {
  id: 'work-boiler',
  title: '보일러 점검',
  timeRange: '11:00 -12:00',
  customerName: '이수연',
  address: '서울 송파구 올림픽로 88',
};

/** 목 데이터의 오늘 (일정 카드의 '오늘 · 9. 19. (토)'). 블록 보기는 이 날의 주를 보여 주고 이 날을 먼저 고른다 (#94) */
export const homeToday = new Date(2026, 8, 19);

export const weeklySchedule: ScheduleItem[] = ['1', '2', '3'].map(n => ({
  id: `schedule-${n}`,
  dateKey: '2026-09-19',
  title: '세탁기 설치',
  status: 'beforeWork',
  timeRange: '11:00 – 12:00',
  dayLabel: '오늘 · 9. 19. (토)',
  company: '한빛 설비',
  customerName: '정다은',
  address: '서울 용산구 이태원로 202',
}));

export const workDetail: WorkDetail = {
  id: '20260410-DMASX',
  title: '도어록 교체',
  status: 'assigned',
  // 화면 테스트가 완료 보고를 쓸 수 있는 작업중으로 둔다 (칩과 따로)
  workStatus: 'IN_PROGRESS',
  registeredAt: '2026-07-18',
  date: '2025-07-19 (토)',
  timeRange: '오전 10:00 - 11:30',
  technician: '김현수',
  workType: '도어락',
  customer: { name: '박민지', phone: '010-1234-5678' },
  address: '서울 강남구 역삼동 123-4 101호',
  location: { latitude: 37.500622, longitude: 127.036456 },
  memo: '현관 도어록 배터리 교체 및 비밀번호 재설정 요청. 주차는 건물 지하 1층 가능.',
  price: 75000,
  paymentMethod: 'card',
  requestImages: ['mock://request-1', 'mock://request-2'],
  assignmentNumber: 1,
};
