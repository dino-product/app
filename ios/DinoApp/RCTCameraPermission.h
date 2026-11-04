#import <DinoAppSpec/DinoAppSpec.h>

NS_ASSUME_NONNULL_BEGIN

// 카메라 권한 상태를 읽고 묻는 앱 TurboModule (#111). JS 스펙: src/shared/native/NativeCameraPermissionIOS.ts
// react-native-image-picker 8.3.0 iOS 는 권한을 확인하지 않고 카메라를 띄워, 거부 상태를 앱이 먼저 알아야 안내할 수 있다
@interface RCTCameraPermission : NSObject <NativeCameraPermissionIOSSpec>
@end

NS_ASSUME_NONNULL_END
