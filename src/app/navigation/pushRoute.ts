import type { NavigatorScreenParams } from '@react-navigation/native';
import {
  WORK_NOTIFICATION_TYPES,
  type NotificationType,
} from '../../features/my/model';
import { isNotificationType } from '../../features/my/notificationApi';
import { isRecord } from '../../shared/isRecord';
import type { NotificationWorkScreen } from './notificationWork';
import type { MainTabParamList } from './types';

// 푸시를 눌렀을 때 열 화면 (#118). 백엔드 FCM data 는 notificationId·type 과, 있을 때만 workId·participationRequestId 를
// 문자열로 준다. organizationId 는 담지 않는다(#112 G8): 작업 상세는 발주사 없이 열고, 상세가 활성 기사 소속으로 정한다(#114).
// 작업 알림은 상세를 먼저 받아(notificationWorkScreen, 알림센터와 같은 규칙) 수락 대기면 요청 상세로 연다.
// 알림 종류는 알림센터(#117)의 NotificationType 을 같이 쓰고, 앱이 모르는 종류는 버린다(이을 수 없어 알림센터를 연다).
// 탭 안 화면은 initial: false 로 열어 뒤로 가면 그 탭의 첫 화면(내 작업·마이페이지)이다

/** FCM data 에서 앱이 쓰는 값 */
export type PushData = {
  notificationId?: string;
  type?: NotificationType;
  workId?: string;
  participationRequestId?: string;
};

const PUSH_ID_KEYS = [
  'notificationId',
  'workId',
  'participationRequestId',
] as const;

/** 문자열 값만 꺼낸다. 종류는 앱이 아는 것만 남긴다. 모양이 다르면 빈 값 */
export function parsePushData(data: unknown): PushData {
  if (!isRecord(data)) {
    return {};
  }
  const parsed: PushData = {};
  for (const key of PUSH_ID_KEYS) {
    const value = data[key];
    if (typeof value === 'string') {
      parsed[key] = value;
    }
  }
  if (typeof data.type === 'string' && isNotificationType(data.type)) {
    parsed.type = data.type;
  }
  return parsed;
}

// 작업 화면으로 여는 종류(알림센터와 같다). 다른 기사에게 넘어간 작업도 열고, 볼 수 없게 됐으면 상세가 그 상태를 보인다
const isWorkType = (type: NotificationType | undefined) =>
  type !== undefined && WORK_NOTIFICATION_TYPES.has(type);

/** 작업 화면으로 여는 알림이면 작업 id. 열기 전에 이 작업의 상세(상태)를 받는다 */
export function pushWorkIdOf({ type, workId }: PushData): string | undefined {
  return isWorkType(type) && workId !== undefined && /^\d+$/.test(workId)
    ? workId
    : undefined;
}

/** 루트에서 열 화면 (navigate(name, params)) */
export type PushRoute =
  | { name: 'Main'; params: NavigatorScreenParams<MainTabParamList> }
  | { name: 'RequestDetail'; params: { id: string } };

const inMain = (
  params: NavigatorScreenParams<MainTabParamList>,
): PushRoute => ({ name: 'Main', params });

/**
 * 열 화면. workScreen 은 작업 알림이면 먼저 고른 화면(notificationWorkScreen, 없으면 작업 상세).
 * 이을 수 없는 알림(모르는 종류·id 없음)은 메인의 알림센터
 */
export function pushRouteOf(
  { type, workId, participationRequestId }: PushData,
  workScreen?: NotificationWorkScreen,
): PushRoute {
  if (isWorkType(type) && workId !== undefined) {
    return workScreen === 'request'
      ? { name: 'RequestDetail', params: { id: workId } }
      : inMain({
          screen: 'home',
          params: {
            screen: 'WorkDetail',
            params: { id: workId },
            initial: false,
          },
        });
  }
  if (
    type === 'PARTICIPATION_REQUEST_REJECTED' &&
    participationRequestId !== undefined
  ) {
    return inMain({
      screen: 'my',
      params: {
        screen: 'OrgJoinRejected',
        params: { requestId: participationRequestId },
        initial: false,
      },
    });
  }
  if (type === 'PARTICIPATION_REQUEST_APPROVED') {
    return inMain({
      screen: 'my',
      params: { screen: 'OrgJoinRequests', initial: false },
    });
  }
  return inMain({
    screen: 'home',
    params: { screen: 'NotificationCenter', initial: false },
  });
}
