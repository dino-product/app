import type { HostElement } from './touchTarget';

// 리스트 빈 상태(ListEmptyComponent) 검사용 테스트 헬퍼 (#196).
// jest 의 스크롤 뷰 목은 RCTScrollView > 내용 컨테이너(View) > [머리, 빈 상태] 순으로 그린다

/** 글이 든 리스트 빈 상태 자리: 리스트 내용 컨테이너 바로 아래 요소 */
export function listEmptyOf(message: HostElement): HostElement {
  let node = message;
  while (node.parent && node.parent.parent?.type !== 'RCTScrollView') {
    node = node.parent;
  }
  if (!node.parent) {
    throw new Error('리스트 안의 글이 아닙니다');
  }
  return node;
}

/** 요소 안의 글을 그린 순서대로 이어 붙인다 (children 이 여러 조각이어도 화면에 보이는 글 그대로) */
function textOf(node: HostElement | string): string {
  return typeof node === 'string' ? node : node.children.map(textOf).join('');
}

/** 아이콘으로 보는 요소: 디자인 시스템 Icon 이 그린 SVG 뷰(xml 을 받는다)와 이미지 */
const isIcon = (node: HostElement) =>
  node.props.xml !== undefined || node.type === 'Image';

/**
 * 리스트 빈 상태 자리에 아이콘 없이 안내 글 한 줄만 있는지 본다 (설명 글도 없다).
 * 아이콘은 Icon(SvgXml 의 xml)·Image 기준이다
 */
export function expectMessageOnly(message: HostElement) {
  const empty = listEmptyOf(message);
  expect(empty.queryAll(isIcon)).toHaveLength(0);
  expect(textOf(empty)).toBe(textOf(message));
}
