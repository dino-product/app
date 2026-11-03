import { createMMKV } from 'react-native-mmkv';

// 앱이 기기에 남기는 값 (#34: 보던 화면, 작성 중인 입력). 백그라운드에서 앱이 종료돼도 다시 열 때 읽는다.
// MMKV 는 동기라 시작할 때 읽어도 첫 화면을 기다리게 하지 않고, 쓰기도 메모리 매핑 파일에 바로 반영된다.
// 테스트에서는 react-native-mmkv 가 메모리 목을 만들고 jest/setupAfterEnv.js 가 테스트마다 비운다
export const appStorage = createMMKV({ id: 'orbit' });

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 저장한 JSON 을 읽어 parse 로 모양을 확인한다. 없으면 undefined.
 * 깨졌거나 모양이 다르면(앱 업데이트 전 형식 등) 쓰지 않고 지운다
 */
export function readJson<T>(
  key: string,
  parse: (value: unknown) => T | undefined,
): T | undefined {
  const raw = appStorage.getString(key);
  if (raw === undefined) {
    return undefined;
  }
  let value: T | undefined;
  try {
    value = parse(JSON.parse(raw));
  } catch {
    value = undefined;
  }
  if (value === undefined) {
    appStorage.remove(key);
  }
  return value;
}

export function writeJson(key: string, value: unknown): void {
  appStorage.set(key, JSON.stringify(value));
}
