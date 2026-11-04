import { transformSync } from '@babel/core';
import { DEV_API_BASE_URL, resolveApiBaseUrl } from './config';

// 테스트는 Node 에서 돈다 (@types/node 를 두지 않아 쓰는 것만 선언)
declare const process: {
  env: Record<string, string | undefined>;
  cwd(): string;
};

describe('resolveApiBaseUrl', () => {
  it('ORBIT_API_BASE_URL 이 있으면 그 값을 쓴다 (끝의 / 는 뗀다)', () => {
    expect(resolveApiBaseUrl('https://api.example.com/', false)).toBe(
      'https://api.example.com',
    );
    expect(resolveApiBaseUrl('http://192.168.0.10:8080', true)).toBe(
      'http://192.168.0.10:8080',
    );
  });

  it('값이 없으면 Debug 는 로컬 서버(http://localhost:8080)를 쓴다', () => {
    expect(DEV_API_BASE_URL).toBe('http://localhost:8080');
    expect(resolveApiBaseUrl(undefined, true)).toBe(DEV_API_BASE_URL);
    expect(resolveApiBaseUrl('  ', true)).toBe(DEV_API_BASE_URL);
  });

  it('Release 에 값이 없으면 주소가 없다 (요청이 설정 오류로 실패한다)', () => {
    expect(resolveApiBaseUrl(undefined, false)).toBeUndefined();
    expect(resolveApiBaseUrl('', false)).toBeUndefined();
  });

  it('Release 는 https 주소만 쓴다', () => {
    expect(resolveApiBaseUrl('http://api.example.com', false)).toBeUndefined();
  });
});

describe('빌드 때 넣는 환경 변수', () => {
  const transform = (code: string) =>
    transformSync(code, {
      configFile: `${process.cwd()}/babel.config.js`,
      filename: 'inline-env.js',
      babelrc: false,
    })?.code ?? '';

  // 이 테스트 파일도 같은 플러그인으로 변환되므로 process.env.ORBIT_API_BASE_URL 을 직접 쓰면 값으로 바뀐다
  const env = process.env;

  beforeEach(() => {
    env.ORBIT_API_BASE_URL = 'https://api.example.com';
    env.ORBIT_SECRET = 'secret';
  });

  afterEach(() => {
    delete env.ORBIT_API_BASE_URL;
    delete env.ORBIT_SECRET;
  });

  it('ORBIT_API_BASE_URL 만 번들에 값으로 넣고 다른 환경 변수는 넣지 않는다', () => {
    const code = transform(
      'export const a = process.env.ORBIT_API_BASE_URL; export const b = process.env.ORBIT_SECRET;',
    );

    expect(code).toContain('"https://api.example.com"');
    expect(code).not.toContain('"secret"');
    expect(code).toContain('process.env.ORBIT_SECRET');
  });
});
