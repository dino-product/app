import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { isApiError, useApiClient, type ApiClient } from '../../shared/api';
import { membershipsQueryKey } from './memberships';
import type {
  AppNotification,
  NotificationSettings,
  NotificationType,
} from './model';
import {
  flattenNotificationPages,
  nextNotificationPage,
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_SETTINGS_PATH,
  NotificationErrorCode,
  NOTIFICATIONS_PATH,
  notificationReadPath,
  type NotificationsResponse,
} from './notificationApi';
import { participationRequestsKey } from './org/participationQueries';

// 알림센터·알림 설정의 서버 상태 (#117). 화면은 이 훅들만 쓴다.
// 다시 받는 때: 화면에 다시 들어올 때(subscribed), 앱이 앞으로 돌아올 때(focusManager, #110), 당겨서 새로고침

export const notificationKeys = {
  list: ['notifications', 'list'] as const,
  settings: ['notification-settings'] as const,
};

type NotificationPages = InfiniteData<NotificationsResponse, number>;

// 함수가 그대로여야 React Query 가 같은 데이터에 같은 결과(배열)를 돌려준다
const selectNotifications = (data: NotificationPages) =>
  flattenNotificationPages(data.pages);

/**
 * 알림 목록. 쪽마다 20개를 최신순으로 받아 이어 붙인다(fetchNextPage).
 * subscribed 가 false 인 동안(화면이 가려짐)은 다시 받지 않고, true 가 되면 새로 받는다
 */
export function useNotificationList(subscribed: boolean) {
  const api = useApiClient();
  return useInfiniteQuery({
    queryKey: notificationKeys.list,
    queryFn: ({ pageParam, signal }) =>
      api.get<NotificationsResponse>(NOTIFICATIONS_PATH, {
        query: {
          unreadOnly: false,
          page: pageParam,
          size: NOTIFICATION_PAGE_SIZE,
        },
        signal,
      }),
    initialPageParam: 0,
    getNextPageParam: nextNotificationPage,
    select: selectNotifications,
    subscribed,
  });
}

// 캐시의 알림 한 줄만 읽음·읽지 않음으로 바꾼다. 다른 줄과 다른 쪽은 같은 객체로 둔다.
// 받은 시각(상대 시간의 기준)은 그대로 두어 다른 행이 다시 그려지지 않게 한다
function setNotificationRead(
  queryClient: QueryClient,
  id: string,
  read: boolean,
) {
  const updatedAt = queryClient.getQueryState(
    notificationKeys.list,
  )?.dataUpdatedAt;
  queryClient.setQueryData<NotificationPages>(
    notificationKeys.list,
    data => {
      if (data === undefined) {
        return data;
      }
      const matches = (item: NotificationsResponse['notifications'][number]) =>
        String(item.id) === id && item.read !== read;
      let changed = false;
      const pages = data.pages.map(page => {
        if (!page.notifications.some(matches)) {
          return page;
        }
        changed = true;
        return {
          ...page,
          notifications: page.notifications.map(item =>
            matches(item) ? { ...item, read } : item,
          ),
        };
      });
      return changed ? { ...data, pages } : data;
    },
    { updatedAt },
  );
}

/**
 * 알림을 읽음으로 보낸다(PUT …/read). 보내자마자 읽음으로 보이고, 실패하면 읽지 않음으로 돌린다.
 * 돌려주는 함수는 렌더마다 같다 (memo 행에 넘긴다)
 */
export function useMarkNotificationRead() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: (id: string) => api.put<void>(notificationReadPath(id)),
    onMutate: id => setNotificationRead(queryClient, id, true),
    // 보내는 사이 다시 받은 목록이 읽기 전 값으로 덮었을 수 있다
    onSuccess: (_, id) => setNotificationRead(queryClient, id, true),
    onError: (error, id) => {
      setNotificationRead(queryClient, id, false);
      // 없거나 숨겨진 알림(작업을 거절함)이면 목록을 다시 받아 지운다
      if (isApiError(error, NotificationErrorCode.notFound)) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.list });
      }
    },
  });
  return mutate;
}

const PARTICIPATION_RESULTS: ReadonlySet<NotificationType> = new Set([
  'PARTICIPATION_REQUEST_APPROVED',
  'PARTICIPATION_REQUEST_REJECTED',
]);

/** 알림을 열었다. 참여 요청 결과(승인·거절)면 신청 현황과 소속(승인되면 새 소속)을 다시 받게 한다 (#116) */
export function refreshForOpenedNotification(
  queryClient: QueryClient,
  { type }: AppNotification,
) {
  if (PARTICIPATION_RESULTS.has(type)) {
    queryClient.invalidateQueries({ queryKey: participationRequestsKey });
    queryClient.invalidateQueries({ queryKey: membershipsQueryKey });
  }
}

// 같은 계정의 첫 저장이 동시에 겹치면 409 NOTIFICATION-004. 다시 보내면 저장되므로 한 번 더 보낸다
async function saveNotificationSettings(
  api: ApiClient,
  settings: NotificationSettings,
) {
  try {
    await api.put<void>(NOTIFICATION_SETTINGS_PATH, settings);
  } catch (error) {
    if (!isApiError(error, NotificationErrorCode.settingBusy)) {
      throw error;
    }
    await api.put<void>(NOTIFICATION_SETTINGS_PATH, settings);
  }
}

// 설정 저장은 차례로 보낸다. 먼저 보낸 저장이 늦게 도착해 나중 값을 덮지 않는다
const SAVE_SETTINGS_SCOPE = { id: 'notification-settings' };

/**
 * 알림 설정. settings 는 서버 값에 저장 중인 마지막 값을 얹은 것이다(낙관적).
 * change 는 세 값 모두를 저장하고, 연달아 바꾸면 마지막 값이 남는다.
 * 마지막 저장이 실패하면 서버가 마지막으로 받은 값으로 돌리고 onSaveFailed 를 부른다
 */
export function useNotificationSettings(onSaveFailed: () => void) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: notificationKeys.settings,
    queryFn: ({ signal }) =>
      api.get<NotificationSettings>(NOTIFICATION_SETTINGS_PATH, { signal }),
  });
  // 저장 중인 마지막 값. 바로 다음 change 가 이어서 바꿀 수 있게 ref 에도 둔다
  const pendingRef = useRef<NotificationSettings | null>(null);
  const [pending, setPending] = useState<NotificationSettings | null>(null);
  const { mutate } = useMutation({
    scope: SAVE_SETTINGS_SCOPE,
    mutationFn: (next: NotificationSettings) =>
      saveNotificationSettings(api, next),
    // 서버가 받은 값. 화면을 떠난 뒤 끝나도 남는다
    onSuccess: (_, next) =>
      queryClient.setQueryData(notificationKeys.settings, next),
    // 저장하는 사이 다시 받던 설정(저장 전 값)이 늦게 와 덮지 않게, 받던 것을 버리고 서버 값을 새로 받는다
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationKeys.settings }),
  });

  const change = useCallback(
    (key: keyof NotificationSettings, value: boolean) => {
      const current =
        pendingRef.current ??
        queryClient.getQueryData<NotificationSettings>(
          notificationKeys.settings,
        );
      if (current === undefined) {
        return;
      }
      const next = { ...current, [key]: value };
      const show = (settings: NotificationSettings | null) => {
        pendingRef.current = settings;
        setPending(settings);
      };
      show(next);
      // 이 콜백은 마지막으로 부른 저장에만 온다. 앞 저장의 성공·실패는 마지막 저장이 덮는다
      mutate(next, {
        onSuccess: () => show(null),
        onError: () => {
          show(null);
          onSaveFailed();
        },
      });
    },
    [mutate, onSaveFailed, queryClient],
  );

  return {
    settings: pending ?? query.data,
    status: query.status,
    refetch: query.refetch,
    change,
  };
}
