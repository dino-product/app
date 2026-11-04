// #110: babel 이 번들에 넣는 ORBIT_API_BASE_URL(babel.config.js)은 Metro 변환 캐시 키에 들어가지 않는다.
// 값마다 캐시를 따로 쓰게 하지 않으면 주소를 바꿔 만든 Release 번들이 캐시에 남은 옛 주소를 쓴다.
// Metro 처럼 Node 로 metro.config.js 를 직접 읽는다 (jest 로 불러오면 babel 이 이 파일의 process.env 도 값으로 바꾼다)
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');

function cacheVersionWith(baseUrl) {
  const env = { ...process.env };
  delete env.ORBIT_API_BASE_URL;
  if (baseUrl !== undefined) {
    env.ORBIT_API_BASE_URL = baseUrl;
  }
  return execFileSync(
    process.execPath,
    ['-e', "process.stdout.write(require('./metro.config.js').cacheVersion)"],
    { cwd: ROOT, env, encoding: 'utf8' },
  );
}

describe('Metro 변환 캐시 키', () => {
  it('ORBIT_API_BASE_URL 값마다 캐시 키가 다르다', () => {
    const versions = [
      cacheVersionWith('https://a.example.test'),
      cacheVersionWith('https://b.example.test'),
      cacheVersionWith(undefined),
    ];

    expect(new Set(versions).size).toBe(3);
    expect(versions[0]).toContain('https://a.example.test');
  });

  it('같은 값이면 캐시 키도 같다 (다시 띄워도 캐시를 그대로 쓴다)', () => {
    expect(cacheVersionWith('https://a.example.test')).toBe(
      cacheVersionWith('https://a.example.test'),
    );
  });
});
