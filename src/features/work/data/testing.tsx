import type { ReactNode } from 'react';
import { createTestApi } from '../../../shared/testing/renderWithApi';
import { testSession } from '../../../shared/testing/session';
import { createLocalWorkRepository } from './LocalWorkRepository';
import type { WorkDetailResponse, WorkRepository } from './types';
import { WorkRepositoryProvider } from './WorkRepositoryProvider';

// 작업 데이터 테스트 도구. 사용법:
//   const api = createWorkTestApi({ seed: [workDetailResponse({ status: 'PENDING_ACCEPT' })] });
//   await render(<RequestDetailRoute … />, { wrapper: api.wrapper })   가짜(로컬) 저장소를 주입한다
//   createFakeServer().on('GET', path, ok(workDetailResponse({ status: 'COMPLETED' })))   HTTP 응답

/** 가짜 저장소를 주입한 ApiProvider + WorkRepositoryProvider. repository 가 없으면 seed 로 로컬 저장소를 만든다 */
export function createWorkTestApi({
  repository,
  seed = [],
  now,
}: {
  repository?: WorkRepository;
  seed?: WorkDetailResponse[];
  now?: () => Date;
} = {}) {
  const api = createTestApi({ session: testSession() });
  const selected =
    repository ??
    createLocalWorkRepository({ seed, now: now ?? (() => new Date()) });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <api.wrapper>
      <WorkRepositoryProvider repository={selected}>
        {children}
      </WorkRepositoryProvider>
    </api.wrapper>
  );
  return { ...api, repository: selected, wrapper };
}

/** 작업 상세 응답 (api-spec.md S1 의 기사 시점 예시, 작업전) */
export function workDetailResponse(
  overrides: Partial<WorkDetailResponse> = {},
): WorkDetailResponse {
  const schedule = {
    technician: { technicianId: 12, name: null, technicianType: null },
    startTime: '2026-10-21T00:00:00Z',
    expectedDurationMinutes: 120,
    endTime: '2026-10-21T02:00:00Z',
  };
  return {
    workId: 10,
    name: '배관 누수 점검 및 교체',
    status: 'ACCEPTED',
    delayed: false,
    workType: { id: 3, name: null, color: null },
    registrar: null,
    registeredAt: '2026-10-18T01:00:00Z',
    customer: {
      name: '이정호',
      phone: '010-1234-5678',
      postalCode: '04043',
      address: '서울시 마포구 양화로 45',
      addressDetail: '3층 302호',
      location: { latitude: 37.556151, longitude: 126.922803 },
    },
    payment: { fee: 120000, method: 'ON_SITE_CARD' },
    schedule,
    plannedSchedule: null,
    assignments: [
      {
        assignmentNumber: 1,
        schedule,
        assignedAt: '2026-10-20T08:50:00Z',
        assignedBy: 5,
        result: 'ACCEPTED',
        decidedAt: '2026-10-20T09:02:00Z',
        rejectionReason: null,
        rejectionNote: null,
        endReason: null,
        endedAt: null,
        endedBy: null,
      },
    ],
    startedAt: null,
    completedAt: null,
    cancellation: null,
    completionReport: null,
    sitePhotos: [{ photoId: 'abc123', url: 'fake-photo://abc123' }],
    completionReportRequests: [],
    completionReportRequestable: false,
    version: 3,
    ...overrides,
  };
}
