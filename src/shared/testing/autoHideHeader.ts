import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { HostElement } from './touchTarget';

// 탭 첫 화면 상단 바 자동 숨김(#148)을 화면 테스트에서 확인하는 헬퍼.
// 숨김·다시 보임 애니메이션은 jest/nativeAnimation 의 holdNativeAnimations 로 붙잡았다가 끝낸다

/** 스크롤 뷰(높이 600, 내용 높이 2000)가 y 까지 스크롤된 이벤트를 보낸다 */
export const scrollListTo = (list: HostElement, y: number) =>
  fireEvent.scroll(list, {
    nativeEvent: {
      contentOffset: { x: 0, y },
      contentSize: { width: 390, height: 2000 },
      layoutMeasurement: { width: 390, height: 600 },
    },
  });

/** 맨 위에서 300 까지 아래로 스크롤한다 (상단 바가 숨는다) */
export async function scrollDownFromTop(list: HostElement) {
  for (const y of [0, 100, 200, 300]) {
    await scrollListTo(list, y);
  }
}

/** 리스트 위에 겹쳐 그린 머리(AutoHideHeaderLayout) */
export const autoHideHeader = () => screen.getByTestId('auto-hide-header');

/** 머리가 옮겨진 거리. 0 이면 보이고, 음수면 그만큼 위로 올라가 숨었다 */
export function autoHideHeaderOffset(): number | undefined {
  const transform = StyleSheet.flatten(autoHideHeader().props.style)
    .transform as { translateY?: number }[] | undefined;
  return transform?.find(item => item.translateY !== undefined)?.translateY;
}
