import { Platform } from 'react-native';
import GestureExclusionView from './GestureExclusionViewNativeComponent';
import { gestureExclusionStyle } from './gestureExclusion';

/**
 * Android 제스처 내비게이션에서 이 자리의 가장자리 밀기를 시스템 뒤로 가기 대신 앱이 받게 한다.
 * 가로로 미는 뷰(useHorizontalSwipe) 안, 누르는 칸들보다 트리 순서상 앞에 둔다 (첫 자식이 가장 간단하다).
 * 바깥 여백까지 넓힌 자리의 터치도 그 뷰의 밀기 핸들러로 올라가고, 뒤에 오는 칸이 이 영역보다 먼저 터치를 받는다.
 * 시스템 상한(200dp)은 창의 한쪽 가장자리마다 합친 값이라 한 화면에 하나만 둔다.
 * iOS 는 탭 첫 화면에 가장자리 뒤로 가기가 없어 그리지 않는다.
 */
export function GestureExclusionArea(props: {
  /** 부모가 화면 가장자리에서 들어간 거리. 이만큼 좌우 바깥까지 넓힌다 */
  edgeInset: number;
  /** 부모 안에서 띠가 시작하는 위치 (dp). 기본 0 */
  top?: number;
  /** 띠 높이 (dp). 빼면 부모 아래 끝까지 (둘 다 200dp 까지) */
  height?: number;
}) {
  if (Platform.OS !== 'android') {
    return null;
  }
  return (
    <GestureExclusionView
      testID="gesture-exclusion"
      style={gestureExclusionStyle(props)}
    />
  );
}
