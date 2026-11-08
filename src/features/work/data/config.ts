import type { QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../../shared/api';
import {
  membershipsQuery,
  membershipsQueryKey,
  technicianOrganizationId,
  type MembershipResponse,
} from '../../my/memberships';
import { NoTechnicianOrganizationError } from './errors';
import { createHttpWorkRepository } from './HttpWorkRepository';
import type { PhotoStorage } from './photoStorage';
import type { WorkRepository } from './types';

// 운영 작업 저장소를 만드는 한 곳: 기사 작업 API(HttpWorkRepository, #155). 경로의 발주사는 소속 목록의 활성 기사 소속이다.
// 로컬 저장소(LocalWorkRepository)는 테스트·픽스처에서만 주입한다 (data/testing.tsx, app/testing.tsx)

export function createWorkRepository({
  api,
  queryClient,
  photoStorage,
}: {
  api: ApiClient;
  queryClient: QueryClient;
  /** 완료 보고 사진 업로드. 테스트가 가짜 기기 파일·저장소를 준다 (없으면 RN fetch) */
  photoStorage?: PhotoStorage;
}): WorkRepository {
  return createHttpWorkRepository({
    api,
    // 소속 목록은 마이페이지·조직 참여와 같은 캐시를 쓰고, 받은 적이 있으면 다시 부르지 않는다 (로그아웃·계정 전환 때 비운다).
    // 무효가 되면(조직 참여가 새 승인을 봄, #116) 다음 조회 때 다시 받는다
    organizationId: async () => {
      const organizationId = technicianOrganizationId(
        await queryClient.fetchQuery({
          ...membershipsQuery(api),
          staleTime: Infinity,
        }),
      );
      if (organizationId === undefined) {
        throw new NoTechnicianOrganizationError();
      }
      return organizationId;
    },
    // 발주사를 정하며 받아 둔 소속 목록에서 찾는다
    organizationName: organizationId =>
      queryClient
        .getQueryData<MembershipResponse[]>(membershipsQueryKey)
        ?.find(membership => membership.organizationId === organizationId)
        ?.organizationName ?? null,
    // 소속이 바뀌었으면(비활성화 등) 다음 조회 때 소속을 새로 받는다
    onOrganizationRejected: () =>
      queryClient.removeQueries({ queryKey: membershipsQueryKey }),
    photoStorage,
  });
}
