// 앱은 자체 암호화 없이 OS 가 제공하는 HTTPS 만 쓴다 → 수출 규정 면제.
// 이 키가 없으면 TestFlight 빌드마다 App Store Connect 에서 수출 규정 질문에 답해야 테스터에게 배포된다 (#50)
const fs = require('fs');
const path = require('path');

const KEY = '<key>ITSAppUsesNonExemptEncryption</key>';

const infoPlist = fs
  .readFileSync(
    path.resolve(__dirname, '../../../ios/DinoApp/Info.plist'),
    'utf8',
  )
  .replace(/<!--[\s\S]*?-->/g, '');

// 최상위 <dict> 의 본문에서 안쪽 <dict>(NSAppTransportSecurity 등)를 걷어 낸다.
// 키가 안쪽 dict 에 들어가 있으면 iOS 가 읽지 않으므로 최상위에서만 찾는다
function topLevelDict(xml) {
  let body = xml.slice(
    xml.indexOf('<dict>') + '<dict>'.length,
    xml.lastIndexOf('</dict>'),
  );
  const innermost = /<dict>(?:(?!<dict>)[\s\S])*?<\/dict>/;
  while (innermost.test(body)) {
    body = body.replace(innermost, '');
  }
  return body;
}

describe('iOS 수출 규정 (#50)', () => {
  it('ITSAppUsesNonExemptEncryption 을 최상위에 false 로 한 번만 선언한다', () => {
    const values = [
      ...topLevelDict(infoPlist).matchAll(
        /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<(true|false)\s*\/>/g,
      ),
    ].map(match => match[1]);

    expect(values).toEqual(['false']);
    // 불리언이 아닌 값(<string>NO</string> 등)으로 한 번 더 들어간 키도 잡는다
    expect(infoPlist.split(KEY)).toHaveLength(2);
  });
});
