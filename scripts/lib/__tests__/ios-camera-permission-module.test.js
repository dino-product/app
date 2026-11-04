// #111 iOS 카메라 권한 앱 TurboModule 의 연결 (JS 스펙 ↔ codegenConfig ↔ ObjC++ 구현 ↔ Xcode 앱 타깃).
// 로컬 네이티브 빌드를 하지 않으므로 이름이 어긋나 런타임에 모듈이 null 이 되는 것을 여기서 막는다. 컴파일은 CI native-build 가 본다.
// scripts/lib 모듈이 아니라 실제 설정·소스 파일을 읽어 검사한다. jest 가 ios/ 아래 테스트를 무시해서 여기에 둔다.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = (...segments) =>
  fs.readFileSync(path.join(ROOT, ...segments), 'utf8').replace(/\r\n/g, '\n');

const packageJson = JSON.parse(read('package.json'));
const spec = read('src', 'shared', 'native', 'NativeCameraPermissionIOS.ts');
const pbxproj = read('ios', 'DinoApp.xcodeproj', 'project.pbxproj');

function mustMatch(text, pattern, what) {
  const match = text.match(pattern);
  if (!match) {
    throw new Error(`${what} 를 찾지 못했다`);
  }
  return match;
}

const moduleName = mustMatch(
  spec,
  /TurboModuleRegistry\.get<Spec>\('(\w+)'\)/,
  '스펙의 TurboModuleRegistry.get 모듈 이름',
)[1];
const className = packageJson.codegenConfig?.ios?.modulesProvider?.[moduleName];
const implementation = () => read('ios', 'DinoApp', `${className}.mm`);

describe('iOS 카메라 권한 모듈 (#111)', () => {
  it('codegen 이 모듈과 기존 컴포넌트(GestureExclusionView)를 함께 만든다', () => {
    expect(packageJson.codegenConfig).toEqual(
      expect.objectContaining({
        name: 'DinoAppSpec',
        type: 'all',
        jsSrcsDir: 'src/shared/native',
      }),
    );
  });

  // codegen 은 이름이 IOS 로 끝나는 모듈의 Android 스펙을 만들지 않는다 (@react-native/codegen verifyPlatforms)
  it('모듈 이름이 IOS 로 끝나 Android 스펙이 생기지 않는다', () => {
    expect(moduleName).toMatch(/IOS$/);
  });

  // RN 0.77+ 앱 TurboModule 은 modulesProvider 로 RCTAppDependencyProvider 에 등록해야 찾을 수 있다
  it('modulesProvider 가 스펙의 모듈 이름을 ObjC 클래스로 잇는다', () => {
    expect(className).toEqual(expect.stringMatching(/^RCT\w+$/));
  });

  it('구현은 codegen 프로토콜을 따르고 같은 모듈 이름을 쓴다', () => {
    const header = read('ios', 'DinoApp', `${className}.h`);
    const source = implementation();

    expect(header).toContain('#import <DinoAppSpec/DinoAppSpec.h>');
    expect(header).toMatch(
      new RegExp(
        `@interface ${className} : NSObject <Native${moduleName}Spec>`,
      ),
    );
    expect(source).toMatch(new RegExp(`@implementation ${className}\\b`));
    expect(source).toMatch(
      new RegExp(
        `\\+ \\(NSString \\*\\)moduleName\\s*\\{\\s*return @"${moduleName}";`,
      ),
    );
    expect(source).toContain(`Native${moduleName}SpecJSI`);
  });

  it('JS 가 보는 상태 문자열을 AVCaptureDevice 카메라 권한에서 그대로 만든다', () => {
    const source = implementation();
    const returned = [...source.matchAll(/return @"([\w-]+)";/g)]
      .map(match => match[1])
      .filter(value => value !== moduleName);

    expect(source).toContain(
      'authorizationStatusForMediaType:AVMediaTypeVideo',
    );
    expect(source).toContain('requestAccessForMediaType:AVMediaTypeVideo');
    expect(new Set(returned)).toEqual(
      new Set(['granted', 'denied', 'restricted', 'not-determined']),
    );
  });

  it('구현 파일이 앱 타깃의 Sources 빌드 단계에 들어 있다', () => {
    const fileName = `${className}.mm`;
    const fileRef = mustMatch(
      pbxproj,
      new RegExp(
        `\\t\\t([0-9A-F]{24}) /\\* ${fileName} \\*/ = \\{isa = PBXFileReference;[^\\n]*path = DinoApp/${fileName};`,
      ),
      `${fileName} 파일 참조`,
    )[1];
    const buildFile = mustMatch(
      pbxproj,
      new RegExp(
        `\\t\\t([0-9A-F]{24}) /\\* ${fileName} in Sources \\*/ = \\{isa = PBXBuildFile; fileRef = ${fileRef} `,
      ),
      `${fileName} 빌드 파일`,
    )[1];
    const sources = mustMatch(
      pbxproj,
      /isa = PBXSourcesBuildPhase;[\s\S]*?files = \(([\s\S]*?)\);/,
      '앱 타깃 Sources 빌드 단계',
    )[1];

    expect(sources).toContain(buildFile);
  });
});
