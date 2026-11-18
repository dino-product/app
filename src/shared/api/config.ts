// API 서버 주소. 사용법: `ORBIT_API_BASE_URL=http://192.168.0.10:8080 npm start`
// 값은 빌드할 때 babel 이 번들에 넣는다 (babel.config.js, 이 이름 하나만. Metro 캐시는 값마다 따로: metro.config.js).
// 배포 호스트가 아직 정해지지 않아 빌드 설정으로 받는다.
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

// 웹(약관 전문 등 웹 버킷의 정적 파일) 주소는 빌드 값 DEVELOP_ONLY('true'/'false')로 개발·운영을 고른다 (#192).
// 사용법: `DEVELOP_ONLY=false npm start`. ORBIT_API_BASE_URL 과 같이 babel 이 번들에 넣고 Metro 캐시도 값마다 따로다.
// 값이 없으면 Debug 는 개발(true), Release 는 운영(false)이다. Release 에서 개발 웹을 쓰려면 그 빌드를 돌리는
// 셸·ios/.xcode.env.local(CI 는 빌드 단계 env)에 `export DEVELOP_ONLY=true` 를 넣는다

/** 운영 웹 주소. 개발은 호스트 앞에 dev. 를 붙인다 */
const WEB_HOST = 'orbi-t.com';

/** 'true'·'false'(앞뒤 공백·대소문자 무시)면 그 값, 없거나 그 밖의 값이면 Debug 는 true, Release 는 false */
export function resolveDevelopOnly(
  value: string | undefined,
  isDev: boolean,
): boolean {
  const flag = value?.trim().toLowerCase();
  if (flag === 'true') {
    return true;
  }
  if (flag === 'false') {
    return false;
  }
  return isDev;
}

/** develop_only 면 https://dev.orbi-t.com, 아니면 dev 와 그 뒤 점을 뺀 https://orbi-t.com */
export function resolveWebOrigin(developOnly: boolean): string {
  return `https://${developOnly ? 'dev.' : ''}${WEB_HOST}`;
}

// 앱 런타임에는 process 가 없다. babel 이 빌드 때 이 자리를 문자열(또는 undefined)로 바꾼다
declare const process: {
  env: { ORBIT_API_BASE_URL?: string; DEVELOP_ONLY?: string };
};

export const apiBaseUrl = resolveApiBaseUrl(
  process.env.ORBIT_API_BASE_URL,
  __DEV__,
);

export const developOnly = resolveDevelopOnly(
  process.env.DEVELOP_ONLY,
  __DEV__,
);

/** 이 빌드가 쓰는 웹 주소 (약관 전문 등) */
export const webOrigin = resolveWebOrigin(developOnly);
