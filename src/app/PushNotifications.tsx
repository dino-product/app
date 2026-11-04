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
import { participationRequestsKey } from '../features/my/org/participationQueries';
import { workKeys } from '../features/work/data/keys';
import { workDetailQuery } from '../features/work/data/queries';
import type { WorkStatusCode } from '../features/work/data/status';
import { useWorkRepository } from '../features/work/data/WorkRepositoryProvider';
import {
  defaultMessaging,
  markPushRead,
  readPushDeviceId,
  readPushDeviceOwner,
  refreshPushDevice,
  registerPushDevice,
} from '../features/push/push';
import { useApiClient } from '../shared/api';
import { useAuth } from './AuthProvider';
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

// 알림센터 캐시의 접두사 (#117 notificationKeys 가 머지되면 그 키로 바꾼다)
const NOTIFICATIONS_KEY = ['notifications'] as const;

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
  const inMain = useAuth().phase === 'main';
  const [messaging] = useState(defaultMessaging);
  const inMainRef = useRef(inMain);
  // 눌렀지만 아직 열지 못한 알림 (메인 밖이거나 내비게이션이 준비되지 않았다)
  const pending = useRef<PendingPush | null>(null);

  const refresh = useCallback(
    (data: PushData) => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      if (data.workId !== undefined) {
        queryClient.invalidateQueries({ queryKey: workKeys.all });
      }
      // 승인이면 신청 현황을 다시 받으며 소속(['memberships'])도 무효화된다 (#116)
      if (data.participationRequestId !== undefined) {
        queryClient.invalidateQueries({ queryKey: participationRequestsKey });
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

  // 작업 알림은 상세를 먼저 받아 수락 대기인지 본다. 받은 상세는 캐시(같은 키)에 남아 연 화면이 바로 그린다.
  // 다시 시도하지 않는다(기다리는 동안 표시가 없다). 받지 못하면(볼 수 없는 작업·네트워크) 작업 상세가 그 상태와 다시 시도를 보인다
  const workStatusOf = useCallback(
    (data: PushData): Promise<WorkStatusCode | undefined> => {
      const workId = pushWorkIdOf(data);
      return workId === undefined
        ? Promise.resolve(undefined)
        : queryClient
            .fetchQuery({
              ...workDetailQuery(repository, Number(workId)),
              retry: false,
            })
            .then(work => work.workStatus, ignore);
    },
    [queryClient, repository],
  );

  // 열 화면. 이 기기를 등록한 계정이 아닌 계정으로 로그인했으면(로그인 전에 누른 다른 계정의 푸시) 이을 수 없어 null
  const routeOf = useCallback(
    async ({ data, owner }: PendingPush): Promise<PushRoute | null> => {
      const session = await api.session.getSession().catch(() => null);
      if (owner !== undefined && session?.accountId !== owner) {
        return null;
      }
      return pushRouteOf(data, await workStatusOf(data));
    },
    [api, workStatusOf],
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
      markPushRead(api, target.data.notificationId).then(() =>
        queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
      );
    });
  }, [api, mainReady, navigation, queryClient, routeOf]);

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
