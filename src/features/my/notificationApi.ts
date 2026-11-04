import {
  notificationTypeLabels,
  type AppNotification,
  type NotificationType,
} from './model';

// 알림센터·알림 설정 API (api-spec §2.5 N1·N3·N4·N5, 백엔드 NotificationController·NotificationSettingController).
// 안 읽은 수(N2)는 종에 표시가 없어(Figma 확인) 쓰지 않는다.
// 모두 가입을 마친 계정만 부를 수 있다(가입 전이면 PROFILE-005). 메인 탭에서만 쓰인다

/** GET ?unreadOnly&page&size → NotificationsResponse. 최신순 고정 */
export const NOTIFICATIONS_PATH = '/api/v1/notifications';
/** PUT, 본문 없음 → 204 (이미 읽었어도 성공) */
export const notificationReadPath = (notificationId: string) =>
  `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`;
/** GET → NotificationSettings, PUT(세 값 모두 필수) → 204 */
export const NOTIFICATION_SETTINGS_PATH = '/api/v1/notification-settings';

/** 한 쪽의 알림 수 (서버 기본값, 1~100) */
export const NOTIFICATION_PAGE_SIZE = 20;
/** 서버는 page×size 가 이 값을 넘는 쪽을 NOTIFICATION-001 로 거절한다 */
const MAX_NOTIFICATION_OFFSET = 10_000;

export const NotificationErrorCode = {
  /** 404 알림 없음·숨김 (작업을 거절하면 그 작업의 알림이 숨겨진다) */
  notFound: 'NOTIFICATION-002',
  /** 409 같은 계정의 첫 설정 저장이 동시에 겹침 → 다시 보내면 저장된다 */
  settingBusy: 'NOTIFICATION-004',
} as const;

/** 알림 한 줄 (NotificationResponse) */
export type NotificationResponse = {
  id: number;
  /** 서버 enum 보다 넓게 받는다(사무실 알림·새 종류). 앱이 아는 종류만 화면 알림이 된다 */
  type: NotificationType | (string & {});
  organizationId: number | null;
  /** 작업과 무관한 알림이면 null */
  workId: number | null;
  /** 참여 요청 결과가 아닌 알림이면 null */
  participationRequestId: number | null;
  /** 서버가 만든 완성 문구 (시각은 한국 시간) */
  message: string;
  read: boolean;
  /** 알림을 일으킨 일이 생긴 시각 (ISO, UTC) */
  createdAt: string;
};

/** 알림 목록 한 쪽 (NotificationsResponse). 쪽이 끝을 넘으면 notifications 가 비어 있다 */
export type NotificationsResponse = {
  notifications: NotificationResponse[];
  totalCount: number;
  page: number;
  size: number;
};

const optionalId = (value: number | null) =>
  value === null ? undefined : String(value);

/** 기사 앱이 아는 알림 종류인지 (알림센터 응답·푸시 data 공용, #118) */
export const isNotificationType = (type: string): type is NotificationType =>
  Object.prototype.hasOwnProperty.call(notificationTypeLabels, type);

/**
 * 서버 알림 → 화면 알림. id 는 문자열로 바꾸고 시각은 UTC 그대로 둔다(화면이 기기 시각과의 차이로 쓴다).
 * 기사 앱에 오지 않는 종류(사무실 알림 등)는 그릴 수 없어 null
 */
export function toAppNotification(
  response: NotificationResponse,
): AppNotification | null {
  if (!isNotificationType(response.type)) {
    return null;
  }
  return {
    id: String(response.id),
    type: response.type,
    message: response.message,
    read: response.read,
    createdAt: response.createdAt,
    organizationId: optionalId(response.organizationId),
    workId: optionalId(response.workId),
    participationRequestId: optionalId(response.participationRequestId),
  };
}

/** useInfiniteQuery 의 getNextPageParam. 마지막 쪽이거나 서버 조회 한도를 넘으면 undefined */
export function nextNotificationPage({
  notifications,
  totalCount,
  page,
  size,
}: NotificationsResponse): number | undefined {
  const next = page + 1;
  if (
    notifications.length === 0 ||
    next * size >= totalCount ||
    next * size > MAX_NOTIFICATION_OFFSET
  ) {
    return undefined;
  }
  return next;
}

// 같은 서버 알림 객체는 같은 화면 알림으로 바꾼다. 한 줄만 바뀌면(읽음) 나머지 행(memo)은 다시 그리지 않는다
const converted = new WeakMap<NotificationResponse, AppNotification | null>();

function convertOnce(response: NotificationResponse) {
  if (!converted.has(response)) {
    converted.set(response, toAppNotification(response));
  }
  return converted.get(response) ?? null;
}

/**
 * 받은 쪽들을 차례로 이어 붙인다. 오프셋 쪽이라 받는 사이 새 알림이 오면
 * 앞 쪽 끝의 알림이 다음 쪽 앞에 또 오므로 먼저 받은 것만 둔다
 */
export function flattenNotificationPages(
  pages: readonly NotificationsResponse[],
): AppNotification[] {
  const seen = new Set<string>();
  const items: AppNotification[] = [];
  for (const { notifications } of pages) {
    for (const response of notifications) {
      const item = convertOnce(response);
      if (item !== null && !seen.has(item.id)) {
        seen.add(item.id);
        items.push(item);
      }
    }
  }
  return items;
}
