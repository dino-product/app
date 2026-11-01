// 앱은 자체 암호화 없이 OS 가 제공하는 HTTPS 만 쓴다 → 수출 규정 면제.
// 이 키가 없으면 TestFlight 빌드마다 App Store Connect 에서 수출 규정 질문에 답해야 테스터에게 배포된다 (#50)
const fs = require('fs');
const path = require('path');

const infoPlist = fs
  .readFileSync(
    path.resolve(__dirname, '../../../ios/DinoApp/Info.plist'),
    'utf8',
  )
  .replace(/<!--[\s\S]*?-->/g, '');

describe('iOS 수출 규정 (#50)', () => {
  it('ITSAppUsesNonExemptEncryption 을 false 로 한 번만 선언한다', () => {
    const values = [
      ...infoPlist.matchAll(
        /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<(true|false)\s*\/>/g,
      ),
    ].map(match => match[1]);

    expect(values).toEqual(['false']);
    expect(
      infoPlist.split('<key>ITSAppUsesNonExemptEncryption</key>'),
    ).toHaveLength(2);
  });
});
