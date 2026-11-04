import { queryOptions } from '@tanstack/react-query';
import {
  ApiError,
  ApiErrorCode,
  ApiErrorMessage,
  isApiError,
  type ApiClient,
} from '../../shared/api';
import { isRecord } from '../../shared/isRecord';
import {
  currentAccountId,
  ProfileErrorCode,
  profilePath,
} from '../onboarding/profileApi';
import type {
  WithdrawalBlock,
  WithdrawalBlockReason,
  WithdrawalEligibility,
} from './model';

// 탈퇴 (#115, 백엔드 §2.2 P5·P6). 계정 관리에서 가능 여부를 묻고, 막히면 탈퇴 불가 화면에 사유를 보인다.
// 탈퇴(204)하면 서버가 계정을 닫고 모든 토큰을 거부한다. 탈퇴 직전에 막는 사유가 생기면 409 PROFILE-006 → 가능 여부를 다시 묻는다

export const withdrawalEligibilityPath = (accountId: number) =>
  `${profilePath(accountId)}/withdrawal-eligibility`;
export const withdrawalPath = (accountId: number) =>
  `${profilePath(accountId)}/withdrawals`;

/** 사유는 앞뒤 공백을 지운 뒤 200자(코드포인트)까지. 입력칸이 UTF-16 길이로 막으므로 서버 한도를 넘지 않는다 */
export const WITHDRAWAL_REASON_MAX_LENGTH = 200;

const REASONS: readonly WithdrawalBlockReason[] = [
  'SOLE_OWNER',
  'WORK_IN_PROGRESS',
  'WORK_PENDING_ACCEPT',
];

const invalidResponse = () =>
  new ApiError({
    kind: 'http',
    status: 200,
    message: ApiErrorMessage.invalidResponse,
  });

/**
 * WithdrawalEligibilityResponse 를 확인해 옮긴다. 판정(withdrawable)은 서버 값을 따르고,
 * 앱이 모르는 사유는 카드로 그릴 수 없어 뺀다. 모양이 다르면 서버 응답 오류로 던진다
 */
export function parseWithdrawalEligibility(
  value: unknown,
): WithdrawalEligibility {
  if (
    !isRecord(value) ||
    typeof value.withdrawable !== 'boolean' ||
    !Array.isArray(value.blocks)
  ) {
    throw invalidResponse();
  }
  const blocks = value.blocks.flatMap((block): WithdrawalBlock[] => {
    if (
      !isRecord(block) ||
      typeof block.reason !== 'string' ||
      typeof block.count !== 'number'
    ) {
      throw invalidResponse();
    }
    const reason = REASONS.find(item => item === block.reason);
    return reason === undefined ? [] : [{ reason, count: block.count }];
  });
  return { withdrawable: value.withdrawable, blocks };
}

export const withdrawalEligibilityQueryKey = ['withdrawalEligibility'] as const;

/** 기기 세션 계정의 GET /api/v1/profiles/{accountId}/withdrawal-eligibility */
export const withdrawalEligibilityQuery = (api: ApiClient) =>
  queryOptions({
    queryKey: withdrawalEligibilityQueryKey,
    queryFn: async ({ signal }) =>
      parseWithdrawalEligibility(
        await api.get(withdrawalEligibilityPath(await currentAccountId(api)), {
          signal,
        }),
      ),
  });

/** 탈퇴 요청을 보내는 중인지 볼 때 쓰는 키 (useIsMutating). 보내는 동안 화면을 떠나지 못하게 막는다 */
export const withdrawalMutationKey = ['withdrawal'] as const;

/**
 * POST /api/v1/profiles/{accountId}/withdrawals. 성공은 204.
 * 사유는 선택이라 비우면 null 로 보내고, 서버가 거절하는 NUL 문자(PROFILE-007)는 지운다.
 * COMMON-409 는 '다른 탈퇴 요청이 먼저 끝남' 과 '다른 기기의 프로필·약관 저장과 겹쳐 롤백됨' 둘 다라 계정이 살아 있는지 확인한다
 */
export async function withdrawAccount(
  api: ApiClient,
  accountId: number,
  reason: string,
): Promise<void> {
  const trimmed = reason.replace(/\0/g, '').trim();
  try {
    await api.post(withdrawalPath(accountId), {
      reason: trimmed === '' ? null : trimmed,
    });
  } catch (error) {
    if (
      !isApiError(error, ApiErrorCode.conflict) ||
      (await isAlive(api, accountId))
    ) {
      throw error;
    }
  }
}

// 409 뒤 계정이 살아 있는지 확인하는 중인지. 다른 탈퇴가 먼저 끝났으면 이 확인에서 토큰이 거부돼 세션이 만료로 끝나는데,
// 그건 탈퇴 완료라 AuthProvider 가 만료 안내를 띄우지 않는다. 앱에 API 클라이언트가 하나라 모듈에 둔다
let checkingWithdrawn = 0;
export const isCheckingWithdrawn = () => checkingWithdrawn > 0;

/**
 * 계정이 아직 살아 있는지. 탈퇴한 계정은 프로필이 PROFILE-002 이거나, 토큰이 거부돼 재발급까지 AUTH-009 로 끝난다.
 * 확인하지 못하면(네트워크 등) 탈퇴하지 못한 쪽으로 본다 (다시 시도하면 서버가 판정한다)
 */
async function isAlive(api: ApiClient, accountId: number): Promise<boolean> {
  checkingWithdrawn += 1;
  try {
    await api.get(profilePath(accountId));
    return true;
  } catch (error) {
    return !(
      isApiError(error, ProfileErrorCode.notFound) ||
      isApiError(error, ApiErrorCode.refreshRejected)
    );
  } finally {
    checkingWithdrawn -= 1;
  }
}
