// 권한 용도 문구가 비면 App Store 심사에서 지적받을 수 있다.
// 쓰지 않는 권한은 키를 지우고, 쓸 때는 용도를 구체적으로 적는다.

// NS…UsageDescription 에 더해 NFCReaderUsageDescription 처럼 NS 로 시작하지 않는 키까지
const USAGE_DESCRIPTION_PATTERN =
  /<key>\s*(?<key>\w+UsageDescription)\s*<\/key>\s*(?:<string>(?<text>[\s\S]*?)<\/string>)?/g;
const XML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

// 값이 비었거나 공백뿐이거나 문자열이 아닌(<string/>, <true/>, 없음) 권한 키 이름
function findBlankUsageDescriptions(plistXml) {
  const xml = plistXml.replace(XML_COMMENT_PATTERN, '');

  return [...xml.matchAll(USAGE_DESCRIPTION_PATTERN)]
    .filter(({ groups }) => (groups.text ?? '').trim() === '')
    .map(({ groups }) => groups.key);
}

module.exports = { findBlankUsageDescriptions };
