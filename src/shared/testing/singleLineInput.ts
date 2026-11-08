import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { singleLineInputText } from '../design-system/tokens/singleLineInput';
import type { TypographyVariant } from '../design-system/tokens/typography';
import type { HostElement } from './touchTarget';

/**
 * 한 줄 입력이 공용 규칙(singleLineInputText)대로 값·플레이스홀더를 칸 세로 가운데에 두는지 확인한다 (#151).
 * 테스트 렌더러에는 레이아웃이 없어 펼친 스타일로 본다. 규칙 값 자체(줄 높이 없음·여백 0·Android 정렬)는
 * singleLineInput.touch.test 가 숫자로 고정하고, 여기서는 각 입력이 그 규칙을 쓰는지만 본다.
 * 줄 높이나 위아래 여백이 따로 있으면 규칙을 덮어 글자가 가운데에서 벗어나므로 없어야 한다
 */
export function expectCenteredSingleLineInput(
  input: HostElement,
  variant: TypographyVariant,
) {
  expect(input).not.toHaveProp('multiline', true);
  const style =
    StyleSheet.flatten(input.props.style as StyleProp<TextStyle>) ?? {};
  expect(style).toMatchObject(singleLineInputText(variant));
  for (const key of [
    'lineHeight',
    'padding',
    'paddingTop',
    'paddingBottom',
  ] as const) {
    expect(style).not.toHaveProperty(key);
  }
}
