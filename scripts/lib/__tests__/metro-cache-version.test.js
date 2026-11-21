// #110: babel 이 번들에 넣는 ORBIT_API_BASE_URL(babel.config.js)은 Metro 변환 캐시 키에 들어가지 않는다.
// 값마다 캐시를 따로 쓰게 하지 않으면 주소를 바꿔 만든 Release 번들이 캐시에 남은 옛 주소를 쓴다.
// #192: 웹 주소를 고르는 DEVELOP_ONLY 도 같다.
// Metro 처럼 Node 로 metro.config.js 를 직접 읽는다 (jest 로 불러오면 babel 이 이 파일의 process.env 도 값으로 바꾼다)
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');

/** 빌드 값을 이것만 둔 채(나머지는 지운 채) metro.config.js 의 cacheVersion 을 읽는다 */
function cacheVersionWith(values) {
  const env = { ...process.env };
  delete env.ORBIT_API_BASE_URL;
  delete env.DEVELOP_ONLY;
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return execFileSync(
    process.execPath,
    ['-e', "process.stdout.write(require('./metro.config.js').cacheVersion)"],
    { cwd: ROOT, env, encoding: 'utf8' },
  );
}

const withBaseUrl = baseUrl =>
  cacheVersionWith({ ORBIT_API_BASE_URL: baseUrl });

describe('Metro 변환 캐시 키', () => {
  it('ORBIT_API_BASE_URL 값마다 캐시 키가 다르다', () => {
    const versions = [
      withBaseUrl('https://a.example.test'),
      withBaseUrl('https://b.example.test'),
      withBaseUrl(undefined),
    ];

    expect(new Set(versions).size).toBe(3);
    expect(versions[0]).toContain('https://a.example.test');
  });

  it('DEVELOP_ONLY 값마다 캐시 키가 다르다 (#192)', () => {
    const versions = [
      cacheVersionWith({ DEVELOP_ONLY: 'true' }),
      cacheVersionWith({ DEVELOP_ONLY: 'false' }),
      cacheVersionWith({}),
    ];

    expect(new Set(versions).size).toBe(3);
  });

  it('같은 값이면 캐시 키도 같다 (다시 띄워도 캐시를 그대로 쓴다)', () => {
    const values = {
      ORBIT_API_BASE_URL: 'https://a.example.test',
      DEVELOP_ONLY: 'false',
    };
    expect(cacheVersionWith(values)).toBe(cacheVersionWith(values));
  });
});
