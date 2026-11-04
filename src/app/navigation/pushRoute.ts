import type { NavigatorScreenParams } from '@react-navigation/native';
import { isRecord } from '../../shared/isRecord';
import type { MainTabParamList } from './types';

// 푸시를 눌렀을 때 열 화면 (#118). 백엔드 FCM data 는 notificationId·type 과, 있을 때만 workId·participationRequestId 를
// 문자열로 준다. organizationId 는 담지 않는다(#112 G8): 작업 상세는 발주사 없이 열고, 상세가 활성 기사 소속으로 정한다(#114).
// 탭 안 화면은 initial: false 로 열어 뒤로 가면 그 탭의 첫 화면(내 작업·마이페이지)이다

/** FCM data 에서 앱이 쓰는 값 */
export type PushData = {
  notificationId?: string;
  type?: string;
  workId?: string;
  participationRequestId?: string;
};

const PUSH_DATA_KEYS = [
  'notificationId',
  'type',
  'workId',
  'participationRequestId',
] as const;

/** 문자열 값만 꺼낸다. 모양이 다르면 빈 값 */
export function parsePushData(data: unknown): PushData {
  if (!isRecord(data)) {
    return {};
  }
  const parsed: PushData = {};
  for (const key of PUSH_DATA_KEYS) {
    const value = data[key];
    if (typeof value === 'string') {
      parsed[key] = value;
    }
  }
  return parsed;
}

// 작업 상세로 여는 종류. 다른 기사에게 넘어간 작업(WORK_REASSIGNED_AWAY)도 열고, 볼 수 없게 됐으면 상세가 그 상태를 보인다
const WORK_TYPES: readonly string[] = [
  'WORK_ASSIGNED',
  'WORK_RESCHEDULED',
  'WORK_REASSIGNED_AWAY',
  'WORK_CANCELED',
  'COMPLETION_REPORT_REQUESTED',
];

/** 메인에서 열 화면 (navigate('Main', …) 의 파라미터). 이을 수 없는 알림(모르는 종류·id 없음)은 알림센터 */
export function pushRouteOf({
  type,
  workId,
  participationRequestId,
}: PushData): NavigatorScreenParams<MainTabParamList> {
  if (type !== undefined && WORK_TYPES.includes(type) && workId !== undefined) {
    return {
      screen: 'home',
      params: { screen: 'WorkDetail', params: { id: workId }, initial: false },
    };
  }
  if (
    type === 'PARTICIPATION_REQUEST_REJECTED' &&
    participationRequestId !== undefined
  ) {
    return {
      screen: 'my',
      params: {
        screen: 'OrgJoinRejected',
        params: { requestId: participationRequestId },
        initial: false,
      },
    };
  }
  if (type === 'PARTICIPATION_REQUEST_APPROVED') {
    return {
      screen: 'my',
      params: { screen: 'OrgJoinRequests', initial: false },
    };
  }
  return {
    screen: 'home',
    params: { screen: 'NotificationCenter', initial: false },
  };
}
