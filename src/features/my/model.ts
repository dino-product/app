import type { AccountProfile } from '../onboarding/profileApi';

// 마이 탭의 데이터 모양. Dino 백엔드 응답(/api/v1/profiles, /memberships, /notification-settings,
// /notifications, /profiles/{accountId}/withdrawal-eligibility)과 같은 이름을 써서 연동 때 그대로 옮긴다.

/** 마이페이지·프로필 수정에 보이는 프로필 */
export type Profile = {
  name: string;
  /** 숫자 11자리. 화면에서는 010-0000-0000 으로 보여 준다 */
  phoneNumber: string;
  /** 가입을 마친 시각 (ISO, UTC). 가입을 마치기 전이면 null */
  signedUpAt: string | null;
};

export type ProfileInput = Pick<Profile, 'name' | 'phoneNumber'>;

/**
 * 프로필 응답(ProfileResponse) → 마이 탭 프로필. 가입을 마친 계정은 값이 다 있다.
 * 켠 직후 서버 확인 전에는 가입을 마치지 않은 계정의 응답이 잠깐 올 수 있어 빈 값(null)도 받는다
 */
export function toMyProfile({
  name,
  phoneNumber,
  signedUpAt,
}: AccountProfile): Profile {
  return { name: name ?? '', phoneNumber: phoneNumber ?? '', signedUpAt };
}

export type MemberRole = 'OWNER' | 'STAFF' | 'TECHNICIAN';

export const memberRoleLabels: Record<MemberRole, string> = {
  OWNER: '총관리자',
  STAFF: '직원',
  TECHNICIAN: '기사',
};

export type NotificationSettings = {
  workAssignmentEnabled: boolean;
  scheduleChangeEnabled: boolean;
  workCancellationEnabled: boolean;
};

export type NotificationType =
  | 'WORK_ASSIGNED'
  | 'WORK_RESCHEDULED'
  | 'WORK_REASSIGNED_AWAY'
  | 'WORK_CANCELED'
  | 'COMPLETION_REPORT_REQUESTED'
  | 'PARTICIPATION_REQUEST_APPROVED'
  | 'PARTICIPATION_REQUEST_REJECTED';

// Figma 알림센터에는 작업 취소·신규 배정만 있다. 나머지는 서버 종류에 맞춘 기본안이다
export const notificationTypeLabels: Record<NotificationType, string> = {
  WORK_ASSIGNED: '신규 배정',
  WORK_RESCHEDULED: '일정 변경',
  WORK_REASSIGNED_AWAY: '배정 변경',
  WORK_CANCELED: '작업 취소',
  COMPLETION_REPORT_REQUESTED: '완료보고 요청',
  PARTICIPATION_REQUEST_APPROVED: '참여 승인',
  PARTICIPATION_REQUEST_REJECTED: '참여 거절',
};

export type AppNotification = {
  id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  /** 알림 시각 (ISO, UTC) */
  createdAt: string;
  /** 알림이 생긴 발주사 */
  organizationId?: string;
  /** 작업 알림이면 그 작업 (눌렀을 때 열 작업 상세) */
  workId?: string;
  /** 참여 요청 결과 알림이면 그 요청 (눌렀을 때 열 화면의 대상) */
  participationRequestId?: string;
};

/** 알림을 눌렀을 때 열 화면 */
export type NotificationTarget =
  | { kind: 'work'; organizationId: string; workId: string }
  | { kind: 'participationRejected'; requestId: string };

/** 작업 화면으로 여는 알림 종류 (알림센터·푸시 공용, #118) */
export const WORK_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
  'WORK_ASSIGNED',
  'WORK_RESCHEDULED',
  'WORK_REASSIGNED_AWAY',
  'WORK_CANCELED',
  'COMPLETION_REPORT_REQUESTED',
]);

/**
 * 눌렀을 때 열 화면. 작업 알림은 작업 상세(볼 수 없게 된 작업이면 상세가 그 상태를 보인다),
 * 참여 거절은 거절 화면(#73). 승인 결과 화면은 아직 없어 참여 승인은 열 곳이 없다
 */
export function notificationTargetOf({
  type,
  organizationId,
  workId,
  participationRequestId,
}: AppNotification): NotificationTarget | null {
  if (WORK_NOTIFICATION_TYPES.has(type)) {
    return organizationId !== undefined && workId !== undefined
      ? { kind: 'work', organizationId, workId }
      : null;
  }
  if (
    type === 'PARTICIPATION_REQUEST_REJECTED' &&
    participationRequestId !== undefined
  ) {
    return { kind: 'participationRejected', requestId: participationRequestId };
  }
  return null;
}

export type WithdrawalBlockReason =
  | 'SOLE_OWNER'
  | 'WORK_IN_PROGRESS'
  | 'WORK_PENDING_ACCEPT';

export type WithdrawalBlock = { reason: WithdrawalBlockReason; count: number };

export type WithdrawalEligibility = {
  withdrawable: boolean;
  blocks: readonly WithdrawalBlock[];
};

export type WithdrawalBlockCard = {
  reason: WithdrawalBlockReason;
  title: string;
  count: number;
  description: string;
};

const PHONE_DIGITS = 11;

/** 숫자만 남겨 010-1234-5678 처럼 하이픈을 넣는다. 입력하는 동안에도 자리마다 붙는다 */
export function formatPhoneNumber(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, PHONE_DIGITS);
  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/** 가입일 2024.03.15 (기기 시간대 기준) */
export function formatJoinDate(signedUpAt: string): string {
  const date = new Date(signedUpAt);
  return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(
    date.getDate(),
  )}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 알림 시각을 3시간 전, 2일 전 처럼 쓴다 */
export function formatRelativeTime(at: string, now: Date): string {
  const elapsed = now.getTime() - new Date(at).getTime();
  if (elapsed < MINUTE) {
    return '방금 전';
  }
  if (elapsed < HOUR) {
    return `${Math.floor(elapsed / MINUTE)}분 전`;
  }
  if (elapsed < DAY) {
    return `${Math.floor(elapsed / HOUR)}시간 전`;
  }
  return `${Math.floor(elapsed / DAY)}일 전`;
}

// 서버(SaveProfileRequest)와 같은 규칙. 이름은 앞뒤 공백을 지운 뒤 2~20자 한글·영문, 연락처는 010 으로 시작하는 11자리
/** 서버가 입력 규칙 위반(PROFILE-001)으로 거절했을 때 보이는 규칙 문구. 서버는 어느 칸이 틀렸는지 알려 주지 않는다 */
export const PROFILE_RULE_MESSAGE =
  '이름은 한글·영문 2~20자, 연락처는 010으로 시작하는 11자리로 입력해 주세요.';
const NAME_PATTERN = /^[가-힣a-zA-Z]{2,20}$/;
const PHONE_PATTERN = /^010\d{8}$/;

const normalize = ({ name, phoneNumber }: ProfileInput): ProfileInput => ({
  name: name.trim(),
  phoneNumber: phoneNumber.replace(/\D/g, ''),
});

/** 서버 규칙에 맞는 이름·연락처인지 (프로필 수정, 온보딩 프로필 등록) */
export function isValidProfile(input: ProfileInput): boolean {
  const { name, phoneNumber } = normalize(input);
  return NAME_PATTERN.test(name) && PHONE_PATTERN.test(phoneNumber);
}

/** 바뀐 값이 있고 서버 규칙에 맞을 때만 저장할 수 있다 */
export function canSaveProfile(
  saved: ProfileInput,
  input: ProfileInput,
): boolean {
  const before = normalize(saved);
  const after = normalize(input);
  const changed =
    before.name !== after.name || before.phoneNumber !== after.phoneNumber;
  return changed && isValidProfile(after);
}

/**
 * 서버가 withdrawable 과 막는 사유를 함께 주므로, 둘이 어긋나면 막힌 쪽으로 본다.
 * 사유는 탈퇴 불가 화면의 카드와 같은 기준(건수가 있는 사유)으로 센다
 */
export function canWithdraw(eligibility: WithdrawalEligibility): boolean {
  return (
    eligibility.withdrawable &&
    withdrawalBlockCards(eligibility.blocks).length === 0
  );
}

// Figma(탈퇴 불가)에는 작업 두 가지만 있다. 유일한 총관리자는 서버에만 있는 사유라 문구가 기본안이다
const blockSpecs: Record<
  WithdrawalBlockReason,
  { order: number; title: string; describe: (count: number) => string }
> = {
  WORK_IN_PROGRESS: {
    order: 0,
    title: '진행 중인 작업',
    describe: count => `현재 작업 중 상태인 작업 ${count}건이 있습니다`,
  },
  WORK_PENDING_ACCEPT: {
    order: 1,
    title: '미완료 작업 배정',
    describe: count => `수락 대기 중인 작업 ${count}건이 있습니다`,
  },
  SOLE_OWNER: {
    order: 2,
    title: '유일한 총관리자',
    describe: count => `총관리자가 나 혼자인 발주사 ${count}곳이 있습니다`,
  },
};

/** 탈퇴 불가 화면의 사유 카드. 건수가 있는 사유만 정해진 순서로 */
export function withdrawalBlockCards(
  blocks: readonly WithdrawalBlock[],
): WithdrawalBlockCard[] {
  return blocks
    .filter(block => block.count > 0)
    .sort((a, b) => blockSpecs[a.reason].order - blockSpecs[b.reason].order)
    .map(({ reason, count }) => ({
      reason,
      title: blockSpecs[reason].title,
      count,
      description: blockSpecs[reason].describe(count),
    }));
}
