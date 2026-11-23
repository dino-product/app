// #110: babel 이 번들에 넣는 ORBIT_API_BASE_URL 은 Gradle 번들 작업(createBundle*JsAndAssets)의 입력이 아니다.
// 입력으로 걸지 않으면 값만 바꿔 다시 빌드할 때 작업이 UP-TO-DATE 로 건너뛰어 옛 주소의 번들이 APK 에 남는다.
// 실제 gradle 을 돌리지 않고 설정 파일을 읽어 검사한다 (네이티브 빌드는 CI native-build 가 확인한다)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

// 주석 속 예시 코드에 걸리지 않게 주석을 걷어 낸다
const gradle = read('android/app/build.gradle')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

// 셸 환경 변수 → Gradle 속성(~/.gradle/gradle.properties, CI 는 ORG_GRADLE_PROJECT_<이름>) 순으로 읽는 값 (#110 0e7ed96)
const BUNDLE_BUILD_VALUES = ['ORBIT_API_BASE_URL', 'DEVELOP_ONLY'];

describe('Android 번들 작업 입력', () => {
  it('번들 빌드 값은 셸 환경 변수를 먼저, 없으면 같은 이름의 Gradle 속성을 읽는다', () => {
    const declared = gradle.match(
      /bundleBuildValues\s*=\s*\[([^\]]*)\]\.collectEntries\s*\{[^}]*\}/,
    );

    expect(
      [...(declared?.[1] ?? '').matchAll(/"([^"]+)"/g)].map(match => match[1]),
    ).toEqual(BUNDLE_BUILD_VALUES);
    expect(declared?.[0]).toMatch(
      /System\.getenv\(name\)\s*\?:\s*findProperty\(name\)\?\.toString\(\)\s*\?:\s*""/,
    );
    expect(declared?.[0]).toMatch(/\.trim\(\)/);
  });

  // #110: 입력으로 걸지 않으면 값만 바꿔 다시 빌드할 때 UP-TO-DATE 로 옛 값의 번들이 남는다.
  // #192: 웹 주소(dev.orbi-t.com / orbi-t.com)를 고르는 DEVELOP_ONLY 도 babel 이 번들에 넣는다
  it.each(BUNDLE_BUILD_VALUES)(
    'createBundle* 작업이 %s 을 입력으로 본다',
    name => {
      expect(gradle).toMatch(
        new RegExp(
          `tasks\\.matching\\s*\\{\\s*it\\.name\\.startsWith\\("createBundle"\\)\\s*\\}\\s*\\.configureEach\\s*\\{[\\s\\S]*?inputs\\.property\\(\\s*"[^"]+"\\s*,\\s*bundleBuildValues\\.${name}\\s*\\)`,
        ),
      );
    },
  );

  it('값이 있으면 번들 작업의 node 앞에 env 로 붙이고, codegen(react { nodeExecutableAndArgs })은 건드리지 않는다', () => {
    expect(gradle).toMatch(
      /bundleEnv\s*=\s*bundleBuildValues\.findAll\s*\{\s*it\.value\s*\}/,
    );
    expect(gradle).toMatch(
      /onVariants\(selector\(\)\.all\(\)\)\s*\{[\s\S]*?"createBundle\$\{variant\.name\.capitalize\(\)\}JsAndAssets"[\s\S]*?nodeExecutableAndArgs\.set\(\s*\["env"\]\s*\+\s*bundleEnv\s*\+\s*\["node"\]\s*\)/,
    );
    expect(gradle).not.toMatch(/react\s*\{[^}]*nodeExecutableAndArgs/);
  });

  it('React Native gradle 플러그인의 번들 작업 이름이 createBundle 로 시작한다', () => {
    const plugin = read(
      'node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/src/main/kotlin/com/facebook/react/TaskConfiguration.kt',
    );

    expect(plugin).toContain(
      'tasks.register("createBundle${targetName}JsAndAssets"',
    );
  });
});
