import { isApiError, type ApiClient } from '../../../shared/api';
import { toWorkDetail } from './convert';
import { UnsupportedWorkOperationError, WorkErrorCode } from './errors';
import type { WorkDetailResponse, WorkRepository } from './types';

// 실제 서버 작업 저장소. 백엔드에 HTTP 가 있는 작업 상세(S1)만 부르고, 나머지는 '아직 지원하지 않음' 오류를 던진다 (#112 G1·G2).
// 내 일정·수락·거절·시작·완료 보고·이력 API 가 생기면 여기에 붙인다 (목록과 상세의 id 가 맞아야 해 로컬과 섞어 쓰지 않는다)

const unsupported = (operation: string) => (): Promise<never> =>
  Promise.reject(new UnsupportedWorkOperationError(operation));

export function createHttpWorkRepository({
  api,
  organizationId,
  onOrganizationRejected,
}: {
  api: ApiClient;
  /** 작업 API 경로의 발주사. 소속 목록의 활성 기사 소속 (memberships.ts) */
  organizationId: () => Promise<number>;
  /** 서버가 그 발주사의 활성 구성원이 아니라고 답했다(SCHEDULE-004). 소속이 바뀌었을 수 있어 소속을 다시 받게 한다 */
  onOrganizationRejected?: () => void;
}): WorkRepository {
  return {
    async getWorkDetail(workId, { signal, organizationId: given } = {}) {
      const orgId = given ?? (await organizationId());
      try {
        const response = await api.get<WorkDetailResponse>(
          `/api/v1/organizations/${orgId}/works/${workId}`,
          { signal },
        );
        return toWorkDetail(response);
      } catch (error) {
        if (isApiError(error, WorkErrorCode.notMember)) {
          onOrganizationRejected?.();
        }
        throw error;
      }
    },
    getMySchedule: unsupported('getMySchedule'),
    acceptWork: unsupported('acceptWork'),
    rejectWork: unsupported('rejectWork'),
    startWork: unsupported('startWork'),
    submitCompletionReport: unsupported('submitCompletionReport'),
    getWorkHistory: unsupported('getWorkHistory'),
    // 작업 상태는 서버에 있다. 로그아웃·계정 전환 때 비울 것은 캐시뿐이다 (WorkRepositoryProvider)
    reset() {},
  };
}
