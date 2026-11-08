/**
 * 스크롤 안의 대상(입력칸 등)이 아래 끝까지 키보드 윗변 위에 보이게 하는 스크롤 위치.
 * 이미 보이면 지금 위치를 그대로 돌려준다.
 *
 * - 화면 기준(창 좌표): viewportTop(스크롤 영역 윗변), keyboardTop(키보드 윗변, 이벤트의 endCoordinates.screenY)
 * - 내용 기준(내용 맨 위가 0): scrollOffset, targetTop, targetBottom
 *
 * 키보드가 가린 높이는 키보드 윗변으로 잰다. 스크롤 영역 중 키보드 위에 남는 높이만 보인다.
 * iOS 는 스크롤 영역이 그대로이고 automaticallyAdjustKeyboardInsets 가 아래 인셋을 넣고,
 * Android 는 KeyboardAvoidingArea 가 스크롤 영역을 줄이지만, 어느 쪽이든 보이는 높이는 같다.
 * 대상이 보이는 높이보다 크면 윗변부터 보인다.
 */
export function offsetToRevealAboveKeyboard({
  scrollOffset,
  viewportTop,
  viewportHeight,
  keyboardTop,
  targetTop,
  targetBottom,
  gap,
}: {
  scrollOffset: number;
  viewportTop: number;
  viewportHeight: number;
  keyboardTop: number;
  targetTop: number;
  targetBottom: number;
  /** 대상 아래 끝과 키보드 사이에 남길 여백 */
  gap: number;
}) {
  const visibleHeight = Math.min(
    viewportHeight,
    Math.max(0, keyboardTop - viewportTop),
  );
  const bottom = targetBottom + gap;
  if (bottom - targetTop > visibleHeight || targetTop < scrollOffset) {
    return Math.max(0, targetTop);
  }
  if (bottom > scrollOffset + visibleHeight) {
    return bottom - visibleHeight;
  }
  return scrollOffset;
}
