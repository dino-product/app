import * as Keychain from 'react-native-keychain';
import { appStorage } from '../storage/appStorage';
import { testSession } from '../testing/session';
import {
  createKeychainTokenStore,
  KEYCHAIN_READY_KEY,
  KEYCHAIN_SERVICE,
} from './tokenStore';

const session = testSession(
  { accessToken: 'access-secret', refreshToken: 'refresh-secret' },
  Date.parse('2026-11-04T01:00:00Z'),
);

// 지난 설치가 남긴 Keychain 항목 (앱을 지워도 iOS Keychain 은 남는다)
const leftover = () =>
  Keychain.setGenericPassword('session', JSON.stringify(session), {
    service: KEYCHAIN_SERVICE,
  });

// 이번 설치에서 이미 한 번 실행했다
const launchedBefore = () => appStorage.set(KEYCHAIN_READY_KEY, true);

describe('Keychain 토큰 저장소', () => {
  it('세션(accountId·토큰·만료 시각)을 저장하고 그대로 읽는다', async () => {
    const store = createKeychainTokenStore();

    await store.save(session);

    await expect(store.read()).resolves.toEqual(session);
    await expect(createKeychainTokenStore().read()).resolves.toEqual(session);
  });

  it('이 기기에서만, 처음 잠금 해제 뒤 읽게(iOS) AES-GCM 으로(Android) 저장한다', async () => {
    const set = jest.spyOn(Keychain, 'setGenericPassword');

    await createKeychainTokenStore().save(session);

    expect(set).toHaveBeenCalledWith('session', expect.any(String), {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
    });
    set.mockRestore();
  });

  it('지우면 세션이 없다', async () => {
    const store = createKeychainTokenStore();
    await store.save(session);

    await store.clear();

    await expect(store.read()).resolves.toBeNull();
    await expect(
      Keychain.hasGenericPassword({ service: KEYCHAIN_SERVICE }),
    ).resolves.toBe(false);
  });

  it('저장한 적이 없으면 null 이다', async () => {
    launchedBefore();

    await expect(createKeychainTokenStore().read()).resolves.toBeNull();
  });

  it('앱을 처음 실행하면(MMKV 표식 없음) 지난 설치가 남긴 Keychain 세션을 지운다', async () => {
    await leftover();

    await expect(createKeychainTokenStore().read()).resolves.toBeNull();

    await expect(
      Keychain.hasGenericPassword({ service: KEYCHAIN_SERVICE }),
    ).resolves.toBe(false);
    expect(appStorage.getBoolean(KEYCHAIN_READY_KEY)).toBe(true);
  });

  it('처음 실행에 로그인해도 지난 세션을 먼저 지우고 새 세션을 남긴다', async () => {
    await leftover();
    const fresh = testSession({ accountId: 2, accessToken: 'access-new' });

    await createKeychainTokenStore().save(fresh);

    await expect(createKeychainTokenStore().read()).resolves.toEqual(fresh);
  });

  it('이번 설치에서 다시 실행하면 저장한 세션을 읽는다', async () => {
    launchedBefore();
    await leftover();

    await expect(createKeychainTokenStore().read()).resolves.toEqual(session);
  });

  it('Keychain 을 지우지 못하면 표식을 남기지 않고 다음에 다시 지운다', async () => {
    await leftover();
    const reset = jest
      .spyOn(Keychain, 'resetGenericPassword')
      .mockRejectedValueOnce(new Error('locked'));
    const store = createKeychainTokenStore();

    await expect(store.read()).rejects.toThrow('locked');
    expect(appStorage.contains(KEYCHAIN_READY_KEY)).toBe(false);

    await expect(store.read()).resolves.toBeNull();
    expect(appStorage.getBoolean(KEYCHAIN_READY_KEY)).toBe(true);
    reset.mockRestore();
  });

  it.each([
    ['JSON 이 아닌 값', '{깨진'],
    ['모양이 다른 값', JSON.stringify({ accountId: '1' })],
  ])('%s 은 버리고 지운다', async (_name, value) => {
    launchedBefore();
    await Keychain.setGenericPassword('session', value, {
      service: KEYCHAIN_SERVICE,
    });

    await expect(createKeychainTokenStore().read()).resolves.toBeNull();
    await expect(
      Keychain.hasGenericPassword({ service: KEYCHAIN_SERVICE }),
    ).resolves.toBe(false);
  });

  it('토큰 값을 MMKV 에 남기지 않는다', async () => {
    const store = createKeychainTokenStore();
    await store.save(session);
    await store.read();

    const values = appStorage
      .getAllKeys()
      .map(key => [
        appStorage.getString(key),
        appStorage.getNumber(key),
        appStorage.getBoolean(key),
      ]);
    const dumped = JSON.stringify(values);
    expect(dumped).not.toContain('access-secret');
    expect(dumped).not.toContain('refresh-secret');
  });
});
