import { isApiError, type ApiClient } from '../../../shared/api';
import {
  toAssignmentNumberRequest,
  toMySchedule,
  toRejectWorkRequest,
  toSubmitReportRequest,
  toWorkDetail,
  toWorkHistory,
} from './convert';
import { WorkErrorCode } from './errors';
import { createPhotoStorage, type PhotoStorage } from './photoStorage';
import type {
  MyScheduleResponse,
  PhotoUploadResponse,
  WorkDetailResponse,
  WorkHistoryResponse,
  WorkRepository,
} from './types';

// 운영 작업 저장소: 기사 작업 API (Dino develop 79b47ad8, #155). 경로의 발주사는 소속 목록의 활성 기사 소속이다 (config.ts).
// - 내 일정: my-schedule(구간의 확정 일정)과 my-schedule/pending(날짜와 관계없는 수락 대기)을 함께 불러 합친다
// - 기사 명령: works/{id}/acceptance·rejection·start·completion-report 에 화면에서 본 배정 순번을 보낸다 (204)
// - 완료 보고 사진: 한 장씩 completion-photo-uploads 로 주소를 받아 저장소에 올리고(photoStorage), 받은 파일 식별자로 제출한다.
//   올린 사진의 식별자는 제출이 성공할 때까지 기억해, 실패 뒤 다시 낼 때 다시 올리지 않는다 (서버가 쓸 수 없다고 하면 잊는다)

const organizationPath = (organizationId: number) =>
  `/api/v1/organizations/${organizationId}`;
const workPath = (organizationId: number, workId: number) =>
  `${organizationPath(organizationId)}/works/${workId}`;

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
      const orgId = await organizationId();
      const path = `${organizationPath(orgId)}/my-schedule`;
      const [confirmed, pending] = await call(() =>
        Promise.all([
          api.get<MyScheduleResponse>(path, { query: period, signal }),
          api.get<MyScheduleResponse>(`${path}/pending`, { signal }),
        ]),
      );
      return toMySchedule(confirmed, pending, period, organizationName(orgId));
    },
    async getWorkHistory(period, { signal } = {}) {
      const orgId = await organizationId();
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
