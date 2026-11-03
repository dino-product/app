import type { HostElement } from './touchTarget';

/** 스크롤 뷰(ScrollView·FlatList) 안에 그려지는지. 밖에 있으면 내용을 스크롤해도 움직이지 않는다 */
export function isInsideScrollView(element: HostElement): boolean {
  for (let node = element.parent; node; node = node.parent) {
    if (node.type === 'RCTScrollView') {
      return true;
    }
  }
  return false;
}
