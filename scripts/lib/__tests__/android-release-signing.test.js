// Play 는 debug 키로 서명한 빌드를 받지 않는다. release 는 업로드 키 속성이 있으면 그 키로,
// 없으면(로컬·CI) 지금처럼 debug 키로 서명한다. 키·비밀번호는 저장소 밖에 둔다 (#57)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

const UPLOAD_KEY_PROPERTIES = [
  'ORBIT_UPLOAD_STORE_FILE',
  'ORBIT_UPLOAD_STORE_PASSWORD',
  'ORBIT_UPLOAD_KEY_ALIAS',
  'ORBIT_UPLOAD_KEY_PASSWORD',
];

// 주석 속 예시 코드에 걸리지 않게 주석을 걷어 낸다
const gradle = read('android/app/build.gradle')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

// `<name> {` 블록의 본문. 중괄호 짝을 세어 끝을 찾는다
function block(source, name) {
  const start = source.search(new RegExp(`(^|\\s)${name}\\s*\\{`));
  if (start === -1) {
    return '';
  }
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') {
      depth++;
    } else if (source[i] === '}' && --depth === 0) {
      return source.slice(open + 1, i);
    }
  }
  return '';
}

const android = block(gradle, 'android');
const signingConfigs = block(android, 'signingConfigs');
const buildTypes = block(android, 'buildTypes');
const assignments = (source, field) =>
  [...source.matchAll(new RegExp(`\\b${field}\\s+(.+)`, 'g'))].map(match =>
    match[1].trim(),
  );

describe('Android release 서명 (#57)', () => {
  it('업로드 키 속성 이름 넷을 정해 두고 Gradle 속성(findProperty)에서 읽는다', () => {
    const declared = gradle.match(/uploadKeyProperties\s*=\s*\[([^\]]*)\]/);

    expect(
      [...(declared?.[1] ?? '').matchAll(/"([^"]+)"/g)].map(match => match[1]),
    ).toEqual(UPLOAD_KEY_PROPERTIES);
    // ~/.gradle/gradle.properties, -P, ORG_GRADLE_PROJECT_<이름> 환경 변수가 모두 Gradle 속성으로 들어온다
    expect(gradle).toMatch(
      /uploadKeyProperties\.collectEntries\s*\{[^}]*findProperty\(it\)/,
    );
    expect(gradle).not.toMatch(/System\.getenv/);
  });

  it('속성이 일부만 있으면 debug 로 넘어가지 않고 빌드를 멈춘다', () => {
    expect(gradle).toMatch(
      /if\s*\(\s*uploadKey\s*&&\s*missingUploadKeyProperties\s*\)\s*\{\s*throw new GradleException\(/,
    );
    expect(gradle).toMatch(
      /def hasUploadKey\s*=\s*missingUploadKeyProperties\.isEmpty\(\)/,
    );
  });

  it('release 서명 설정은 업로드 키가 있을 때만 만들고, 값은 모두 속성에서 온다', () => {
    const guarded = block(signingConfigs, 'if \\(hasUploadKey\\)');
    const release = block(guarded, 'release');

    expect(release).not.toBe('');
    expect(
      ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'].map(field =>
        assignments(release, field),
      ),
    ).toEqual([
      ['file(uploadKey.ORBIT_UPLOAD_STORE_FILE)'],
      ['uploadKey.ORBIT_UPLOAD_STORE_PASSWORD'],
      ['uploadKey.ORBIT_UPLOAD_KEY_ALIAS'],
      ['uploadKey.ORBIT_UPLOAD_KEY_PASSWORD'],
    ]);
  });

  it('release 빌드는 업로드 키가 있으면 release 서명, 없으면 debug 서명을 쓴다', () => {
    expect(assignments(block(buildTypes, 'release'), 'signingConfig')).toEqual([
      'hasUploadKey ? signingConfigs.release : signingConfigs.debug',
    ]);
    expect(assignments(block(buildTypes, 'debug'), 'signingConfig')).toEqual([
      'signingConfigs.debug',
    ]);
  });

  it('대신 쓰는 debug 서명은 저장소의 RN 템플릿 debug.keystore 다', () => {
    const debug = block(signingConfigs, 'debug');

    expect(assignments(debug, 'storeFile')).toEqual(["file('debug.keystore')"]);
    expect(assignments(debug, 'keyAlias')).toEqual(["'androiddebugkey'"]);
    expect(git('ls-files', 'android/app/debug.keystore')).toEqual([
      'android/app/debug.keystore',
    ]);
  });

  it('저장소에 업로드 키 파일·속성 값이 없다', () => {
    expect(git('ls-files', '*.keystore', '*.jks', '*.p12', '*.pfx')).toEqual([
      'android/app/debug.keystore',
    ]);
    expect(read('android/gradle.properties')).not.toMatch(/ORBIT_UPLOAD_/);
    // Android Studio 가 만드는 .jks 도 실수로 커밋되지 않게 무시한다
    expect(
      git(
        'check-ignore',
        '--no-index',
        'android/app/orbit-upload.keystore',
        'android/app/orbit-upload.jks',
        'android/keystores/orbit-upload.jks',
      ),
    ).toHaveLength(3);
  });

  it('출시 문서(docs/play-store.md)가 같은 속성 이름을 안내한다', () => {
    const doc = read('docs/play-store.md');

    expect(UPLOAD_KEY_PROPERTIES.filter(name => !doc.includes(name))).toEqual(
      [],
    );
  });
});
