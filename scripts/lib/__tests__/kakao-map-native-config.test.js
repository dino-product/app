// #67 작업 위치 지도(카카오맵 SDK v2) 네이티브 연결. 로컬 네이티브 빌드를 하지 않으므로(컴파일은 CI native-build),
// 컴파일은 되지만 앱을 띄워야 드러나는 실수(이름 불일치, 등록 누락, 생명주기·제스처·키 처리 누락)를 실제 설정·소스 파일로 막는다.
// jest 가 ios/·android/ 아래 테스트를 무시해서 여기에 둔다
const fs = require('fs');
const path = require('path');
const { decodePng } = require('../png');

const ROOT = path.resolve(__dirname, '../../..');
const read = file =>
  fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');

const SPEC = 'src/shared/native/KakaoMapViewNativeComponent.ts';
const ANDROID = 'android/app/src/main/java/com/dinoproduct/app';
const MANAGER = `${ANDROID}/kakaomap/KakaoMapViewManager.kt`;
const CONTAINER = `${ANDROID}/kakaomap/KakaoMapContainer.kt`;
const IOS_COMPONENT = 'ios/DinoApp/RCTKakaoMapView.mm';
const IOS_MAP = 'ios/DinoApp/KakaoMapContainerView.swift';

function mustMatch(text, pattern, what) {
  const match = text.match(pattern);
  if (!match) {
    throw new Error(`${what} 를 찾지 못했다`);
  }
  return match;
}

const specName = mustMatch(
  read(SPEC),
  /codegenNativeComponent<\w+>\(\s*'(\w+)'/,
  '스펙의 codegenNativeComponent 이름',
)[1];

// 코드 주석을 빼고 본다 (주석에 적힌 이름이 검사를 통과시키지 않게)
const code = text =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('카카오맵 SDK 의존성 (#67)', () => {
  it('Android 는 카카오 Maven 저장소에서 지도 SDK v2 를 받는다', () => {
    const gradle = code(read('android/app/build.gradle'));

    expect(gradle).toContain(
      'maven { url "https://devrepo.kakao.com/nexus/repository/kakaomap-releases/" }',
    );
    expect(gradle).toMatch(
      /implementation\("com\.kakao\.maps\.open:android:2\.\d+\.\d+"\)/,
    );
  });

  it('iOS 는 KakaoMapsSDK pod 를 버전 고정으로 넣고 Podfile.lock 에 있다', () => {
    expect(code(read('ios/Podfile'))).toMatch(
      /^\s*pod 'KakaoMapsSDK', '2\.\d+\.\d+'$/m,
    );
    expect(read('ios/Podfile.lock')).toMatch(
      /^ {2}- KakaoMapsSDK \(2\.\d+\.\d+\)$/m,
    );
  });
});

describe('Android 지도 네이티브 뷰 연결 (#67)', () => {
  it('ViewManager 이름이 JS 스펙의 컴포넌트 이름이고 codegen interface·delegate 를 쓴다', () => {
    const manager = read(MANAGER);

    expect(mustMatch(manager, /const val NAME = "(\w+)"/, 'NAME')[1]).toBe(
      specName,
    );
    expect(manager).toContain(`${specName}ManagerInterface<`);
    expect(manager).toContain(`${specName}ManagerDelegate<`);
  });

  it('MainApplication 이 패키지를 등록하고 패키지가 ViewManager 를 낸다', () => {
    expect(read(`${ANDROID}/MainApplication.kt`)).toMatch(
      /^\s*add\(KakaoMapPackage\(\)\)/m,
    );
    expect(read(`${ANDROID}/kakaomap/KakaoMapPackage.kt`)).toContain(
      'KakaoMapViewManager()',
    );
  });

  it('JS 이벤트 이름(onMapReady·onMapError)을 내보낸다', () => {
    const manager = code(read(MANAGER));
    const container = code(read(CONTAINER));

    expect(manager).toContain(
      '"topMapReady" to mapOf("registrationName" to "onMapReady")',
    );
    expect(manager).toContain(
      '"topMapError" to mapOf("registrationName" to "onMapError")',
    );
    expect(container).toContain('emit("topMapReady"');
    expect(container).toContain('emit("topMapError"');
  });

  // 부르지 않으면 크래시가 날 수 있다 (카카오맵 SDK v2 개발 주의사항)
  it('화면 resume/pause 에 MapView.resume()/pause() 를 부르고, 뷰가 내려가면 finish() 한다', () => {
    const container = code(read(CONTAINER));
    const manager = code(read(MANAGER));

    expect(container).toMatch(
      /override fun onHostResume\(\) \{\s*mapView\?\.resume\(\)\s*\}/,
    );
    expect(container).toMatch(
      /override fun onHostPause\(\) \{\s*mapView\?\.pause\(\)\s*\}/,
    );
    expect(container).toContain('reactContext.addLifecycleEventListener(this)');
    expect(container).toContain(
      'reactContext.removeLifecycleEventListener(this)',
    );
    expect(container).toMatch(/fun destroy\(\)[\s\S]*?\.finish\(\)/);
    expect(manager).toMatch(
      /override fun onDropViewInstance\(view: KakaoMapContainer\) \{\s*view\.destroy\(\)/,
    );
  });

  it('표시용이라 지도 제스처를 모두 끄고 터치를 지도로 보내지 않는다', () => {
    const container = code(read(CONTAINER));

    expect(container).toMatch(
      /GestureType\.values\(\)\s*\.filter \{ it != GestureType\.Unknown \}\s*\.forEach \{ map\.setGestureEnable\(it, false\) \}/,
    );
    expect(container).toContain(
      'override fun onInterceptTouchEvent(event: MotionEvent): Boolean = true',
    );
    expect(container).toContain(
      'override fun onTouchEvent(event: MotionEvent): Boolean = false',
    );
  });

  it('카카오 로그인과 같은 앱 키 리소스를 쓰고, 키가 비었으면 SDK 를 켜지 않는다', () => {
    const container = code(read(CONTAINER));
    const init = container.indexOf('KakaoMapSdk.init(');

    expect(container).toContain('getString(R.string.kakao_app_key)');
    expect(container.indexOf('appKey.isEmpty()')).toBeGreaterThan(-1);
    expect(container.indexOf('appKey.isEmpty()')).toBeLessThan(init);
  });

  // 콜드 스타트 예산: SDK 는 처음 지도를 그릴 때 켠다
  it('앱 시작(MainApplication)에서 지도 SDK 를 켜지 않는다', () => {
    expect(read(`${ANDROID}/MainApplication.kt`)).not.toContain('KakaoMapSdk');
  });
});

describe('iOS 지도 네이티브 뷰 연결 (#67)', () => {
  const pbxproj = read('ios/DinoApp.xcodeproj/project.pbxproj');
  const { codegenConfig } = JSON.parse(read('package.json'));

  it('componentProvider 가 스펙의 컴포넌트 이름을 Fabric 컴포넌트 클래스로 잇는다', () => {
    expect(codegenConfig.ios.componentProvider).toEqual({
      [specName]: 'RCTKakaoMapView',
    });
    const source = read(IOS_COMPONENT);
    expect(source).toContain(
      `concreteComponentDescriptorProvider<${specName}ComponentDescriptor>()`,
    );
    expect(source).toContain(`<RCT${specName}ViewProtocol>`);
  });

  // KakaoMapsSDK 주의사항: 재사용(recycle)하도록 만들어지지 않았다
  it('Fabric 컴포넌트를 재사용하지 않고, 내려가면 엔진을 정리한다', () => {
    const source = code(read(IOS_COMPONENT));
    const swift = code(read(IOS_MAP));

    expect(source).toMatch(
      /\+ \(BOOL\)shouldBeRecycled\s*\{\s*return NO;\s*\}/,
    );
    expect(source).toMatch(/- \(void\)dealloc\s*\{\s*\[_map destroy\];/);
    expect(swift).toMatch(
      /controller\.pauseEngine\(\)\s*controller\.resetEngine\(\)/,
    );
  });

  it('앱이 비활성이거나 창에서 떨어지면 렌더링을 멈춘다', () => {
    const swift = code(read(IOS_MAP));

    expect(swift).toContain('UIApplication.willResignActiveNotification');
    expect(swift).toContain('UIApplication.didBecomeActiveNotification');
    expect(swift).toContain('engine.windowDidChange(attached: window != nil)');
    expect(swift).toMatch(
      /if attached && appActive \{[\s\S]*?activateEngine\(\)[\s\S]*?pauseEngine\(\)/,
    );
  });

  it('표시용이라 지도 제스처를 모두 끄고 터치를 받지 않는다', () => {
    const swift = code(read(IOS_MAP));
    // KakaoMapsSDK ApiEnums.h GestureType 의 실제 제스처 9가지 (Unknown 제외)
    const gestures = [
      'doubleTapZoomIn',
      'twoFingerTapZoomOut',
      'pan',
      'rotate',
      'zoom',
      'tilt',
      'longTapAndDrag',
      'rotateZoom',
      'oneFingerZoom',
    ];
    const listed = mustMatch(
      swift,
      /let gestures: \[GestureType\] = \[([\s\S]*?)\]/,
      '끄는 제스처 목록',
    )[1];

    expect(
      listed
        .match(/\.\w+/g)
        .map(name => name.slice(1))
        .sort(),
    ).toEqual([...gestures].sort());
    expect(swift).toContain(
      'map.setGestureEnable(type: gesture, enable: false)',
    );
    expect(swift).toContain('isUserInteractionEnabled = false');
  });

  it('카카오 로그인과 같은 Info.plist KAKAO_APP_KEY 를 쓰고, 키가 비었으면 SDK 를 켜지 않는다', () => {
    const swift = code(read(IOS_MAP));

    expect(swift).toContain('forInfoDictionaryKey: "KAKAO_APP_KEY"');
    expect(swift.indexOf('guard !appKey.isEmpty')).toBeGreaterThan(-1);
    expect(swift.indexOf('guard !appKey.isEmpty')).toBeLessThan(
      swift.indexOf('SDKInitializer.InitSDK('),
    );
  });

  it('앱 시작(AppDelegate)에서 지도 SDK 를 켜지 않는다', () => {
    expect(read('ios/DinoApp/AppDelegate.swift')).not.toContain(
      'SDKInitializer',
    );
  });

  it.each(['RCTKakaoMapView.mm', 'KakaoMapContainerView.swift'])(
    '%s 가 앱 타깃의 Sources 빌드 단계에 들어 있다',
    fileName => {
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
    },
  );
});

// Figma 작업 위치 마커 (반투명 원 Ellipse 3 52×52 + 핀 fa7-solid:map-marker-alt 48×48, 3235:16286·3235:16287)
describe('지도 마커 그림 (#67)', () => {
  const PIN = [0x64, 0x52, 0xfd]; // #6452FD
  const isPin = (data, i) =>
    data[i + 3] > 200 &&
    Math.abs(data[i] - PIN[0]) < 24 &&
    Math.abs(data[i + 1] - PIN[1]) < 24 &&
    Math.abs(data[i + 2] - PIN[2]) < 24;
  // 핀 색이 있는 가장 아래 줄과 그 줄의 가운데 열 (핀 끝)
  function pinTip({ width, height, data }) {
    for (let y = height - 1; y >= 0; y--) {
      const xs = [];
      for (let x = 0; x < width; x++) {
        if (isPin(data, (y * width + x) * 4)) {
          xs.push(x);
        }
      }
      if (xs.length > 0) {
        return {
          x: (xs[0] + xs[xs.length - 1] + 1) / 2 / width,
          y: (y + 1) / height,
        };
      }
    }
    throw new Error('핀 색을 찾지 못했다');
  }
  const anchorY = source =>
    Number(
      mustMatch(source, /45\.5f? \/ 52f?/, '핀 끝 기준점')[0]
        .split('/')
        .map(part => parseFloat(part))
        .reduce((a, b) => a / b),
    );

  it('Android: drawable-nodpi 원본(52 의 4배 208px)이고, 기준점이 핀 끝이다', () => {
    const image = decodePng(
      fs.readFileSync(
        path.join(
          ROOT,
          'android/app/src/main/res/drawable-nodpi/kakao_map_marker.png',
        ),
      ),
    );
    const tip = pinTip(image);

    expect([image.width, image.height]).toEqual([208, 208]);
    expect(tip.x).toBeCloseTo(0.5, 2);
    expect(Math.abs(tip.y - anchorY(read(CONTAINER)))).toBeLessThan(1 / 52);
    expect(read(CONTAINER)).toContain('.setAnchorPoint(0.5f, MARKER_ANCHOR_Y)');
  });

  // KakaoMapsSDK 는 그림을 (화면 배율 / 2) 로 키운다: 배율별 그림을 두지 않고 52pt 의 2배 하나만 둔다
  it('iOS: 배율 하나짜리 104px 그림이고, 기준점이 핀 끝이다', () => {
    const set = 'ios/DinoApp/Images.xcassets/KakaoMapMarker.imageset';
    const { images } = JSON.parse(read(`${set}/Contents.json`));
    const image = decodePng(
      fs.readFileSync(path.join(ROOT, set, images[0].filename)),
    );
    const tip = pinTip(image);

    expect(images).toHaveLength(1);
    expect(images[0].scale).toBeUndefined();
    expect([image.width, image.height]).toEqual([104, 104]);
    expect(tip.x).toBeCloseTo(0.5, 2);
    expect(Math.abs(tip.y - anchorY(read(IOS_MAP)))).toBeLessThan(1 / 52);
    expect(read(IOS_MAP)).toContain('UIImage(named: "KakaoMapMarker")');
  });
});
