import * as Keychain from 'react-native-keychain';
import { appStorage, isRecord } from '../storage/appStorage';
import type { Session } from './session';

// 로그인 세션을 iOS Keychain·Android Keystore(react-native-keychain)에 둔다. 사용법: createApiClient({ tokenStore: createKeychainTokenStore() })
// 토큰은 MMKV 에 두지 않는다 (MMKV 는 암호화하지 않은 파일). MMKV 에는 이번 설치에서 Keychain 을 정리했다는 표식만 둔다:
// iOS Keychain 은 앱을 지워도 남아, 다시 설치한 첫 실행이 지난 설치의 세션으로 로그인하지 않게 처음 한 번 지운다

export type TokenStore = {
  /** 저장한 세션. 없거나 깨졌으면 null */
  read(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
};

export const KEYCHAIN_SERVICE = 'com.dinoproduct.app.session';
/** 이번 설치에서 지난 설치의 Keychain 세션을 지웠다 (MMKV) */
export const KEYCHAIN_READY_KEY = 'api.keychainReady';

const USERNAME = 'session';
const SAVE_OPTIONS: Keychain.SetOptions = {
  service: KEYCHAIN_SERVICE,
  // 기기 백업·다른 기기로 옮겨지지 않고, 재부팅 뒤 처음 잠금을 푼 다음부터 백그라운드에서도 읽는다
  accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  // 생체 인증 없이 Keystore AES-GCM 키로 암호화한다 (Android)
  storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
};
const SERVICE_OPTIONS = { service: KEYCHAIN_SERVICE };

function parseSession(value: unknown): Session | null {
  if (
    !isRecord(value) ||
    typeof value.accountId !== 'number' ||
    typeof value.accessToken !== 'string' ||
    typeof value.accessTokenExpiresAt !== 'string' ||
    typeof value.refreshToken !== 'string' ||
    typeof value.refreshTokenExpiresAt !== 'string'
  ) {
    return null;
  }
  return {
    accountId: value.accountId,
    accessToken: value.accessToken,
    accessTokenExpiresAt: value.accessTokenExpiresAt,
    refreshToken: value.refreshToken,
    refreshTokenExpiresAt: value.refreshTokenExpiresAt,
  };
}

export function createKeychainTokenStore(): TokenStore {
  let ready: Promise<void> | undefined;

  // 읽거나 쓰기 전에 한 번. 지우지 못했으면 표식을 남기지 않아 다음에 다시 지운다
  function prepare(): Promise<void> {
    ready ??= (async () => {
      if (appStorage.getBoolean(KEYCHAIN_READY_KEY)) {
        return;
      }
      await Keychain.resetGenericPassword(SERVICE_OPTIONS);
      appStorage.set(KEYCHAIN_READY_KEY, true);
    })().catch(error => {
      ready = undefined;
      throw error;
    });
    return ready;
  }

  const clear = async () => {
    await Keychain.resetGenericPassword(SERVICE_OPTIONS);
  };

  return {
    async read() {
      await prepare();
      const credentials = await Keychain.getGenericPassword(SERVICE_OPTIONS);
      if (!credentials) {
        return null;
      }
      let session: Session | null;
      try {
        session = parseSession(JSON.parse(credentials.password));
      } catch {
        session = null;
      }
      // 깨졌거나 모양이 다르면(앱 업데이트 전 형식 등) 쓰지 않고 지운다
      if (session === null) {
        await clear();
      }
      return session;
    },
    async save(session) {
      await prepare();
      await Keychain.setGenericPassword(
        USERNAME,
        JSON.stringify(session),
        SAVE_OPTIONS,
      );
    },
    async clear() {
      await prepare();
      await clear();
    },
  };
}
