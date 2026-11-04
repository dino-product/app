import { isApiError } from '../../../shared/api';
import type { Notice } from './components/NoticeModal';
import { OrganizationErrorCode } from './participationApi';

// 회사 참여 서버 응답(오류 코드) → 화면 안내와 갈 곳 (#116).
// '이미 참여'(Figma 3159:13440) 말고는 Figma 에 없는 경우라 문구는 기본안이다 (Figma 미확인)

export const alreadyMemberNotice = (organizationName: string): Notice => ({
  title: '이미 참여 중인 회사예요',
  message: `${organizationName}에 이미 소속되어 있어\n참여 요청을 다시 보낼 수 없습니다.`,
});

export const pendingRequestNotice = (organizationName: string): Notice => ({
  title: '이미 참여를 요청한 회사예요',
  message: `${organizationName}에 보낸 참여 요청이\n승인을 기다리고 있어요.`,
});

/** 회사 찾기 화면의 유효하지 않은 코드 안내와 같은 문구 (Figma 3255:18149) */
export const invalidCodeNotice: Notice = {
  title: '유효하지 않은 회사 코드입니다',
  message: '회사에서 코드를 변경해\n이전 참여 경로를 사용할 수 없습니다.',
};

const RETRY_LATER = '잠시 후 다시 시도해 주세요';
const tooManyFailuresNotice: Notice = {
  title: RETRY_LATER,
  message: '없는 회사 코드를 여러 번 입력해\n잠시 회사를 확인할 수 없어요.',
};

/** 회사 확인 실패. 실패 한도(429 ORGANIZATION-018)면 기다리라고, 그 밖(네트워크·서버 오류)은 다시 시도하라고 한다 */
export function lookupFailureNotice(error: unknown): Notice {
  return isApiError(error, OrganizationErrorCode.tooManyFailures)
    ? tooManyFailuresNotice
    : {
        title: '회사를 확인하지 못했어요',
        message: '잠시 후 다시 시도해 주세요.',
      };
}

/**
 * 참여 요청 실패의 안내와 안내를 닫은 뒤 갈 곳.
 * alreadyMember: 이미 참여 중인 회사 · pending: 그 회사에 승인 대기 요청이 있다 · reenterCode: 그사이 코드가 바뀌었다 ·
 * stay: 화면에 머물러 다시 보낸다
 */
export type RequestFailure = {
  next: 'alreadyMember' | 'pending' | 'reenterCode' | 'stay';
  notice: Notice;
};

export function requestFailure(
  error: unknown,
  organizationName: string,
): RequestFailure {
  if (isApiError(error, OrganizationErrorCode.alreadyMember)) {
    return {
      next: 'alreadyMember',
      notice: alreadyMemberNotice(organizationName),
    };
  }
  if (isApiError(error, OrganizationErrorCode.pendingRequest)) {
    return { next: 'pending', notice: pendingRequestNotice(organizationName) };
  }
  if (
    isApiError(error, OrganizationErrorCode.unknownCode) ||
    isApiError(error, OrganizationErrorCode.retiredCode)
  ) {
    return { next: 'reenterCode', notice: invalidCodeNotice };
  }
  if (isApiError(error, OrganizationErrorCode.lockTimeout)) {
    return {
      next: 'stay',
      notice: {
        title: RETRY_LATER,
        message: '요청이 몰려 처리하지 못했어요.\n잠시 후 다시 보내 주세요.',
      },
    };
  }
  if (isApiError(error, OrganizationErrorCode.tooManyFailures)) {
    return { next: 'stay', notice: tooManyFailuresNotice };
  }
  return {
    next: 'stay',
    notice: {
      title: '참여 요청을 보내지 못했어요',
      message: '잠시 후 다시 시도해 주세요.',
    },
  };
}

/** 받아 둔 신청 현황이 옛 상태라 취소하지 못한 실패: 이미 처리된 요청(409 -017), 없는·다른 계정의 요청(403 -016) */
export function isOutdatedCancel(error: unknown): boolean {
  return (
    isApiError(error, OrganizationErrorCode.alreadyDecided) ||
    isApiError(error, OrganizationErrorCode.notOwnRequest)
  );
}

/** 신청 취소 실패. outdated 면 받아 둔 목록이 옛 상태라 다시 받고 지금 상태로 보낸다 */
export function cancelFailure(error: unknown): Notice & {
  outdated: boolean;
} {
  if (isApiError(error, OrganizationErrorCode.alreadyDecided)) {
    return {
      outdated: true,
      title: '이미 처리된 요청이에요',
      message: '사무실이 이미 결정했거나 취소된 요청이라 취소할 수 없어요.',
    };
  }
  if (isApiError(error, OrganizationErrorCode.notOwnRequest)) {
    return {
      outdated: true,
      title: '처리할 수 없는 요청이에요',
      message: '이미 사라졌거나 이 계정의 요청이 아니에요.',
    };
  }
  return {
    outdated: false,
    title: '신청을 취소하지 못했어요',
    message: '잠시 후 다시 시도해 주세요.',
  };
}
