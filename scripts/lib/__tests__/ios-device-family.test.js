// #23 결정: iPhone 전용. 화면이 iPhone 세로(Figma) 기준으로만 만들어져 있다.
const fs = require('fs');
const path = require('path');

const iosDir = path.join(__dirname, '..', '..', '..', 'ios');
const pbxproj = fs.readFileSync(
  path.join(iosDir, 'DinoApp.xcodeproj', 'project.pbxproj'),
  'utf8',
);
const infoPlist = fs.readFileSync(
  path.join(iosDir, 'DinoApp', 'Info.plist'),
  'utf8',
);

// pbxproj 에서 `<id> /* ... */ = { ... };` 객체 본문을 찾는다. 들여쓰기가 탭 두 칸인 최상위 객체만 대상이다.
function objectBody(id) {
  const match = pbxproj.match(
    new RegExp(
      `\\n\\t\\t${id} (?:/\\*[^*]*\\*/ )?= \\{([\\s\\S]*?)\\n\\t\\t\\};`,
    ),
  );
  if (!match) {
    throw new Error(`pbxproj 에 객체 ${id} 가 없다`);
  }
  return match[1];
}

function appTargetBuildConfigurations() {
  const target = pbxproj
    .match(
      /\n\t\t[0-9A-F]{24} \/\* [^*]+ \*\/ = \{\n\t\t\tisa = PBXNativeTarget;[\s\S]*?\n\t\t\};/g,
    )
    ?.find(body => body.includes('"com.apple.product-type.application"'));
  if (!target) {
    throw new Error('pbxproj 에 앱 타깃이 없다');
  }
  const listId = target.match(/buildConfigurationList = ([0-9A-F]{24})/)[1];
  const configIds = [
    ...objectBody(listId)
      .match(/buildConfigurations = \(([\s\S]*?)\);/)[1]
      .matchAll(/([0-9A-F]{24})/g),
  ].map(([id]) => id);

  return configIds.map(id => {
    const body = objectBody(id);
    return {
      name: body.match(/\n\t\t\tname = (\w+);/)[1],
      deviceFamily: body.match(/TARGETED_DEVICE_FAMILY = ([^;]+);/)?.[1],
    };
  });
}

describe('iOS 지원 기기 (#23 iPhone 전용)', () => {
  it('앱 타깃은 Debug·Release 모두 iPhone(1) 으로만 빌드한다', () => {
    expect(appTargetBuildConfigurations()).toEqual([
      { name: 'Debug', deviceFamily: '1' },
      { name: 'Release', deviceFamily: '1' },
    ]);
  });

  it('Info.plist 에 iPad 전용 방향 키가 없다', () => {
    expect(infoPlist).not.toContain(
      '<key>UISupportedInterfaceOrientations~ipad</key>',
    );
  });

  it('iPhone 은 세로 방향만 허용한다', () => {
    const orientations = infoPlist.match(
      /<key>UISupportedInterfaceOrientations<\/key>\s*<array>([\s\S]*?)<\/array>/,
    )[1];
    expect(
      [...orientations.matchAll(/<string>(\w+)<\/string>/g)].map(m => m[1]),
    ).toEqual(['UIInterfaceOrientationPortrait']);
  });
});
