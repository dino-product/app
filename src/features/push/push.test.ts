import { waitFor } from '@testing-library/react-native';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  AuthorizationStatus,
  enableFirebase,
  firebaseMessaging,
} from '../../../jest/firebase';
import { ApiErrorMessage } from '../../shared/api';
import { appStorage } from '../../shared/storage/appStorage';
import {
  createFakeServer,
  fail,
  networkError,
  noContent,
  ok,
  type FakeResponse,
} from '../../shared/testing/fakeServer';
import { createTestApi } from '../../shared/testing/renderWithApi';
import { testSession } from '../../shared/testing/session';
import {
  defaultMessaging,
  forgetPushDevice,
  hasPushPermission,
  markPushRead,
  PUSH_DEVICES_PATH,
  readPushDeviceId,
  readPushDeviceOwner,
  refreshPushDevice,
  registerPushDevice,
  setUpBackgroundPush,
  unregisterPushDevice,
} from './push';

const DEVICE_PATH = `${PUSH_DEVICES_PATH}/7`;

const apiWith = (server = createFakeServer()) =>
  createTestApi({ server, session: testSession() }).client;

// 기기에 남은 값은 pushDeviceId 하나뿐이고 FCM 토큰 값은 어디에도 남지 않는다
const storedValues = () =>
  appStorage
    .getAllKeys()
    .map(
      key => `${key}=${appStorage.getString(key) ?? appStorage.getNumber(key)}`,
    );

// Platform.Version 은 getter 라 replaceProperty 대신 spy 로 바꾼다
const androidVersion = (api: number) =>
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(api);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('defaultMessaging', () => {
  it('Firebase 설정 파일이 없는 빌드(기본 앱 없음)는 null → 푸시를 쓰지 않는다', () => {
    expect(defaultMessaging()).toBeNull();
    expect(firebaseMessaging.getMessaging).not.toHaveBeenCalled();
  });

  it('기본 앱이 있으면 messaging 을 준다', () => {
    enableFirebase();

    expect(defaultMessaging()).not.toBeNull();
  });

  it('네이티브 초기화가 던지면 null (앱은 죽지 않는다)', () => {
    enableFirebase();
    firebaseMessaging.getMessaging.mockImplementationOnce(() => {
      throw new Error('native module missing');
    });

    expect(defaultMessaging()).toBeNull();
  });
});

describe('hasPushPermission', () => {
  const messaging = () => {
    enableFirebase();
    return defaultMessaging()!;
  };

  it.each([
    [AuthorizationStatus.AUTHORIZED, true],
    [AuthorizationStatus.PROVISIONAL, true],
    [AuthorizationStatus.DENIED, false],
    [AuthorizationStatus.NOT_DETERMINED, false],
  ])(
    'iOS 는 시스템에 묻는다(정해졌으면 묻지 않고 그 값). 상태 %s → %s',
    async (status, expected) => {
      const instance = messaging();
      firebaseMessaging.requestPermission.mockResolvedValueOnce(status);

      await expect(hasPushPermission(instance)).resolves.toBe(expected);
      expect(firebaseMessaging.requestPermission).toHaveBeenCalledTimes(1);
    },
  );

  describe('Android', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'android');
    });

    it('13 미만은 런타임 권한이 없어 묻지 않고 허용', async () => {
      androidVersion(32);
      const request = jest.spyOn(PermissionsAndroid, 'request');

      await expect(hasPushPermission(messaging())).resolves.toBe(true);
      expect(request).not.toHaveBeenCalled();
    });

    it('13 이상은 이미 허용했으면 묻지 않는다', async () => {
      androidVersion(33);
      jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
      const request = jest.spyOn(PermissionsAndroid, 'request');

      await expect(hasPushPermission(messaging())).resolves.toBe(true);
      expect(request).not.toHaveBeenCalled();
    });

    it('13 이상은 POST_NOTIFICATIONS 를 처음 한 번만 묻고, 거부하면 다음부터 묻지 않는다', async () => {
      androidVersion(34);
      jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
      const request = jest
        .spyOn(PermissionsAndroid, 'request')
        .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

      await expect(hasPushPermission(messaging())).resolves.toBe(false);
      await expect(hasPushPermission(messaging())).resolves.toBe(false);

      expect(request).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledWith(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
    });

    it('13 이상에서 허용하면 true', async () => {
      androidVersion(33);
      jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
      jest
        .spyOn(PermissionsAndroid, 'request')
        .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

      await expect(hasPushPermission(messaging())).resolves.toBe(true);
    });

    it('거부한 뒤 설정에서 켰으면 묻지 않고 허용', async () => {
      androidVersion(33);
      const check = jest
        .spyOn(PermissionsAndroid, 'check')
        .mockResolvedValue(false);
      jest
        .spyOn(PermissionsAndroid, 'request')
        .mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);
      await hasPushPermission(messaging());

      check.mockResolvedValue(true);
      await expect(hasPushPermission(messaging())).resolves.toBe(true);
    });
  });
});

describe('registerPushDevice', () => {
  it('권한이 있으면 FCM 토큰을 등록(N6)하고 pushDeviceId 와 그 계정만 남긴다', async () => {
    enableFirebase({ token: 'fcm-token-secret' });
    const server = createFakeServer().on(
      'POST',
      PUSH_DEVICES_PATH,
      ok({ pushDeviceId: 7 }),
    );

    await expect(
      registerPushDevice(apiWith(server), defaultMessaging()!),
    ).resolves.toBe(true);

    expect(server.callsTo('POST', PUSH_DEVICES_PATH)).toEqual([
      expect.objectContaining({
        body: { platform: 'IOS', token: 'fcm-token-secret' },
        headers: expect.objectContaining({ Authorization: 'Bearer access-1' }),
      }),
    ]);
    expect(readPushDeviceId()).toBe(7);
    // 어느 계정의 기기인지 (로그인 전에 누른 푸시를 다른 계정으로 열지 않게)
    expect(readPushDeviceOwner()).toBe(1);
    expect(storedValues().sort()).toEqual([
      'push.deviceAccountId=1',
      'push.deviceId=7',
    ]);
    expect(JSON.stringify(storedValues())).not.toContain('fcm-token-secret');
  });

  it('Android 는 platform ANDROID 로 등록한다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    androidVersion(32);
    enableFirebase();
    const server = createFakeServer().on(
      'POST',
      PUSH_DEVICES_PATH,
      ok({ pushDeviceId: 8 }),
    );

    await registerPushDevice(apiWith(server), defaultMessaging()!);

    expect(server.callsTo('POST', PUSH_DEVICES_PATH)[0].body).toEqual({
      platform: 'ANDROID',
      token: 'fcm-token-1',
    });
  });

  it('권한이 없으면 토큰을 받지도 등록하지도 않는다', async () => {
    enableFirebase({ permission: AuthorizationStatus.DENIED });
    const server = createFakeServer();

    await expect(
      registerPushDevice(apiWith(server), defaultMessaging()!),
    ).resolves.toBe(false);

    expect(firebaseMessaging.getToken).not.toHaveBeenCalled();
    expect(server.calls).toHaveLength(0);
    expect(readPushDeviceId()).toBeUndefined();
  });

  it('기다리는 동안 그만뒀으면(로그아웃) 등록하지 않는다', async () => {
    enableFirebase();
    const server = createFakeServer();
    let current = true;
    firebaseMessaging.getToken.mockImplementationOnce(async () => {
      current = false;
      return 'fcm-token-1';
    });

    await expect(
      registerPushDevice(apiWith(server), defaultMessaging()!, () => current),
    ).resolves.toBe(false);
    expect(server.calls).toHaveLength(0);
  });

  it('등록 응답을 받는 사이 그만뒀으면 id 를 남기지 않는다', async () => {
    enableFirebase();
    let current = true;
    const server = createFakeServer().on('POST', PUSH_DEVICES_PATH, () => {
      current = false;
      return ok({ pushDeviceId: 7 });
    });

    await expect(
      registerPushDevice(apiWith(server), defaultMessaging()!, () => current),
    ).resolves.toBe(false);
    expect(readPushDeviceId()).toBeUndefined();
  });

  it('세션이 없으면(로그아웃 상태) 보내지 않는다', async () => {
    enableFirebase();
    const server = createFakeServer();
    const api = createTestApi({ server, session: null }).client;

    await expect(registerPushDevice(api, defaultMessaging()!)).resolves.toBe(
      false,
    );
    expect(server.calls).toHaveLength(0);
    expect(readPushDeviceId()).toBeUndefined();
  });

  it('등록 응답을 기다리는 사이 해제(로그아웃 시작)되면 id 를 남기지 않는다', async () => {
    enableFirebase();
    let answer: (response: FakeResponse) => void = () => {};
    const server = createFakeServer().on(
      'POST',
      PUSH_DEVICES_PATH,
      () =>
        new Promise<FakeResponse>(resolve => {
          answer = resolve;
        }),
    );
    const api = apiWith(server);

    const registering = registerPushDevice(api, defaultMessaging()!);
    await waitFor(() =>
      expect(server.callsTo('POST', PUSH_DEVICES_PATH)).toHaveLength(1),
    );
    await unregisterPushDevice(api, 'detached-access');
    answer(ok({ pushDeviceId: 7 }));

    await expect(registering).resolves.toBe(false);
    expect(readPushDeviceId()).toBeUndefined();
    expect(readPushDeviceOwner()).toBeUndefined();
  });

  it.each([
    ['가입 전(PROFILE-005)', fail(403, 'PROFILE-005')],
    ['네트워크 오류', networkError()],
  ])(
    '서버 등록이 실패하면(%s) 던지고 id 를 남기지 않는다',
    async (_, response) => {
      enableFirebase();
      const server = createFakeServer().on('POST', PUSH_DEVICES_PATH, response);

      await expect(
        registerPushDevice(apiWith(server), defaultMessaging()!),
      ).rejects.toBeDefined();
      expect(readPushDeviceId()).toBeUndefined();
    },
  );

  it('응답에 pushDeviceId 가 없으면 서버 응답 오류로 던진다', async () => {
    enableFirebase();
    const server = createFakeServer().on(
      'POST',
      PUSH_DEVICES_PATH,
      ok({ id: 7 }),
    );

    await expect(
      registerPushDevice(apiWith(server), defaultMessaging()!),
    ).rejects.toMatchObject({ message: ApiErrorMessage.invalidResponse });
  });
});

describe('refreshPushDevice', () => {
  it('등록해 둔 기기면 바뀐 토큰으로 다시 등록하고 새 id 를 남긴다', async () => {
    appStorage.set('push.deviceId', 7);
    const server = createFakeServer().on(
      'POST',
      PUSH_DEVICES_PATH,
      ok({ pushDeviceId: 9 }),
    );

    await refreshPushDevice(apiWith(server), 'fcm-token-2');

    expect(server.callsTo('POST', PUSH_DEVICES_PATH)[0].body).toEqual({
      platform: 'IOS',
      token: 'fcm-token-2',
    });
    expect(readPushDeviceId()).toBe(9);
  });

  it('메인 밖이면(isCurrent false) 다시 등록하지 않는다', async () => {
    appStorage.set('push.deviceId', 7);
    const server = createFakeServer();

    await refreshPushDevice(apiWith(server), 'fcm-token-2', () => false);

    expect(server.calls).toHaveLength(0);
  });

  it('등록하지 않은 기기(권한 없음)면 다시 등록하지 않는다', async () => {
    const server = createFakeServer();

    await refreshPushDevice(apiWith(server), 'fcm-token-2');

    expect(server.calls).toHaveLength(0);
  });
});

describe('unregisterPushDevice', () => {
  it('저장한 id 를 떼어 둔 access token 으로 해제(N7)하고 id 와 FCM 토큰을 지운다', async () => {
    enableFirebase();
    appStorage.set('push.deviceId', 7);
    appStorage.set('push.deviceAccountId', 1);
    const server = createFakeServer().on('DELETE', DEVICE_PATH, noContent());
    const api = createTestApi({ server, session: null }).client;

    await unregisterPushDevice(api, 'detached-access');
    expect(readPushDeviceOwner()).toBeUndefined();

    expect(server.callsTo('DELETE', DEVICE_PATH)).toEqual([
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer detached-access',
        }),
      }),
    ]);
    expect(readPushDeviceId()).toBeUndefined();
    expect(firebaseMessaging.deleteToken).toHaveBeenCalledTimes(1);
  });

  it('해제가 실패해도 던지지 않고 id 를 지운다', async () => {
    enableFirebase();
    appStorage.set('push.deviceId', 7);
    const server = createFakeServer().on(
      'DELETE',
      DEVICE_PATH,
      fail(404, 'NOTIFICATION-005'),
    );

    await expect(
      unregisterPushDevice(apiWith(server), 'detached-access'),
    ).resolves.toBeUndefined();
    expect(readPushDeviceId()).toBeUndefined();
    // 서버에 남았어도 이 기기로 앞 계정의 푸시가 오지 않게 FCM 토큰을 지운다
    expect(firebaseMessaging.deleteToken).toHaveBeenCalledTimes(1);
  });

  it('등록하지 않았으면 서버에 보내지 않는다', async () => {
    const server = createFakeServer();

    await unregisterPushDevice(apiWith(server), 'detached-access');

    expect(server.calls).toHaveLength(0);
  });

  it('FCM 토큰 삭제가 실패해도 던지지 않는다', async () => {
    enableFirebase();
    firebaseMessaging.deleteToken.mockRejectedValueOnce(new Error('offline'));

    await expect(
      unregisterPushDevice(apiWith(), 'detached-access'),
    ).resolves.toBeUndefined();
  });
});

// 탈퇴는 서버가 기기를 지운다. 기기 쪽(id·계정·FCM 토큰)만 정리한다
describe('forgetPushDevice', () => {
  it('서버에 보내지 않고 기기의 id·계정과 FCM 토큰을 지운다', async () => {
    enableFirebase();
    appStorage.set('push.deviceId', 7);
    appStorage.set('push.deviceAccountId', 1);

    forgetPushDevice();

    expect(readPushDeviceId()).toBeUndefined();
    expect(readPushDeviceOwner()).toBeUndefined();
    expect(firebaseMessaging.deleteToken).toHaveBeenCalledTimes(1);
  });

  it('지우기 전에 보낸 등록의 응답은 남기지 않는다', async () => {
    enableFirebase();
    let answer: (response: FakeResponse) => void = () => {};
    const server = createFakeServer().on(
      'POST',
      PUSH_DEVICES_PATH,
      () =>
        new Promise<FakeResponse>(resolve => {
          answer = resolve;
        }),
    );

    const registering = registerPushDevice(
      apiWith(server),
      defaultMessaging()!,
    );
    await waitFor(() =>
      expect(server.callsTo('POST', PUSH_DEVICES_PATH)).toHaveLength(1),
    );
    forgetPushDevice();
    answer(ok({ pushDeviceId: 7 }));

    await expect(registering).resolves.toBe(false);
    expect(readPushDeviceId()).toBeUndefined();
  });

  it('Firebase 설정 파일이 없어도 던지지 않는다', () => {
    appStorage.set('push.deviceId', 7);

    expect(() => forgetPushDevice()).not.toThrow();
    expect(readPushDeviceId()).toBeUndefined();
    expect(firebaseMessaging.deleteToken).not.toHaveBeenCalled();
  });
});

describe('markPushRead', () => {
  it('알림을 읽음 처리한다 (N3)', async () => {
    const server = createFakeServer().on(
      'PUT',
      '/api/v1/notifications/31/read',
      noContent(),
    );

    await markPushRead(apiWith(server), '31');

    expect(server.callsTo('PUT', '/api/v1/notifications/31/read')).toHaveLength(
      1,
    );
  });

  it.each([
    ['id 없음', undefined],
    ['숫자가 아닌 id', '../31'],
  ])('%s 이면 보내지 않는다', async (_, id) => {
    const server = createFakeServer();

    await markPushRead(apiWith(server), id);

    expect(server.calls).toHaveLength(0);
  });

  it('실패해도 던지지 않는다 (다른 계정의 알림 등)', async () => {
    const server = createFakeServer().on(
      'PUT',
      '/api/v1/notifications/31/read',
      fail(403, 'NOTIFICATION-003'),
    );

    await expect(markPushRead(apiWith(server), '31')).resolves.toBeUndefined();
  });
});

describe('setUpBackgroundPush', () => {
  it('설정 파일이 없으면 아무것도 하지 않는다', () => {
    setUpBackgroundPush();

    expect(
      firebaseMessaging.setBackgroundMessageHandler,
    ).not.toHaveBeenCalled();
  });

  it('백그라운드 메시지 처리기를 둔다 (할 일은 없다: 알림은 시스템이 띄우고 목록은 앱으로 돌아올 때 다시 받는다)', async () => {
    enableFirebase();

    setUpBackgroundPush();

    const handler = firebaseMessaging.setBackgroundMessageHandler.mock
      .calls[0][1] as () => Promise<unknown>;
    await expect(handler()).resolves.toBeUndefined();
  });
});
