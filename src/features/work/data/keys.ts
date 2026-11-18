import type { Period } from './types';

// 작업 조회 캐시 키. 변경이 성공하면 all 아래를 모두 새로 받는다
export const workKeys = {
  all: ['work'] as const,
  schedule: ({ from, to }: Period) => ['work', 'schedule', from, to] as const,
  /** 응답 필요 (날짜와 관계없다) */
  pending: ['work', 'pending'] as const,
  /** 발주사를 주고 연 상세(알림)는 따로 둔다 */
  detail: (workId: number, organizationId?: number) =>
    ['work', 'detail', workId, organizationId ?? null] as const,
  history: ({ from, to }: Period) => ['work', 'history', from, to] as const,
};
