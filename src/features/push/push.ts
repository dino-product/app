import { getApps } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  deleteToken,
  getMessaging,
  getToken,
  requestPermission,
  setBackgroundMessageHandler,
  type Messaging,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { ApiError, ApiErrorMessage, type ApiClient } from '../../shared/api';
import { isRecord } from '../../shared/isRecord';
import { appStorage } from '../../shared/storage/appStorage';

// 앱 푸시 (#118, 백엔드 §2.5 N6·N7). 사용법:
//   const messaging = defaultMessaging()           Firebase 설정 파일이 없는 빌드면 null → 푸시를 쓰지 않는다
//   await registerPushDevice(api, messaging)       가입을 마친 뒤(메인): 권한 → FCM 토큰 → 서버 등록 → pushDeviceId 저장
//   await unregisterPushDevice(api, accessToken)   로그아웃 서버 요청 직전: 저장한 id 로 해제하고 지운다
// FCM 토큰 값은 서버에만 보내고 저장·로그에 남기지 않는다. 기기에는 해제에 쓸 pushDeviceId 와 등록한 계정(accountId)만 MMKV 에 둔다

export const PUSH_DEVICES_PATH = '/api/v1/push-devices';
const DEVICE_ID_KEY = 'push.deviceId';
/** 이 기기를 등록한 계정. 로그인 전에 누른 푸시를 다른 계정으로 로그인한 뒤 열지 않게 본다 */
const DEVICE_OWNER_KEY = 'push.deviceAccountId';
/** Android 13+ 알림 권한을 한 번 물었다. 거부했으면 다시 묻지 않는다 */
const PERMISSION_ASKED_KEY = 'push.permissionAsked';
/** POST_NOTIFICATIONS 런타임 권한이 생긴 Android 13 (API 33) */
const ANDROID_RUNTIME_PERMISSION_API = 33;

const ignore = () => undefined;

// 해제(로그아웃 시작)마다 올린다. 그 전에 보낸 등록의 응답은 기기에 남기지 않는다
let generation = 0;

/**
 * 기본 Firebase 앱의 messaging. 설정 파일(GoogleService-Info.plist·google-services.json)이 없는 빌드는
 * 네이티브가 기본 앱을 만들지 않아 null 이다. 그때는 푸시만 끄고 앱은 그대로 쓴다
 */
export function defaultMessaging(): Messaging | null {
  try {
    return getApps().length > 0 ? getMessaging() : null;
  } catch {
    return null;
  }
}

/**
 * 알림을 보여 줄 권한이 있는지. 없으면 묻는다.
 * iOS 는 정해지지 않았을 때만 시스템이 묻고(이미 정했으면 그 값), Android 13+ 는 처음 한 번만 묻는다
 */
export async function hasPushPermission(
  messaging: Messaging,
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    const status = await requestPermission(messaging);
    return (
      status === AuthorizationStatus.AUTHORIZED ||
      status === AuthorizationStatus.PROVISIONAL
    );
  }
  if (Number(Platform.Version) < ANDROID_RUNTIME_PERMISSION_API) {
    return true;
  }
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) {
    return true;
  }
  if (appStorage.getBoolean(PERMISSION_ASKED_KEY)) {
    return false;
  }
  appStorage.set(PERMISSION_ASKED_KEY, true);
  return (
    (await PermissionsAndroid.request(permission)) ===
    PermissionsAndroid.RESULTS.GRANTED
  );
}

/** 해제에 쓸 pushDeviceId. 등록하지 않았으면 undefined */
export function readPushDeviceId(): number | undefined {
  return appStorage.getNumber(DEVICE_ID_KEY);
}

/** 이 기기를 등록한 계정(accountId). 등록하지 않았으면 undefined */
export function readPushDeviceOwner(): number | undefined {
  return appStorage.getNumber(DEVICE_OWNER_KEY);
}

// N6. 같은 토큰은 서버가 같은 id 를 준다. 그사이 메인을 떠났거나(isCurrent) 해제가 시작됐으면(로그아웃) id 를 남기지 않는다
async function registerToken(
  api: ApiClient,
  token: string,
  isCurrent: () => boolean,
): Promise<boolean> {
  const started = generation;
  // 로그아웃 상태면 보내지 않는다 (서버가 COMMON-401 로 답한다)
  const session = await api.session.getSession().catch(() => null);
  if (session === null) {
    return false;
  }
  const result = await api.post(PUSH_DEVICES_PATH, {
    platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    token,
  });
  if (!isRecord(result) || typeof result.pushDeviceId !== 'number') {
    throw new ApiError({
      kind: 'http',
      status: 200,
      message: ApiErrorMessage.invalidResponse,
    });
  }
  if (!isCurrent() || generation !== started) {
    return false;
  }
  appStorage.set(DEVICE_ID_KEY, result.pushDeviceId);
  appStorage.set(DEVICE_OWNER_KEY, session.accountId);
  return true;
}

/**
 * 가입을 마친 계정(메인)에서 부른다. 권한이 있으면 FCM 토큰을 등록하고 true. 권한이 없거나 그사이 그만뒀으면 false.
 * 서버 등록이 실패하면 던진다 (다음에 메인에 들어올 때 다시 한다)
 */
export async function registerPushDevice(
  api: ApiClient,
  messaging: Messaging,
  isCurrent: () => boolean = () => true,
): Promise<boolean> {
  if (!(await hasPushPermission(messaging)) || !isCurrent()) {
    return false;
  }
  const token = await getToken(messaging);
  if (!isCurrent()) {
    return false;
  }
  return registerToken(api, token, isCurrent);
}

/** FCM 이 토큰을 바꿨다. 메인에 있고 등록해 둔 기기(권한이 있었다)면 바뀐 토큰으로 다시 등록한다 */
export async function refreshPushDevice(
  api: ApiClient,
  token: string,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  if (isCurrent() && readPushDeviceId() !== undefined) {
    await registerToken(api, token, isCurrent);
  }
}

/**
 * 기기 쪽만 정리한다: 세대를 올려(그 전에 보낸 등록의 응답은 남기지 않는다) id·계정을 지우고 FCM 토큰도 지운다.
 * 탈퇴는 서버가 이 계정의 기기를 지우므로 이것만 부른다. 서버에 보내지 않고 던지지 않는다
 */
export function forgetPushDevice(): void {
  generation += 1;
  appStorage.remove(DEVICE_ID_KEY);
  appStorage.remove(DEVICE_OWNER_KEY);
  // FCM 토큰을 지워 서버에 기기가 남았어도 이 기기로 앞 계정의 푸시가 오지 않게 한다 (다음 로그인 때 새 토큰으로 등록)
  const messaging = defaultMessaging();
  if (messaging !== null) {
    deleteToken(messaging).catch(ignore);
  }
}

/**
 * 로그아웃 서버 요청 직전에 부른다 (로그아웃 뒤엔 access token 이 무효). 기기 쪽을 정리하고(forgetPushDevice),
 * 저장해 둔 id 를 떼어 둔 access token 으로 해제(N7)한다. 실패해도 던지지 않는다(로그아웃은 계속한다)
 */
export async function unregisterPushDevice(
  api: ApiClient,
  accessToken: string,
): Promise<void> {
  const pushDeviceId = readPushDeviceId();
  forgetPushDevice();
  if (pushDeviceId !== undefined) {
    await api
      .detachedRequest(
        'DELETE',
        `${PUSH_DEVICES_PATH}/${pushDeviceId}`,
        accessToken,
      )
      .catch(ignore);
  }
}

/**
 * index.js 에서 앱을 그리기 전에 부른다. Android 는 백그라운드에서 받은 푸시마다 JS 를 깨우는데 처리기가 없으면 경고를 남긴다.
 * 할 일은 없다: 알림은 시스템이 띄우고, 알림센터·작업은 앱으로 돌아올 때 다시 받는다(React Query 포커스)
 */
export function setUpBackgroundPush() {
  const messaging = defaultMessaging();
  if (messaging !== null) {
    setBackgroundMessageHandler(messaging, async () => undefined);
  }
}
