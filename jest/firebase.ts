import type { RemoteMessage } from '@react-native-firebase/messaging';

// Firebase(앱 푸시, #118)는 네이티브 모듈이라 테스트에서는 목으로 바꾼다 (jest/setup.js).
// 기본은 Firebase 설정 파일이 없는 빌드(CI)처럼 기본 앱이 없다 → 앱은 푸시를 쓰지 않는다.
// 푸시를 켜려면 enableFirebase() 를 부르고, receivePush·openPush·refreshPushToken 으로 네이티브 이벤트를 흉내 낸다.
// 테스트마다 jest/setupAfterEnv.js 가 resetFirebaseMock 으로 되돌린다

// 라이브러리(lib/statics.ts)와 같은 값
const AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
  EPHEMERAL: 3,
} as const;

type Listener<T> = (value: T) => unknown;

const state = {
  configured: false,
  token: 'fcm-token-1',
  permission: AuthorizationStatus.AUTHORIZED as number,
  initialNotification: null as RemoteMessage | null,
  messageListeners: new Set<Listener<RemoteMessage>>(),
  openedListeners: new Set<Listener<RemoteMessage>>(),
  tokenListeners: new Set<Listener<string>>(),
};

const messagingInstance = { app: { name: '[DEFAULT]' } };

const listen =
  <T>(listeners: Set<Listener<T>>) =>
  (_messaging: unknown, listener: Listener<T>) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

export const firebaseApp = {
  __esModule: true,
  getApps: jest.fn(),
};

export const firebaseMessaging = {
  __esModule: true,
  AuthorizationStatus,
  getMessaging: jest.fn(),
  requestPermission: jest.fn(),
  getToken: jest.fn(),
  deleteToken: jest.fn(),
  onMessage: jest.fn(),
  onNotificationOpenedApp: jest.fn(),
  onTokenRefresh: jest.fn(),
  getInitialNotification: jest.fn(),
  setBackgroundMessageHandler: jest.fn(),
};

export function resetFirebaseMock() {
  state.configured = false;
  state.token = 'fcm-token-1';
  state.permission = AuthorizationStatus.AUTHORIZED;
  state.initialNotification = null;
  state.messageListeners.clear();
  state.openedListeners.clear();
  state.tokenListeners.clear();
  firebaseApp.getApps
    .mockReset()
    .mockImplementation(() =>
      state.configured ? [messagingInstance.app] : [],
    );
  firebaseMessaging.getMessaging.mockReset().mockImplementation(() => {
    if (!state.configured) {
      throw new Error("No Firebase App '[DEFAULT]' has been created");
    }
    return messagingInstance;
  });
  firebaseMessaging.requestPermission
    .mockReset()
    .mockImplementation(async () => state.permission);
  firebaseMessaging.getToken
    .mockReset()
    .mockImplementation(async () => state.token);
  firebaseMessaging.deleteToken.mockReset().mockResolvedValue(undefined);
  firebaseMessaging.onMessage
    .mockReset()
    .mockImplementation(listen(state.messageListeners));
  firebaseMessaging.onNotificationOpenedApp
    .mockReset()
    .mockImplementation(listen(state.openedListeners));
  firebaseMessaging.onTokenRefresh
    .mockReset()
    .mockImplementation(listen(state.tokenListeners));
  // 네이티브처럼 앱을 연 알림은 한 번만 준다
  firebaseMessaging.getInitialNotification
    .mockReset()
    .mockImplementation(async () => {
      const message = state.initialNotification;
      state.initialNotification = null;
      return message;
    });
  firebaseMessaging.setBackgroundMessageHandler.mockReset();
}

/**
 * 설정 파일이 들어간 빌드처럼 기본 앱을 만든다. permission 은 권한을 물었을 때의 답(iOS AuthorizationStatus),
 * initialNotification 은 종료된 앱을 연 알림이다
 */
export function enableFirebase({
  permission = AuthorizationStatus.AUTHORIZED,
  token = 'fcm-token-1',
  initialNotification = null,
}: {
  permission?: number;
  token?: string;
  initialNotification?: RemoteMessage | null;
} = {}) {
  state.configured = true;
  state.permission = permission;
  state.token = token;
  state.initialNotification = initialNotification;
}

/** FCM 이 주는 메시지. data 값은 모두 문자열이다 (백엔드 FcmPushSender) */
export function pushMessage(data: Record<string, string>): RemoteMessage {
  return {
    messageId: `message-${data.notificationId ?? 'none'}`,
    notification: {
      body: '10월 21일 09:00 [보일러 점검] 작업이 배정되었습니다.',
    },
    data,
    fcmOptions: {},
  };
}

/** 앱이 앞에 있을 때 받았다 */
export function receivePush(message: RemoteMessage) {
  state.messageListeners.forEach(listener => listener(message));
}

/** 백그라운드에 있던 앱을 알림을 눌러 열었다 */
export function openPush(message: RemoteMessage) {
  state.openedListeners.forEach(listener => listener(message));
}

/** FCM 이 토큰을 바꿨다 */
export function refreshPushToken(token: string) {
  state.token = token;
  state.tokenListeners.forEach(listener => listener(token));
}

/** 지금 붙어 있는 메시지 구독 수 (받기·열기·토큰 갱신) */
export function pushListenerCount() {
  return (
    state.messageListeners.size +
    state.openedListeners.size +
    state.tokenListeners.size
  );
}

export { AuthorizationStatus };
