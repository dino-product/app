const fs = require('fs');
const path = require('path');

const INFO_PLIST = path.resolve(__dirname, '../../../ios/DinoApp/Info.plist');

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 주석을 걷어 낸 뒤 <key> 가 몇 번 나오는지와, 바로 뒤에 오는 <string> 값을 모두 모은다.
// 키가 두 번 들어가면 어느 값이 쓰일지 알 수 없으니 개수까지 확인한다.
function readPlistKey(xml, key) {
  const body = xml.replace(/<!--[\s\S]*?-->/g, '');
  const keyTag = `<key>${escapeRegExp(key)}</key>`;
  return {
    count: body.split(keyTag).length - 1,
    strings: [
      ...body.matchAll(
        new RegExp(`${keyTag}\\s*<string>([^<]*)</string>`, 'g'),
      ),
    ].map(match => match[1]),
  };
}

describe('iOS 외관 모드 (#20)', () => {
  const plist = fs.readFileSync(INFO_PLIST, 'utf8');

  it('다크 모드를 지원하지 않으므로 UIUserInterfaceStyle 을 Light 로 고정한다', () => {
    expect(readPlistKey(plist, 'UIUserInterfaceStyle')).toEqual({
      count: 1,
      strings: ['Light'],
    });
  });
});

describe('readPlistKey', () => {
  it('주석 안의 키는 세지 않는다', () => {
    expect(
      readPlistKey(
        '<!-- <key>A</key><string>Light</string> --><key>A</key><string>Dark</string>',
        'A',
      ),
    ).toEqual({ count: 1, strings: ['Dark'] });
  });

  it('같은 키가 두 번 있으면 둘 다 센다', () => {
    expect(
      readPlistKey(
        '<key>A</key><string>Light</string><key>A</key><string>Automatic</string>',
        'A',
      ),
    ).toEqual({ count: 2, strings: ['Light', 'Automatic'] });
  });

  it('키의 정규식 특수문자를 글자 그대로 찾는다', () => {
    expect(readPlistKey('<key>AxB</key><string>v</string>', 'A.B')).toEqual({
      count: 0,
      strings: [],
    });
  });
});
