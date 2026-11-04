import { queryOptions } from '@tanstack/react-query';
import {
  ApiError,
  ApiErrorCode,
  ApiErrorMessage,
  isApiError,
  type ApiClient,
} from '../../shared/api';
import { isRecord } from '../../shared/isRecord';
import { currentAccountId, profilePath } from '../onboarding/profileApi';
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
 * 동시에 두 번 보내 늦은 쪽이 받는 COMMON-409 는 이미 탈퇴됐다는 뜻이라 마친 것으로 본다
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
    if (!isApiError(error, ApiErrorCode.conflict)) {
      throw error;
    }
  }
}
