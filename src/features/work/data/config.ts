import type { QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../../shared/api';
import {
  membershipsQuery,
  membershipsQueryKey,
  technicianOrganizationId,
} from '../../my/memberships';
import { NoTechnicianOrganizationError } from './errors';
import { createHttpWorkRepository } from './HttpWorkRepository';
import { createLocalWorkRepository } from './LocalWorkRepository';
import { makeLocalSeed } from './localSeed';
import type { WorkRepository } from './types';

// 작업 저장소를 고르는 한 곳. 백엔드 작업 API(내 일정·수락·거절·시작·완료 보고·이력, #112 G1·G2)가 생길 때까지 로컬이다.
// 목록과 상세의 작업 id 가 맞아야 해 두 저장소를 섞어 쓰지 않는다 (HTTP 로 바꾸면 작업 상세만 실제 서버로 열린다)

export type WorkRepositorySource = 'local' | 'http';

export const WORK_REPOSITORY_SOURCE: WorkRepositorySource = 'local';

export function createWorkRepository(
  source: WorkRepositorySource,
  {
    api,
    queryClient,
    now = () => new Date(),
  }: { api: ApiClient; queryClient: QueryClient; now?: () => Date },
): WorkRepository {
  if (source === 'local') {
    return createLocalWorkRepository({ seed: makeLocalSeed(now()), now });
  }
  return createHttpWorkRepository({
    api,
    // 소속 목록은 마이페이지와 같은 캐시를 쓰고, 받은 적이 있으면 다시 부르지 않는다 (로그아웃·계정 전환 때 비운다)
    organizationId: async () => {
      const organizationId = technicianOrganizationId(
        await queryClient.ensureQueryData(membershipsQuery(api)),
      );
      if (organizationId === undefined) {
        throw new NoTechnicianOrganizationError();
      }
      return organizationId;
    },
    // 소속이 바뀌었으면(비활성화 등) 다음 조회 때 소속을 새로 받는다
    onOrganizationRejected: () =>
      queryClient.removeQueries({ queryKey: membershipsQueryKey }),
  });
}
