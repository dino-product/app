const fs = require('fs');
const path = require('path');
const { findBlankUsageDescriptions } = require('../ios-permissions');

const INFO_PLIST = path.join(__dirname, '../../../ios/DinoApp/Info.plist');

function plist(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
${body}
</dict>
</plist>`;
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

  it('빈 문자열, 빈 태그, 공백뿐인 문구를 모두 잡는다', () => {
    expect(
      findBlankUsageDescriptions(
        plist(`
  <key>NSLocationWhenInUseUsageDescription</key>
  <string></string>
  <key>NSCameraUsageDescription</key>
  <string/>
  <key>NSMicrophoneUsageDescription</key>
  <string>
  </string>`),
      ),
    ).toEqual([
      'NSLocationWhenInUseUsageDescription',
      'NSCameraUsageDescription',
      'NSMicrophoneUsageDescription',
    ]);
  });

  it('값이 문자열이 아니거나 없으면 빈 문구로 본다', () => {
    expect(
      findBlankUsageDescriptions(
        plist(`
  <key>NSPhotoLibraryUsageDescription</key>
  <true/>
  <key>NSContactsUsageDescription</key>`),
      ),
    ).toEqual(['NSPhotoLibraryUsageDescription', 'NSContactsUsageDescription']);
  });

  it('NS 로 시작하지 않는 권한 키(NFCReaderUsageDescription)도 검사한다', () => {
    expect(
      findBlankUsageDescriptions(
        plist(`
  <key>NFCReaderUsageDescription</key>
  <string></string>`),
      ),
    ).toEqual(['NFCReaderUsageDescription']);
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

describe('ios/DinoApp/Info.plist', () => {
  it('모든 권한 용도 문구가 비어 있지 않다 (쓰지 않는 권한은 키를 지운다)', () => {
    const xml = fs.readFileSync(INFO_PLIST, 'utf8');

    expect(findBlankUsageDescriptions(xml)).toEqual([]);
  });
});
