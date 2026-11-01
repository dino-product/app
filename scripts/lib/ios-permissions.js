// 빈 권한 용도 문구는 App Store 심사에서 지적받을 수 있다. 쓰지 않는 권한은 키를 지운다.
// Info.plist XML 의 문자열 값만 본다. InfoPlist.strings 현지화, INFOPLIST_KEY_* 빌드 설정,
// 딕셔너리 값을 갖는 키(NSLocationTemporaryUsageDescriptionDictionary 등)는 검사하지 않는다.

// NFCReaderUsageDescription 처럼 NS 로 시작하지 않는 권한 키와 ~ipad 같은 장치 접미사도 잡는다.
const USAGE_DESCRIPTION_PATTERN =
  /<key>\s*(?<key>\w+UsageDescription(?:~\w+)?)\s*<\/key>\s*(?:<string\s*>(?<text>[\s\S]*?)<\/string>)?/g;
const XML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

// 값이 비었거나 공백뿐이거나 문자열이 아닌(<string/>, <true/>, 없음) 권한 키 이름
function findBlankUsageDescriptions(plistXml) {
  const xml = plistXml.replace(XML_COMMENT_PATTERN, '');

  return [...xml.matchAll(USAGE_DESCRIPTION_PATTERN)]
    .filter(({ groups }) => (groups.text ?? '').trim() === '')
    .map(({ groups }) => groups.key);
}

module.exports = { findBlankUsageDescriptions };
