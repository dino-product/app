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

describe('Android 번들 작업 입력', () => {
  it('createBundle* 작업이 ORBIT_API_BASE_URL 을 입력으로 본다', () => {
    expect(gradle).toMatch(
      /tasks\.matching\s*\{\s*it\.name\.startsWith\("createBundle"\)\s*\}\s*\.configureEach\s*\{[\s\S]*?inputs\.property\(\s*"[^"]+"\s*,\s*providers\.environmentVariable\("ORBIT_API_BASE_URL"\)/,
    );
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
