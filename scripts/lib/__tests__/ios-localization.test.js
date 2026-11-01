// iOS 는 앱이 선언한 언어 중에서 앱 안 시스템 UI(편집 메뉴, 알림 기본 버튼 등)의 언어를 고른다.
// 앱 문구는 JS 코드에 한국어로 있고 .lproj 가 없으므로, 지역 설정으로 ko 를 선언해야 한다.
const fs = require('fs');
const path = require('path');

const iosDir = path.resolve(__dirname, '..', '..', '..', 'ios');
const infoPlist = fs.readFileSync(
  path.join(iosDir, 'DinoApp', 'Info.plist'),
  'utf8',
);
const pbxproj = fs.readFileSync(
  path.join(iosDir, 'DinoApp.xcodeproj', 'project.pbxproj'),
  'utf8',
);

function plistString(key) {
  const pattern = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`);
  return infoPlist.match(pattern)?.[1];
}

function plistStringArray(key) {
  const pattern = new RegExp(
    `<key>${key}</key>\\s*<array>([\\s\\S]*?)</array>`,
  );
  const body = infoPlist.match(pattern)?.[1];
  return (
    body && [...body.matchAll(/<string>([^<]*)<\/string>/g)].map(m => m[1])
  );
}

function pbxValue(key) {
  return pbxproj.match(new RegExp(`\\b${key} = ([^;]+);`))?.[1];
}

function pbxList(key) {
  const body = pbxproj.match(new RegExp(`\\b${key} = \\(([^)]*)\\);`))?.[1];
  return body
    ?.split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

describe('Info.plist 지역 설정', () => {
  it('개발 지역이 ko 다', () => {
    expect(plistString('CFBundleDevelopmentRegion')).toBe('ko');
  });

  it('코드로 처리하는 현지화로 ko 만 선언한다 (영어는 지원하지 않는다)', () => {
    expect(plistStringArray('CFBundleLocalizations')).toEqual(['ko']);
  });
});

describe('project.pbxproj 지역 설정', () => {
  it('개발 지역이 ko 다', () => {
    expect(pbxValue('developmentRegion')).toBe('ko');
  });

  it('knownRegions 에 ko 가 있고 en 은 없다', () => {
    const regions = pbxList('knownRegions');
    expect(regions).toContain('ko');
    expect(regions).not.toContain('en');
  });
});
