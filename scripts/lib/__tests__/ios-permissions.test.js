const fs = require('fs');
const path = require('path');
const { findBlankUsageDescriptions } = require('../ios-permissions');

const IOS_DIR = path.join(__dirname, '../../../ios');
// 서드파티(Pods)와 빌드 산출물은 우리 파일이 아니다
const IGNORED_DIRS = new Set(['Pods', 'build']);

function plist(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
${body}
</dict>
</plist>`;
}

// 앱 타깃 외에 위젯·확장 타깃이 생겨도 그 Info.plist 까지 검사한다
function findInfoPlists(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return IGNORED_DIRS.has(entry.name) ? [] : findInfoPlists(file);
    }
    return entry.name === 'Info.plist' ? [file] : [];
  });
}

describe('findBlankUsageDescriptions', () => {
  it('용도 문구가 채워져 있으면 빈 배열을 반환한다', () => {
    expect(
      findBlankUsageDescriptions(
        plist(`
  <key>NSCameraUsageDescription</key>
  <string>공룡 사진을 찍습니다.</string>`),
      ),
    ).toEqual([]);
  });

  it.each([
    ['빈 문자열', '<string></string>'],
    ['빈 태그', '<string/>'],
    ['공백뿐인 문자열', '<string>\n  </string>'],
    ['문자열이 아닌 값', '<true/>'],
    ['값 없음', ''],
  ])('빈 문구로 본다: %s', (_, value) => {
    expect(
      findBlankUsageDescriptions(
        plist(`
  <key>NSCameraUsageDescription</key>
  ${value}`),
      ),
    ).toEqual(['NSCameraUsageDescription']);
  });

  it('빈 문구인 키만 문서 순서대로 모두 반환한다', () => {
    expect(
      findBlankUsageDescriptions(
        plist(`
  <key>NSLocationWhenInUseUsageDescription</key>
  <string></string>
  <key>NSCameraUsageDescription</key>
  <string>공룡 사진을 찍습니다.</string>
  <key>NSMicrophoneUsageDescription</key>
  <string/>`),
      ),
    ).toEqual([
      'NSLocationWhenInUseUsageDescription',
      'NSMicrophoneUsageDescription',
    ]);
  });

  it('NS 로 시작하지 않는 권한 키와 장치 접미사(~ipad)가 붙은 키도 검사한다', () => {
    expect(
      findBlankUsageDescriptions(
        plist(`
  <key>NFCReaderUsageDescription</key>
  <string></string>
  <key>NSCameraUsageDescription~ipad</key>
  <string></string>`),
      ),
    ).toEqual(['NFCReaderUsageDescription', 'NSCameraUsageDescription~ipad']);
  });

  it('여는 태그 안에 공백이 있어도 채워진 문구로 본다', () => {
    expect(
      findBlankUsageDescriptions(
        plist(`
  <key>NSCameraUsageDescription</key>
  <string >공룡 사진을 찍습니다.</string>`),
      ),
    ).toEqual([]);
  });

  it('권한이 아닌 키와 주석 처리된 키는 무시한다', () => {
    expect(
      findBlankUsageDescriptions(
        plist(`
  <key>CFBundleSignature</key>
  <string></string>
  <!-- <key>NSCameraUsageDescription</key><string></string> -->`),
      ),
    ).toEqual([]);
  });
});

describe('ios/ 의 Info.plist', () => {
  const infoPlists = findInfoPlists(IOS_DIR).map(file =>
    path.relative(IOS_DIR, file),
  );

  it('앱 타깃 Info.plist 를 찾는다', () => {
    expect(infoPlists).toContain(path.join('DinoApp', 'Info.plist'));
  });

  it.each(infoPlists)(
    'ios/%s 의 모든 권한 용도 문구가 비어 있지 않다 (쓰지 않는 권한은 키를 지운다)',
    file => {
      const xml = fs.readFileSync(path.join(IOS_DIR, file), 'utf8');

      // binary plist 면 키를 하나도 읽지 못한 채 통과하므로 XML 인지 먼저 본다
      expect(xml).toMatch(/<plist[\s>]/);
      expect(findBlankUsageDescriptions(xml)).toEqual([]);
    },
  );
});
