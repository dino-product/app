import { queryOptions } from '@tanstack/react-query';
import { ApiError, ApiErrorMessage, type ApiClient } from '../../shared/api';
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

/** POST /api/v1/profiles/{accountId}/withdrawals. 사유는 선택이라 비우면 null 로 보낸다. 성공은 204 */
export async function withdrawAccount(
  api: ApiClient,
  accountId: number,
  reason: string,
): Promise<void> {
  const trimmed = reason.trim();
  await api.post(withdrawalPath(accountId), {
    reason: trimmed === '' ? null : trimmed,
  });
}
