import { Platform, type TextStyle } from 'react-native';
import { typography, type TypographyVariant } from './typography';

// 한 줄 입력(multiline 이 아닌 TextInput)의 글자 스타일. 값·플레이스홀더를 입력칸 높이 안 세로 가운데에 둔다 (#151).
// 칸 높이는 입력(또는 입력이 채우는 칸)의 height·minHeight 에 Figma 값을 주고, 글자는 네이티브가 그 안 가운데에 그린다.
// - 줄 높이를 두지 않는다. iOS TextInput 은 줄 높이를 문단 최소·최대 줄 높이로만 넣고 Text 처럼 기준선을 옮기지 않아,
//   늘어난 만큼이 글자 위에 붙어 글자가 가운데에서 아래로 내려간다. 한 줄이라 줄 높이가 필요 없다
// - 세로 여백 0. 세로 여백을 주지 않으면 Android 는 EditText 테마의 기본 여백을 넣는다
// - Android 는 글꼴 위아래 여백(includeFontPadding)을 빼고 세로 가운데 정렬을 명시한다
// 여러 줄 입력(TextArea 등)은 위에서부터 쓰므로 이 규칙을 쓰지 않는다
const platformCentering: TextStyle = Platform.select({
  android: { includeFontPadding: false, textAlignVertical: 'center' },
  default: {},
});

export function singleLineInputText(variant: TypographyVariant): TextStyle {
  const { fontFamily, fontSize, letterSpacing } = typography[variant];
  return {
    fontFamily,
    fontSize,
    letterSpacing,
    paddingVertical: 0,
    ...platformCentering,
  };
}
