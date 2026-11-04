import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '../../shared/api';

// 내 소속 목록 (GET /api/v1/memberships, api-spec.md O5). 작업 API 경로의 발주사(활성 기사 소속)를 정한다.
// 캐시 키·조회는 membershipsQuery 하나로 두어 마이페이지(#115)가 같은 캐시를 쓰고, 조직 참여(#116)가 새 승인을 보면 이 키를 무효로 한다

export type MemberRoleCode = 'OWNER' | 'STAFF' | 'TECHNICIAN';

/** MyMembershipsResponse.Membership. 발주사마다 한 줄, 처음 참여한 순서 */
export type MembershipResponse = {
  organizationId: number;
  organizationName: string;
  role: MemberRoleCode;
  /** DEACTIVATED 면 이 발주사 기능을 쓸 수 없다 */
  status: 'ACTIVE' | 'DEACTIVATED';
};

export const MEMBERSHIPS_PATH = '/api/v1/memberships';
export const membershipsQueryKey = ['memberships'] as const;

export const membershipsQuery = (api: ApiClient) =>
  queryOptions({
    queryKey: membershipsQueryKey,
    queryFn: ({ signal }) =>
      api
        .get<{ memberships: MembershipResponse[] }>(MEMBERSHIPS_PATH, {
          signal,
        })
        .then(result => result.memberships),
  });

/**
 * 작업 API 경로에 쓰는 발주사: 활성 기사 소속. 없으면 undefined.
 * 여럿이면 처음 참여한(응답 목록의 첫) 발주사다. 여러 발주사 일정 합산은 백엔드에 없다 (#112 G18)
 */
export function technicianOrganizationId(
  memberships: readonly MembershipResponse[],
): number | undefined {
  return memberships.find(
    item => item.role === 'TECHNICIAN' && item.status === 'ACTIVE',
  )?.organizationId;
}
