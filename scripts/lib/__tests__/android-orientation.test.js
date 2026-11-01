// #56 결정: 휴대폰은 세로로 고정하고, 큰 화면(가장 짧은 변 600dp 이상: 태블릿, 펼친 폴더블)은 방향을 고정하지 않는다.
// scripts/lib 모듈이 아니라 실제 Android 설정·소스 파일을 읽어 검사한다. jest 가 android/ 아래 테스트를 무시해서 여기에 둔다.
const fs = require('fs');
const path = require('path');

const MAIN_DIR = path.resolve(__dirname, '../../../android/app/src/main');
const read = file =>
  fs.readFileSync(path.join(MAIN_DIR, file), 'utf8').replace(/\r\n/g, '\n');

const manifest = read('AndroidManifest.xml');
const activity = read('java/com/dinoproduct/app/MainActivity.kt');

const MAIN_ACTIVITY_TAG = /<activity\s[^>]*android:name="\.MainActivity"[^>]*>/;

function mustMatch(text, pattern, what) {
  const match = text.match(pattern);
  if (!match) {
    throw new Error(`${what} 를 찾지 못했다`);
  }
  return match;
}

// `fun 이름(...)` 의 본문 { ... } 을 괄호 짝으로 잘라 낸다
function functionBody(source, name) {
  const start = mustMatch(
    source,
    new RegExp(`fun ${name}\\([^)]*\\)[^{]*\\{`),
    `${name} 함수`,
  );
  let depth = 0;
  for (let i = start.index + start[0].length - 1; i < source.length; i++) {
    if (source[i] === '{') {
      depth++;
    } else if (source[i] === '}' && --depth === 0) {
      return source.slice(start.index + start[0].length, i);
    }
  }
  throw new Error(`${name} 함수가 닫히지 않았다`);
}

// requestedOrientation 을 정하는 함수: `private fun 이름(config: Configuration) { requestedOrientation = ... }`
function orientationPolicy() {
  const name = mustMatch(
    activity,
    /private fun (\w+)\(\w+: Configuration\)\s*\{\s*requestedOrientation\s*=/,
    'requestedOrientation 을 정하는 함수',
  )[1];
  return { name, body: functionBody(activity, name) };
}

describe('Android 화면 방향 (#56 휴대폰 세로, 큰 화면 반응형)', () => {
  it('매니페스트에서 방향을 고정하지 않는다 (portrait 를 두면 Android 15 이하 태블릿도 세로에 묶인다)', () => {
    expect(manifest).not.toMatch(/android:screenOrientation=/);
  });

  it('큰 화면의 방향 무시를 미루는 임시 예외 속성을 쓰지 않는다', () => {
    expect(manifest).not.toMatch(
      /PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY/,
    );
  });

  it('회전·접고 펴기·창 크기 변경에 Activity 를 다시 만들지 않는다 (방향은 onConfigurationChanged 에서 다시 정한다)', () => {
    const tag = mustMatch(manifest, MAIN_ACTIVITY_TAG, 'MainActivity 태그')[0];
    const changes = mustMatch(
      tag,
      /android:configChanges="([^"]+)"/,
      'MainActivity 의 configChanges',
    )[1].split('|');

    expect(changes).toEqual(
      expect.arrayContaining([
        'orientation',
        'screenSize',
        'smallestScreenSize',
        'screenLayout',
      ]),
    );
  });

  it('가장 짧은 변이 600dp 미만이면 세로를 요청하고, 아니면 고정하지 않는다', () => {
    const { body } = orientationPolicy();
    const [, threshold, compact, large] = mustMatch(
      body,
      /if\s*\(\s*\w+\.smallestScreenWidthDp\s*<\s*(\w+)\s*\)\s*\{\s*ActivityInfo\.(\w+)\s*\}\s*else\s*\{(?:\s*\/\/[^\n]*)*\s*ActivityInfo\.(\w+)\s*\}/,
      '짧은 변으로 방향을 고르는 if 식',
    );
    const value = /^\d+$/.test(threshold)
      ? threshold
      : mustMatch(
          activity,
          new RegExp(`const val ${threshold} = (\\d+)`),
          `상수 ${threshold}`,
        )[1];

    expect(Number(value)).toBe(600);
    expect(compact).toBe('SCREEN_ORIENTATION_PORTRAIT');
    // 매니페스트에 방향을 두지 않았을 때의 기본값으로 돌려놓는다
    expect(large).toBe('SCREEN_ORIENTATION_UNSPECIFIED');
  });

  it('onCreate 는 Fragment 팩토리 → super.onCreate → 방향 순서다', () => {
    const { name } = orientationPolicy();
    const body = functionBody(activity, 'onCreate');
    const factory = body.indexOf(
      'supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()',
    );
    const superCall = body.indexOf('super.onCreate(savedInstanceState)');
    const orientation = body.indexOf(`${name}(resources.configuration)`);

    // react-native-screens: 팩토리는 super.onCreate 가 Fragment 를 복원하기 전에 둬야 한다
    expect(factory).toBeGreaterThanOrEqual(0);
    expect(superCall).toBeGreaterThan(factory);
    expect(orientation).toBeGreaterThan(superCall);
  });

  it('구성이 바뀌면(폴더블 접고 펴기, 창 크기 변경) 새 구성으로 방향을 다시 정한다', () => {
    const { name } = orientationPolicy();
    const body = functionBody(activity, 'onConfigurationChanged');
    const superCall = body.indexOf('super.onConfigurationChanged(newConfig)');

    expect(superCall).toBeGreaterThanOrEqual(0);
    expect(body.indexOf(`${name}(newConfig)`)).toBeGreaterThan(superCall);
  });
});
