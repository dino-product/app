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

/** 리스트 빈 상태 자리에 아이콘(SVG) 없이 안내 글 한 줄만 있는지 본다 (설명 글도 없다) */
export function expectMessageOnly(message: HostElement) {
  const empty = listEmptyOf(message);
  expect(empty.queryAll(node => node.props.xml !== undefined)).toHaveLength(0);
  expect(empty).toHaveTextContent(String(message.props.children), {
    exact: true,
  });
}
