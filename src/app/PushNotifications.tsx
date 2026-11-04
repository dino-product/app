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
import { participationRequestsKey } from '../features/my/org/participationQueries';
import {
  defaultMessaging,
  markPushRead,
  refreshPushDevice,
  registerPushDevice,
} from '../features/push/push';
import { useApiClient } from '../shared/api';
import { useAuth } from './AuthProvider';
import {
  parsePushData,
  pushRouteOf,
  type PushData,
} from './navigation/pushRoute';
import type { RootStackParamList } from './navigation/types';

// 앱 푸시를 앱에 잇는다 (#118). 아무것도 그리지 않고, 상태를 두지 않아 다시 그리게 하지 않는다.
// - 메인(가입 완료)에 들어올 때마다 권한을 확인하고 기기를 등록한다. 토큰이 바뀌면 다시 등록한다 (가입 전엔 PROFILE-005)
// - 앱이 앞에 있을 때 받으면 알림센터·(작업 알림이면) 작업·(참여 결과면) 신청 현황 캐시를 다시 받게 한다. iOS 는 배너도 뜬다(firebase.json),
//   Android 는 시스템이 띄우지 않아 알림센터 갱신으로 대신한다
// - 알림을 눌러 열면(백그라운드·종료) 그 화면을 열고 읽음 처리한다. 로그인 전·가입 중·세션 만료면 메인에 들어온 뒤 연다
// Firebase 설정 파일이 없는 빌드는 아무것도 하지 않는다

// 알림센터(#117 notificationKeys)·작업(#114 workKeys.all) 캐시의 접두사
const NOTIFICATIONS_KEY = ['notifications'] as const;
const WORK_KEY = ['work'] as const;

const ignore = () => undefined;

export function PushNotifications({
  navigation,
}: {
  navigation: NavigationContainerRefWithCurrent<RootStackParamList>;
}) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const inMain = useAuth().phase === 'main';
  const [messaging] = useState(defaultMessaging);
  const inMainRef = useRef(inMain);
  // 눌렀지만 아직 열지 못한 알림 (메인 밖이거나 내비게이션이 준비되지 않았다)
  const pending = useRef<PushData | null>(null);

  const refresh = useCallback(
    (data: PushData) => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      if (data.workId !== undefined) {
        queryClient.invalidateQueries({ queryKey: WORK_KEY });
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
  const openPending = useCallback(() => {
    const data = pending.current;
    if (
      data === null ||
      !navigation.isReady() ||
      !navigation.getRootState()?.routeNames.includes('Main')
    ) {
      return;
    }
    pending.current = null;
    navigation.navigate('Main', pushRouteOf(data));
    markPushRead(api, data.notificationId).then(() =>
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
    );
  }, [api, navigation, queryClient]);

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
      pending.current = data;
      openPending();
    };
    const unsubscribes = [
      onMessage(messaging, message => refresh(parsePushData(message.data))),
      onNotificationOpenedApp(messaging, open),
      onTokenRefresh(messaging, token => {
        if (inMainRef.current) {
          refreshPushDevice(api, token).catch(ignore);
        }
      }),
      navigation.addListener('ready', openPending),
      navigation.addListener('state', openPending),
    ];
    getInitialNotification(messaging).then(open, ignore);
    return () => unsubscribes.forEach(unsubscribe => unsubscribe());
  }, [api, messaging, navigation, openPending, refresh]);

  // 메인에 들어올 때마다 (켤 때 포함) 등록한다. 메인을 떠나면(로그아웃) 늦게 끝난 등록은 남기지 않는다
  useEffect(() => {
    if (!inMain || messaging === null) {
      return;
    }
    let current = true;
    registerPushDevice(api, messaging, () => current).catch(ignore);
    return () => {
      current = false;
    };
  }, [api, inMain, messaging]);

  return null;
}
