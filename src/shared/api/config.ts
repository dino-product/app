// API 서버 주소. 사용법: `ORBIT_API_BASE_URL=http://192.168.0.10:8080 npm start -- --reset-cache`
// 값은 빌드할 때 babel 이 번들에 넣는다 (babel.config.js, 이 이름 하나만). 배포 호스트가 아직 정해지지 않아 빌드 설정으로 받는다.
// 실기기에서 localhost 는 기기 자신이라 맥의 서버에 닿지 않는다: iOS 는 맥의 IP 를 넣고, Android 는 `adb reverse tcp:8080 tcp:8080`.
// Release(Xcode·gradle 이 만드는 번들)는 그 빌드를 돌리는 셸·ios/.xcode.env.local 에 값을 export 한다

/** Debug 에서 값이 없을 때 붙는 로컬 서버 (백엔드 기본 포트) */
export const DEV_API_BASE_URL = 'http://localhost:8080';

/**
 * 빌드 값으로 주소를 정한다. Debug 는 값이 없으면 로컬 서버.
 * Release 는 https 만 쓰고, 값이 없거나 https 가 아니면 undefined → 요청이 설정 오류(kind 'config')로 실패한다
 */
export function resolveApiBaseUrl(
  value: string | undefined,
  isDev: boolean,
): string | undefined {
  const url = value?.trim().replace(/\/+$/, '');
  if (!url) {
    return isDev ? DEV_API_BASE_URL : undefined;
  }
  return isDev || url.startsWith('https://') ? url : undefined;
}

// 앱 런타임에는 process 가 없다. babel 이 빌드 때 이 자리를 문자열(또는 undefined)로 바꾼다
declare const process: { env: { ORBIT_API_BASE_URL?: string } };

export const apiBaseUrl = resolveApiBaseUrl(
  process.env.ORBIT_API_BASE_URL,
  __DEV__,
);
