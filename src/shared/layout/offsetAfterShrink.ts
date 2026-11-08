/**
 * 스크롤 내용이 shrinkBy 만큼 줄어든 뒤의 스크롤 위치. 줄어든 끝을 넘으면 끝으로 당기고, 넘지 않으면 그대로다.
 * 스크롤 뷰는 내용이 줄면 이 위치로 한 번에 당겨지므로(뚝 끊김), 줄이기 전에 이 위치로 부드럽게 스크롤해 둘 때 쓴다
 */
export function offsetAfterShrink({
  scrollOffset,
  contentHeight,
  viewportHeight,
  shrinkBy,
}: {
  scrollOffset: number;
  contentHeight: number;
  viewportHeight: number;
  shrinkBy: number;
}) {
  return Math.min(
    scrollOffset,
    Math.max(0, contentHeight - shrinkBy - viewportHeight),
  );
}
