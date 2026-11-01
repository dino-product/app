// #23 결정: iPhone 전용. 화면이 iPhone 세로(Figma) 기준으로만 만들어져 있다.
// scripts/lib 모듈이 아니라 실제 iOS 설정 파일을 읽어 검사한다. jest 가 ios/ 아래 테스트를 무시해서 여기에 둔다.
const fs = require('fs');
const path = require('path');

const iosDir = path.join(__dirname, '..', '..', '..', 'ios');

// 아래 정규식은 Xcode 가 쓰는 형식(LF, 탭 들여쓰기)을 가정한다. CRLF 로 체크아웃돼도 같은 형식으로 맞춘다.
function readIosFile(...segments) {
  return fs
    .readFileSync(path.join(iosDir, ...segments), 'utf8')
    .replace(/\r\n/g, '\n');
}

const pbxproj = readIosFile('DinoApp.xcodeproj', 'project.pbxproj');
const infoPlist = readIosFile('DinoApp', 'Info.plist');

function mustMatch(text, pattern, what) {
  const match = text.match(pattern);
  if (!match) {
    throw new Error(`${what} 를 찾지 못했다`);
  }
  return match;
}

function unquote(value) {
  return value.replace(/^"(.*)"$/, '$1');
}

// pbxproj 최상위 객체(`\t\t<id> /* ... */ = { ... };`)의 본문
function objectBody(id) {
  return mustMatch(
    pbxproj,
    new RegExp(
      `\\n\\t\\t${id} (?:/\\*[^*]*\\*/ )?= \\{([\\s\\S]*?)\\n\\t\\t\\};`,
    ),
    `pbxproj 객체 ${id}`,
  )[1];
}

// 앱 타깃의 빌드 구성마다 TARGETED_DEVICE_FAMILY 값을 모은다. `[sdk=...]` 같은 조건부 키도 포함한다.
// → { 'DinoApp Debug': ['1'], 'DinoApp Release': ['1'] }
function appTargetDeviceFamilies() {
  const appTargets = (
    pbxproj.match(
      /\n\t\t[0-9A-F]{24} \/\* [^*]+ \*\/ = \{\n\t\t\tisa = PBXNativeTarget;[\s\S]*?\n\t\t\};/g,
    ) ?? []
  ).filter(body => body.includes('"com.apple.product-type.application"'));
  if (appTargets.length === 0) {
    throw new Error('pbxproj 에 앱 타깃이 없다');
  }

  const families = {};
  for (const target of appTargets) {
    const targetName = unquote(
      mustMatch(target, /\n\t\t\tname = ([^;]+);/, '앱 타깃 이름')[1],
    );
    const listId = mustMatch(
      target,
      /buildConfigurationList = ([0-9A-F]{24})/,
      `${targetName} 의 buildConfigurationList`,
    )[1];
    const configIds =
      mustMatch(
        objectBody(listId),
        /buildConfigurations = \(([\s\S]*?)\);/,
        `${targetName} 의 buildConfigurations`,
      )[1].match(/[0-9A-F]{24}/g) ?? [];

    for (const id of configIds) {
      const body = objectBody(id);
      const configName = unquote(
        mustMatch(
          body,
          /\n\t\t\tname = ([^;]+);/,
          `빌드 구성 ${id} 의 이름`,
        )[1],
      );
      families[`${targetName} ${configName}`] = [
        ...body.matchAll(
          /"?TARGETED_DEVICE_FAMILY(?:\[[^\]]*\])?"? = ([^;]+);/g,
        ),
      ].map(m => unquote(m[1]));
    }
  }
  return families;
}

describe('iOS 지원 기기 (#23 iPhone 전용)', () => {
  it('앱 타깃은 Debug·Release 모두 iPhone(1) 으로만 빌드한다', () => {
    expect(appTargetDeviceFamilies()).toEqual({
      'DinoApp Debug': ['1'],
      'DinoApp Release': ['1'],
    });
  });

  it('Info.plist 에 iPad 전용 방향 키가 없다', () => {
    const keys = [...infoPlist.matchAll(/<key>([^<]+)<\/key>/g)].map(m => m[1]);
    expect(keys).not.toContain('UISupportedInterfaceOrientations~ipad');
  });

  it('iPhone 은 세로 방향만 허용한다', () => {
    const orientations = mustMatch(
      infoPlist,
      /<key>UISupportedInterfaceOrientations<\/key>\s*<array>([\s\S]*?)<\/array>/,
      'Info.plist 의 UISupportedInterfaceOrientations',
    )[1];
    expect(
      [...orientations.matchAll(/<string>(\w+)<\/string>/g)].map(m => m[1]),
    ).toEqual(['UIInterfaceOrientationPortrait']);
  });
});
