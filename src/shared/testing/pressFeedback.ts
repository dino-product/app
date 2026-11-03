import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { pressIn, pressOut } from './press';
import type { HostElement } from './touchTarget';

const flat = (element: HostElement) =>
  StyleSheet.flatten(element.props.style as StyleProp<ViewStyle>) ?? {};

/**
 * 누르고 있는 동안 배경만 pressedColor 로 바뀌고 손을 떼면 돌아오는지 확인한다 (#102).
 * 눌림 표시로 행 크기·레이아웃이 바뀌지 않도록 배경 말고 다른 스타일은 그대로여야 한다
 */
export async function expectPressedBackground(
  element: HostElement,
  pressedColor: string,
) {
  const idle = flat(element);
  expect(idle.backgroundColor).not.toBe(pressedColor);

  await pressIn(element);
  const pressed = flat(element);
  expect(pressed.backgroundColor).toBe(pressedColor);
  expect({ ...pressed, backgroundColor: undefined }).toEqual({
    ...idle,
    backgroundColor: undefined,
  });

  await pressOut(element);
  expect(flat(element)).toEqual(idle);
}
