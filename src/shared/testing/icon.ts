import type { HostElement } from './touchTarget';

// 디자인 시스템 Icon 이 그린 SVG 검사용 테스트 헬퍼.
// Icon 은 감싸는 View 의 첫 자식으로 react-native-svg 의 네이티브 SVG 뷰를 두고, 그 뷰가 xml·color 를 받는다.

/** 아이콘 하나만 든 버튼 안의 SVG 뷰. props.xml 은 그린 마크업, props.color 는 currentColor 로 칠한 색이다 */
export function iconSvgIn(button: HostElement): HostElement {
  const icon = button.children[0];
  const svg = typeof icon === 'string' ? undefined : icon?.children[0];
  if (svg === undefined || typeof svg === 'string') {
    throw new Error('버튼 안에 아이콘 SVG 뷰가 없습니다');
  }
  return svg;
}
