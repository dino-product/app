import type { ReactNode } from 'react';
import { ok, type FakeServer } from '../../../shared/testing/fakeServer';
import { createTestApi } from '../../../shared/testing/renderWithApi';
import { testSession } from '../../../shared/testing/session';
import { createLocalWorkRepository } from './LocalWorkRepository';
import type {
  AssignedWorkResponse,
  PhotoUploadRequest,
  PhotoUploadResponse,
  ScheduledWorkResponse,
  WorkDetailResponse,
  WorkHistoryResponse,
  WorkRepository,
} from './types';
import { WorkRepositoryProvider } from './WorkRepositoryProvider';

// 작업 데이터 테스트 도구. 사용법:
//   const api = createWorkTestApi({ seed: [workDetailResponse({ status: 'PENDING_ACCEPT' })] });
//   await render(<RequestDetailRoute … />, { wrapper: api.wrapper })   가짜(로컬) 저장소를 주입한다
//   createFakeServer().on('GET', path, ok(workDetailResponse({ status: 'COMPLETED' })))   HTTP 응답
//   workApiRoutes(server, 7, { schedule: [scheduledWorkResponse()] })   운영 저장소(기사 작업 API)의 조회 응답
//   createPhotoStorage({ fetch: devicePhotoFetch(server) })   완료 보고 사진 업로드를 가짜 기기 파일·가짜 서버로

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

/** 내 일정 행 (MyScheduleResponse.ScheduledWork, 10/21 09:00~11:00 KST 작업전) */
export function scheduledWorkResponse(
  overrides: Partial<ScheduledWorkResponse> = {},
): ScheduledWorkResponse {
  return {
    workId: 10,
    name: '배관 누수 점검 및 교체',
    status: 'ACCEPTED',
    assignmentNumber: 1,
    startTime: '2026-10-21T00:00:00Z',
    endTime: '2026-10-21T02:00:00Z',
    customerName: '홍길동',
    customerAddress: '서울시 마포구 양화로 45',
    customerAddressDetail: '3층 302호',
    customerLocation: { latitude: 37.556151, longitude: 126.922803 },
    delayed: false,
    ...overrides,
  };
}

/** 작업 이력 행 (WorkHistoryResponse.AssignedWork, 완료) */
export function assignedWorkResponse(
  overrides: Partial<AssignedWorkResponse> = {},
): AssignedWorkResponse {
  return {
    workId: 10,
    name: '배관 누수 점검 및 교체',
    status: 'COMPLETED',
    current: true,
    assignmentNumber: 1,
    startTime: '2026-10-21T00:00:00Z',
    endTime: '2026-10-21T02:00:00Z',
    result: 'ACCEPTED',
    endReason: null,
    workType: { id: 3, name: null, color: null },
    startedAt: '2026-10-21T00:05:00Z',
    completedAt: '2026-10-21T01:50:00Z',
    ...overrides,
  };
}

/** 작업 이력 (기사 본인 조회). 기본은 완료한 작업 없음 */
export function workHistoryResponse(
  overrides: Partial<WorkHistoryResponse> = {},
): WorkHistoryResponse {
  return {
    technicianId: 3,
    works: [],
    statistics: { assigned: 0, completed: 0, rejected: 0, cancelled: 0 },
    totalCompleted: 0,
    ...overrides,
  };
}

/** devicePhotoFetch 가 읽어 주는 기기 사진 한 장의 크기 */
export const DEVICE_PHOTO_BYTES = 1024;

/**
 * 완료 보고 사진 업로드용 fetch. 기기 사진(file://·content://)은 DEVICE_PHOTO_BYTES 크기의 가짜 JPEG 로 읽고,
 * 그 밖의 주소(저장소 PUT)는 가짜 서버로 보낸다. 저장소 주소는 photoUploadResponse 가 가짜 서버의 /storage/incoming/{fileId} 로 준다
 */
export function devicePhotoFetch(server: FakeServer): typeof fetch {
  return (async (input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('file://') || url.startsWith('content://')) {
      const blob = { size: DEVICE_PHOTO_BYTES, type: 'image/jpeg', close() {} };
      return {
        ok: true,
        status: 200,
        blob: async () => blob,
      } as unknown as Response;
    }
    return server.fetch(input, init);
  }) as typeof fetch;
}

/** 업로드 주소 발급 응답. 저장소 주소는 가짜 서버의 /storage/incoming/{fileId} 다 */
export function photoUploadResponse(
  server: FakeServer,
  fileId: string,
  { contentType, sizeBytes }: PhotoUploadRequest = {
    contentType: 'image/jpeg',
    sizeBytes: DEVICE_PHOTO_BYTES,
  },
): PhotoUploadResponse {
  return {
    fileId,
    uploadUrl: `${server.baseUrl}/storage/incoming/${fileId}`,
    requiredHeaders: {
      'content-type': contentType,
      'content-length': String(sizeBytes),
    },
    expiresAt: '2026-10-21T00:10:00Z',
  };
}

/**
 * 기사 작업 API 의 조회(내 일정·응답 필요·이력) 응답을 정한다. 기본은 모두 빈 목록이다.
 * 내 일정은 구간과 관계없이 같은 목록을 준다(저장소가 응답 필요만 구간으로 거른다). 응답을 바꾸려면 server.on 으로 다시 정한다
 */
export function workApiRoutes(
  server: FakeServer,
  organizationId: number,
  {
    schedule = [],
    pending = [],
    history = workHistoryResponse(),
  }: {
    schedule?: ScheduledWorkResponse[];
    pending?: ScheduledWorkResponse[];
    history?: WorkHistoryResponse;
  } = {},
) {
  const base = `/api/v1/organizations/${organizationId}`;
  return server
    .on('GET', `${base}/my-schedule`, ok({ works: schedule }))
    .on('GET', `${base}/my-schedule/pending`, ok({ works: pending }))
    .on('GET', `${base}/work-history`, ok(history));
}
