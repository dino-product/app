import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SKELETON_LABEL } from '../design-system';
import type { HostElement } from './touchTarget';

/**
 * 받는 동안 '불러오는 중' 으로 읽히는 것이 그 자리들의 스켈레톤뿐인지 본다 (#139).
 * 예전 스피너(ActivityIndicator)도 '불러오는 중' 으로 읽혔으므로, 이것이 맞으면 스피너는 없다
 */
export function expectOnlySkeletons(...testIDs: string[]) {
  expect(screen.getAllByLabelText(SKELETON_LABEL)).toEqual(
    testIDs.map(testID => screen.getByTestId(testID)),
  );
}

const BOX_KEYS = [
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'paddingTop',
  'paddingBottom',
  'gap',
  'borderRadius',
  'borderWidth',
  'borderBottomWidth',
] as const;

/**
 * 높이를 정하는 상자 값(여백·간격·모서리·테두리 두께)만 뽑는다. 스켈레톤이 실제 카드와 같은 상자를 쓰는지 견줄 때 쓴다.
 * 줄 높이는 SkeletonLine 이 글자 스타일의 줄 높이를 쓰는 것으로 맞춘다 (Skeleton.test)
 */
export function boxOf(element: HostElement) {
  const style = StyleSheet.flatten(element.props.style) ?? {};
  return Object.fromEntries(
    BOX_KEYS.filter(key => style[key] !== undefined).map(key => [
      key,
      style[key],
    ]),
  );
}
