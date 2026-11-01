import { fireEvent, screen } from '@testing-library/react-native';

// 두 손가락 Z: VoiceOver 는 포커스한 요소에서 위로 올라가며 escape 를 받는 뷰를 찾는다.
// 모달 내용은 따로 띄운 뷰 계층이라 Modal 위(가린 화면)로는 올라가지 않고, Modal 자신도 escape 를 받지 않는다
export function escapeTarget(title: string) {
  for (
    let node = screen.getByRole('header', { name: title }).parent;
    node && node.type !== 'Modal';
    node = node.parent
  ) {
    if (node.props.onAccessibilityEscape) {
      return node;
    }
  }
  return null;
}

// RN 의 escape 이벤트는 버블링하지 않으므로 받는 뷰에 직접 보낸다
export function escapeFrom(title: string) {
  const target = escapeTarget(title);
  if (!target) {
    throw new Error(`"${title}" 에서 escape 를 받는 뷰가 없다`);
  }
  return fireEvent(target, 'accessibilityEscape');
}
