import { fireEvent, screen } from '@testing-library/react-native';

// native-stack 은 화면(react-native-screens RNSScreen)이 나타나는 전환을 마치면 그 화면에 transitionEnd 를 보낸다 (onAppear).
// 테스트에는 네이티브 전환이 없어 이 이벤트가 오지 않으므로, 전환이 끝난 순간을 테스트가 정한다

type Element = ReturnType<typeof screen.getByText>;

/** element 를 담은 native-stack 화면들. 안쪽 스택의 화면부터 루트 스택의 화면 순서 */
function stackScreensOf(element: Element) {
  const screens: Element[] = [];
  for (let node: Element | null = element; node; node = node.parent) {
    if (node.type === 'RNSScreen' && node.props.onAppear) {
      screens.push(node);
    }
  }
  return screens;
}

/**
 * 위 화면이 닫히며 element 를 담은 화면이 다시 보이는 전환을 마친 것으로 한다.
 * stack: 닫힌 화면이 있던 스택. 'root' 는 루트 스택(마이 › QR 코드 인식처럼 탭 밖 화면), 'inner' 는 element 에 가장 가까운 스택
 */
export function finishReturnTo(element: Element, stack: 'inner' | 'root') {
  const screens = stackScreensOf(element);
  const target = stack === 'inner' ? screens[0] : screens[screens.length - 1];
  if (!target) {
    throw new Error('element 를 담은 native-stack 화면이 없다');
  }
  return fireEvent(target, 'appear');
}
