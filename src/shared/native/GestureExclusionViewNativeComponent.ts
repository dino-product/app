import type { ViewProps } from 'react-native';
import { codegenNativeComponent } from 'react-native';

// Android 전용 네이티브 뷰 (android/.../gestureexclusion). 자기 영역 중 화면에 보이는 부분을
// 시스템 제스처(가장자리 뒤로 가기) 제외 영역으로 둔다. iOS 구현은 없으니 Android 에서만 그린다.
interface NativeProps extends ViewProps {}

export default codegenNativeComponent<NativeProps>('GestureExclusionView', {
  excludedPlatforms: ['iOS'],
});
