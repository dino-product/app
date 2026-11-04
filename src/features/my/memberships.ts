import { queryOptions } from '@tanstack/react-query';
import { ApiError, ApiErrorMessage, type ApiClient } from '../../shared/api';
import { isRecord } from '../../shared/isRecord';
import { memberRoleLabels, type MemberRole } from './model';

// 내 소속 목록 (GET /api/v1/memberships, api-spec.md §2.3 O5). 작업 API 경로의 발주사(활성 기사 소속, #114)와
// 마이페이지 소속 발주사(#115)가 캐시 키·조회(membershipsQuery) 하나를 같이 쓴다. 조직 참여(#116)가 새 승인을 보면 이 키를 무효로 한다

/** MyMembershipsResponse.Membership. 발주사마다 한 줄, 처음 참여한 순서 */
export type MembershipResponse = {
  organizationId: number;
  organizationName: string;
  role: MemberRole;
  /** DEACTIVATED 면 이 발주사 기능을 쓸 수 없다 */
  status: 'ACTIVE' | 'DEACTIVATED';
};

export const MEMBERSHIPS_PATH = '/api/v1/memberships';
export const membershipsQueryKey = ['memberships'] as const;

const STATUSES: readonly unknown[] = ['ACTIVE', 'DEACTIVATED'];
const isMemberRole = (value: unknown): value is MemberRole =>
  typeof value === 'string' &&
  Object.prototype.hasOwnProperty.call(memberRoleLabels, value);

const invalidResponse = () =>
  new ApiError({
    kind: 'http',
    status: 200,
    message: ApiErrorMessage.invalidResponse,
  });

/** 서버 응답을 확인해 옮긴다. 앱이 모르는 역할의 줄은 라벨을 붙일 수 없어 빼고, 모양이 다르면 서버 응답 오류로 던진다 */
export function parseMemberships(value: unknown): MembershipResponse[] {
  if (!isRecord(value) || !Array.isArray(value.memberships)) {
    throw invalidResponse();
  }
  return value.memberships.flatMap(item => {
    if (
      !isRecord(item) ||
      typeof item.organizationId !== 'number' ||
      typeof item.organizationName !== 'string' ||
      typeof item.role !== 'string' ||
      !STATUSES.includes(item.status)
    ) {
      throw invalidResponse();
    }
    if (!isMemberRole(item.role)) {
      return [];
    }
    return [
      {
        organizationId: item.organizationId,
        organizationName: item.organizationName,
        role: item.role,
        status: item.status as MembershipResponse['status'],
      },
    ];
  });
}

export const membershipsQuery = (api: ApiClient) =>
  queryOptions({
    queryKey: membershipsQueryKey,
    queryFn: async ({ signal }) =>
      parseMemberships(await api.get(MEMBERSHIPS_PATH, { signal })),
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
