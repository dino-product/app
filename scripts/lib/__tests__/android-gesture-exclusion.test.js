// 제스처 제외 영역 네이티브 뷰(#58)는 로컬 네이티브 빌드 없이 CI 에서만 컴파일된다.
// 컴파일은 되지만 앱을 띄워야 드러나는 연결 실수(컴포넌트 이름 불일치, 패키지 등록 누락)를 여기서 잡는다
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const SPEC = 'src/shared/native/GestureExclusionViewNativeComponent.ts';
const NATIVE = 'android/app/src/main/java/com/dinoproduct/app';
const MANAGER = `${NATIVE}/gestureexclusion/GestureExclusionViewManager.kt`;

function mustMatch(text, pattern, what) {
  const match = text.match(pattern);
  if (!match) {
    throw new Error(`${what} 를 찾지 못했다`);
  }
  return match;
}

const specName = () =>
  mustMatch(
    read(SPEC),
    /codegenNativeComponent<\w+>\(\s*'(\w+)'/,
    '스펙의 codegenNativeComponent 이름',
  )[1];

describe('Android 제스처 제외 영역 네이티브 뷰 연결 (#58)', () => {
  it('ViewManager 이름이 JS 스펙의 컴포넌트 이름과 같다', () => {
    const [, name] = mustMatch(
      read(MANAGER),
      /const val NAME = "(\w+)"/,
      'ViewManager 의 NAME',
    );

    expect(name).toBe(specName());
  });

  it('ViewManager 가 그 이름으로 codegen 이 만든 interface·delegate 를 쓴다', () => {
    const manager = read(MANAGER);

    expect(manager).toContain(`${specName()}ManagerInterface<`);
    expect(manager).toContain(`${specName()}ManagerDelegate<`);
  });

  it('MainApplication 이 ViewManager 를 담은 패키지를 등록한다', () => {
    expect(read(`${NATIVE}/MainApplication.kt`)).toMatch(
      /^\s*add\(GestureExclusionPackage\(\)\)/m,
    );
    expect(
      read(`${NATIVE}/gestureexclusion/GestureExclusionPackage.kt`),
    ).toContain('GestureExclusionViewManager()');
  });

  it('package.json codegenConfig 가 스펙 폴더의 컴포넌트를 생성한다', () => {
    const { codegenConfig } = JSON.parse(read('package.json'));

    expect(codegenConfig.jsSrcsDir).toBe(path.dirname(SPEC));
    expect(['components', 'all']).toContain(codegenConfig.type);
    // codegen 은 이 이름 꼴의 파일만 스펙으로 읽는다
    expect(path.basename(SPEC)).toMatch(/NativeComponent\.ts$/);
  });
});
