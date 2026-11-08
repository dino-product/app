import { isApiError, type ApiClient } from '../../../shared/api';
import {
  toAssignmentNumberRequest,
  toMySchedule,
  toPendingWorks,
  toRejectWorkRequest,
  toSubmitReportRequest,
  toWorkDetail,
  toWorkHistory,
} from './convert';
import { NoTechnicianOrganizationError, WorkErrorCode } from './errors';
import { createPhotoStorage, type PhotoStorage } from './photoStorage';
import type {
  MySchedule,
  MyScheduleResponse,
  PhotoUploadResponse,
  WorkDetailResponse,
  WorkHistory,
  WorkHistoryResponse,
  WorkRepository,
} from './types';

// 운영 작업 저장소: 기사 작업 API (Dino develop 79b47ad8, #155). 경로의 발주사는 소속 목록의 활성 기사 소속이다 (config.ts).
// - 내 일정: my-schedule(구간의 확정 일정)과 my-schedule/pending(날짜와 관계없는 수락 대기)을 함께 불러 합친다
// - 응답 필요: my-schedule/pending 그대로 (날짜로 거르지 않는다)
// - 기사 명령: works/{id}/acceptance·rejection·start·completion-report 에 화면에서 본 배정 순번을 보낸다 (204)
// - 완료 보고 사진: 한 장씩 completion-photo-uploads 로 주소를 받아 저장소에 올리고(photoStorage), 받은 파일 식별자로 제출한다.
//   올린 사진의 식별자는 제출이 성공할 때까지 기억해, 실패 뒤 다시 낼 때 다시 올리지 않는다 (서버가 쓸 수 없다고 하면 잊는다)
// - 활성 기사 소속이 없으면(승인 대기 중에 메인에 들어온 새 기사, 비활성 기사) 볼 작업이 없어 목록은 빈 결과다. 상세는 볼 수 없는 작업이다

const organizationPath = (organizationId: number) =>
  `/api/v1/organizations/${organizationId}`;
const workPath = (organizationId: number, workId: number) =>
  `${organizationPath(organizationId)}/works/${workId}`;

const NO_SCHEDULE: MySchedule = { works: [] };
// 소속이 없어 서버에 물을 수 없다. 누적 완료는 지난 소속의 기록이 있을 수 있어 0 이 아니라 알 수 없음이다
const NO_HISTORY: WorkHistory = {
  works: [],
  statistics: { assigned: 0, completed: 0, rejected: 0, cancelled: 0 },
  totalCompleted: null,
};

export function createHttpWorkRepository({
  api,
  organizationId,
  organizationName = () => null,
  onOrganizationRejected,
  photoStorage = createPhotoStorage(),
}: {
  api: ApiClient;
  /** 작업 API 경로의 발주사. 소속 목록의 활성 기사 소속 (memberships.ts) */
  organizationId: () => Promise<number>;
  /** 그 발주사의 이름. 목록 행의 업체명에 쓴다 (백엔드 행에 없다). 모르면 null */
  organizationName?: (organizationId: number) => string | null;
  /** 서버가 그 발주사의 활성 구성원이 아니라고 답했다(SCHEDULE-004). 소속이 바뀌었을 수 있어 소속을 다시 받게 한다 */
  onOrganizationRejected?: () => void;
  /** 완료 보고 사진을 저장소에 올린다. 테스트가 가짜 기기 파일·저장소를 준다 */
  photoStorage?: PhotoStorage;
}): WorkRepository {
  async function call<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isApiError(error, WorkErrorCode.notMember)) {
        onOrganizationRejected?.();
      }
      throw error;
    }
  }

  // 목록 조회의 발주사. 활성 기사 소속이 없으면 null (볼 작업이 없다)
  async function listOrganizationId(): Promise<number | null> {
    try {
      return await organizationId();
    } catch (error) {
      if (error instanceof NoTechnicianOrganizationError) {
        return null;
      }
      throw error;
    }
  }

  async function command(workId: number, action: string, body: unknown) {
    const orgId = await organizationId();
    await call(() =>
      api.post<void>(`${workPath(orgId, workId)}/${action}`, body),
    );
  }

  // 올린 사진: '작업 id + 기기 URI' → 파일 식별자
  const uploaded = new Map<string, string>();
  const uploadedKey = (workId: number, uri: string) => `${workId} ${uri}`;
  const forgetUploads = (workId: number) => {
    for (const key of [...uploaded.keys()]) {
      if (key.startsWith(`${workId} `)) {
        uploaded.delete(key);
      }
    }
  };

  async function uploadPhoto(orgId: number, workId: number, uri: string) {
    const key = uploadedKey(workId, uri);
    const known = uploaded.get(key);
    if (known !== undefined) {
      return known;
    }
    const fileId = await photoStorage.upload(uri, photo =>
      call(() =>
        api.post<PhotoUploadResponse>(
          `${workPath(orgId, workId)}/completion-photo-uploads`,
          photo,
        ),
      ),
    );
    uploaded.set(key, fileId);
    return fileId;
  }

  // 한 장씩 차례로 올린다. 사진은 장당 수 MB 라 한꺼번에 보내면 느린 망에서 저마다 제한 시간을 넘길 수 있다.
  // 하나라도 실패하면 거기서 멈추고 제출하지 않는다
  async function uploadPhotos(orgId: number, workId: number, uris: string[]) {
    const fileIds: string[] = [];
    for (const uri of uris) {
      fileIds.push(await uploadPhoto(orgId, workId, uri));
    }
    return fileIds;
  }

  return {
    async getWorkDetail(workId, { signal, organizationId: given } = {}) {
      const orgId = given ?? (await organizationId());
      const response = await call(() =>
        api.get<WorkDetailResponse>(workPath(orgId, workId), { signal }),
      );
      return toWorkDetail(response);
    },
    async getMySchedule(period, { signal } = {}) {
      const orgId = await listOrganizationId();
      if (orgId === null) {
        return NO_SCHEDULE;
      }
      const path = `${organizationPath(orgId)}/my-schedule`;
      const [confirmed, pending] = await call(() =>
        Promise.all([
          api.get<MyScheduleResponse>(path, { query: period, signal }),
          api.get<MyScheduleResponse>(`${path}/pending`, { signal }),
        ]),
      );
      return toMySchedule(confirmed, pending, period, organizationName(orgId));
    },
    async getPendingWorks({ signal } = {}) {
      const orgId = await listOrganizationId();
      if (orgId === null) {
        return NO_SCHEDULE;
      }
      const response = await call(() =>
        api.get<MyScheduleResponse>(
          `${organizationPath(orgId)}/my-schedule/pending`,
          { signal },
        ),
      );
      return toPendingWorks(response, organizationName(orgId));
    },
    async getWorkHistory(period, { signal } = {}) {
      const orgId = await listOrganizationId();
      if (orgId === null) {
        return NO_HISTORY;
      }
      const response = await call(() =>
        api.get<WorkHistoryResponse>(
          `${organizationPath(orgId)}/work-history`,
          { query: period, signal },
        ),
      );
      return toWorkHistory(response, organizationName(orgId));
    },
    acceptWork: work =>
      command(work.workId, 'acceptance', toAssignmentNumberRequest(work)),
    rejectWork: work =>
      command(work.workId, 'rejection', toRejectWorkRequest(work)),
    startWork: work =>
      command(work.workId, 'start', toAssignmentNumberRequest(work)),
    async submitCompletionReport(report) {
      const orgId = await organizationId();
      const beforePhotoIds = await uploadPhotos(
        orgId,
        report.workId,
        report.beforePhotos,
      );
      const afterPhotoIds = await uploadPhotos(
        orgId,
        report.workId,
        report.afterPhotos,
      );
      try {
        await call(() =>
          api.post<void>(
            `${workPath(orgId, report.workId)}/completion-report`,
            toSubmitReportRequest(report, { beforePhotoIds, afterPhotoIds }),
          ),
        );
      } catch (error) {
        // 올린 지 오래돼 저장소가 지웠거나 쓸 수 없는 사진이다. 다음 제출 때 새로 올린다
        if (isApiError(error, WorkErrorCode.photoNotUploaded)) {
          forgetUploads(report.workId);
        }
        throw error;
      }
      forgetUploads(report.workId);
    },
    // 작업 상태는 서버에 있다. 로그아웃·계정 전환 때 비울 것은 올려 두고 제출하지 않은 사진 식별자다 (캐시는 WorkRepositoryProvider 밖에서 비운다)
    reset() {
      uploaded.clear();
    },
  };
}
