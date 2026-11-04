import {
  getInitialNotification,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  notificationKeys,
  refreshForOpenedNotification,
  useMarkNotificationRead,
} from '../features/my/notificationQueries';
import { workKeys } from '../features/work/data/keys';
import { useWorkRepository } from '../features/work/data/WorkRepositoryProvider';
import {
  defaultMessaging,
  readPushDeviceId,
  readPushDeviceOwner,
  refreshPushDevice,
  registerPushDevice,
} from '../features/push/push';
import { useApiClient } from '../shared/api';
import { useAuth } from './AuthProvider';
import { notificationWorkScreen } from './navigation/notificationWork';
import {
  parsePushData,
  pushRouteOf,
  pushWorkIdOf,
  type PushData,
  type PushRoute,
} from './navigation/pushRoute';
import type { RootStackParamList } from './navigation/types';

// 앱 푸시를 앱에 잇는다 (#118). 아무것도 그리지 않고, 상태를 두지 않아 다시 그리게 하지 않는다.
// - 메인(가입 완료)에 들어올 때마다 권한을 확인하고 기기를 등록한다. 토큰이 바뀌면 다시 등록한다 (가입 전엔 PROFILE-005)
// - 앱이 앞에 있을 때 받으면 알림센터·(작업 알림이면) 작업·(참여 결과면) 신청 현황 캐시를 다시 받게 한다. iOS 는 배너도 뜬다(firebase.json),
//   Android 는 시스템이 띄우지 않아 알림센터 갱신으로 대신한다
// - 알림을 눌러 열면(백그라운드·종료) 그 화면을 열고 읽음 처리한다. 수락 대기 작업은 요청 상세로 연다.
//   로그인 전·가입 중·세션 만료면 메인에 들어온 뒤 연다. 다른 계정으로 로그인했으면 열지 않고 메인에 머문다
// Firebase 설정 파일이 없는 빌드는 아무것도 하지 않는다

const ignore = () => undefined;

/** 누른 알림과, 누른 때 이 기기를 등록해 둔 계정 */
type PendingPush = { data: PushData; owner: number | undefined };

export function PushNotifications({
  navigation,
}: {
  navigation: NavigationContainerRefWithCurrent<RootStackParamList>;
}) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const repository = useWorkRepository();
  // 읽음은 알림센터(#117)와 같이 보낸다: 목록에서 바로 읽음으로 보이고, 실패하면 되돌린다
  const markRead = useMarkNotificationRead();
  const inMain = useAuth().phase === 'main';
  const [messaging] = useState(defaultMessaging);
  const inMainRef = useRef(inMain);
  // 눌렀지만 아직 열지 못한 알림 (메인 밖이거나 내비게이션이 준비되지 않았다)
  const pending = useRef<PendingPush | null>(null);

  const refresh = useCallback(
    (data: PushData) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list });
      if (data.workId !== undefined) {
        queryClient.invalidateQueries({ queryKey: workKeys.all });
      }
      // 참여 요청 결과면 신청 현황과 소속을 다시 받게 한다 (알림센터에서 열 때와 같다, #116·#117)
      if (data.type !== undefined) {
        refreshForOpenedNotification(queryClient, { type: data.type });
      }
    },
    [queryClient],
  );

  // 메인 묶음이 그려졌을 때만 연다 (로그인 전·가입 중에는 루트에 Main 이 없다).
  // 메인에 들어오면 루트 화면 목록이 바뀌어(state 이벤트) 다시 온다
  const mainReady = useCallback(
    () =>
      navigation.isReady() &&
      navigation.getRootState()?.routeNames.includes('Main') === true,
    [navigation],
  );

  // 열 화면. 이 기기를 등록한 계정이 아닌 계정으로 로그인했으면(로그인 전에 누른 다른 계정의 푸시) 이을 수 없어 null
  const routeOf = useCallback(
    async ({ data, owner }: PendingPush): Promise<PushRoute | null> => {
      const session = await api.session.getSession().catch(() => null);
      if (owner !== undefined && session?.accountId !== owner) {
        return null;
      }
      // 작업 알림은 상세를 먼저 받아 수락 대기면 요청 상세로 연다 (알림센터와 같은 규칙)
      const workId = pushWorkIdOf(data);
      return pushRouteOf(
        data,
        workId === undefined
          ? undefined
          : await notificationWorkScreen(
              queryClient,
              repository,
              Number(workId),
            ),
      );
    },
    [api, queryClient, repository],
  );

  // 마지막에 누른 알림만 열고, 고르는 사이 사용자가 화면을 옮겼거나 로그아웃했으면 열지 않는다 (#117 알림센터와 같은 규칙).
  // 이을 수 없는 알림이면 지금 화면(메인)에 머문다
  const openSeq = useRef(0);
  const openPending = useCallback(() => {
    const target = pending.current;
    if (target === null || !mainReady()) {
      return;
    }
    pending.current = null;
    openSeq.current += 1;
    const seq = openSeq.current;
    const startedOn = navigation.getCurrentRoute()?.key;
    routeOf(target).then(route => {
      if (
        route === null ||
        seq !== openSeq.current ||
        !mainReady() ||
        navigation.getCurrentRoute()?.key !== startedOn
      ) {
        return;
      }
      if (route.name === 'RequestDetail') {
        navigation.navigate('RequestDetail', route.params);
      } else {
        navigation.navigate('Main', route.params);
      }
      if (target.data.notificationId !== undefined) {
        markRead(target.data.notificationId);
      }
    });
  }, [mainReady, markRead, navigation, routeOf]);

  useEffect(() => {
    inMainRef.current = inMain;
  }, [inMain]);

  useEffect(() => {
    if (messaging === null) {
      return;
    }
    const open = (message: RemoteMessage | null) => {
      if (message === null) {
        return;
      }
      const data = parsePushData(message.data);
      refresh(data);
      // 누른 때 이 기기를 등록해 둔 계정 (로그인 뒤 다른 계정이면 열지 않는다)
      pending.current = { data, owner: readPushDeviceOwner() };
      openPending();
    };
    const unsubscribes = [
      onMessage(messaging, message => refresh(parsePushData(message.data))),
      onNotificationOpenedApp(messaging, open),
      onTokenRefresh(messaging, token => {
        refreshPushDevice(api, token, () => inMainRef.current).catch(ignore);
      }),
      navigation.addListener('ready', openPending),
      navigation.addListener('state', openPending),
    ];
    getInitialNotification(messaging).then(open, ignore);
    return () => unsubscribes.forEach(unsubscribe => unsubscribe());
  }, [api, messaging, navigation, openPending, refresh]);

  // 메인에 들어올 때마다 (켤 때 포함) 등록한다. 메인을 떠나면(로그아웃) 늦게 끝난 등록은 남기지 않는다.
  // 등록하지 못했으면(iOS 첫 실행에 APNs 토큰이 늦어 FCM 토큰 실패·네트워크) 앱이 앞으로 돌아올 때 다시 한다
  useEffect(() => {
    if (!inMain || messaging === null) {
      return;
    }
    let current = true;
    let registering: Promise<unknown> | null = null;
    const register = () => {
      registering ??= registerPushDevice(api, messaging, () => current)
        .catch(ignore)
        .finally(() => {
          registering = null;
        });
    };
    register();
    const subscription = AppState.addEventListener('change', status => {
      if (status === 'active' && readPushDeviceId() === undefined) {
        register();
      }
    });
    return () => {
      current = false;
      subscription.remove();
    };
  }, [api, inMain, messaging]);

  return null;
}
