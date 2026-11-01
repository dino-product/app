const fs = require('fs');
const path = require('path');

const INFO_PLIST = path.resolve(__dirname, '../../../ios/DinoApp/Info.plist');

// <key> 바로 뒤에 오는 <string> 값. 키가 없거나 값이 문자열이 아니면 undefined.
function readPlistString(xml, key) {
  const match = xml.match(
    new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`),
  );
  return match?.[1];
}

describe('iOS 외관 모드 (#20)', () => {
  const plist = fs.readFileSync(INFO_PLIST, 'utf8');

  it('다크 모드를 지원하지 않으므로 UIUserInterfaceStyle 을 Light 로 고정한다', () => {
    expect(readPlistString(plist, 'UIUserInterfaceStyle')).toBe('Light');
  });
});
