import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// iOS 전용 앱 TurboModule (ios/DinoApp/RCTCameraPermission.mm). 카메라 권한 상태를 읽고 시스템 대화상자로 묻는다.
// react-native-image-picker 8.3.0 iOS 는 권한을 확인하지 않고 카메라를 띄워, 거부한 사용자에게 앱이 안내할 수 없다 (#111).
// 이름이 IOS 로 끝나 codegen 이 Android 스펙을 만들지 않는다. Android 는 PermissionsAndroid 를 쓴다
export interface Spec extends TurboModule {
  /** AVCaptureDevice 카메라 권한: 'granted' | 'denied' | 'restricted' | 'not-determined' */
  getStatus(): string;
  /** 시스템 권한 대화상자를 띄우고 허용 여부를 돌려준다. 이미 정해졌으면 묻지 않고 그 값이다 */
  request(): Promise<boolean>;
}

// 네이티브 모듈이 없는 빌드(Android, 테스트)에서는 null 이다
export default TurboModuleRegistry.get<Spec>('CameraPermissionIOS');
