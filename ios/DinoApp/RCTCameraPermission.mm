#import "RCTCameraPermission.h"

#import <AVFoundation/AVFoundation.h>

@implementation RCTCameraPermission

// package.json codegenConfig.ios.modulesProvider 가 이 이름으로 이 클래스를 찾는다
+ (NSString *)moduleName
{
  return @"CameraPermissionIOS";
}

// JS(src/features/work/photoPicker.ts)가 이 문자열로 갈래를 나눈다
- (NSString *)getStatus
{
  switch ([AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeVideo]) {
    case AVAuthorizationStatusAuthorized:
      return @"granted";
    case AVAuthorizationStatusDenied:
      return @"denied";
    case AVAuthorizationStatusRestricted:
      return @"restricted";
    case AVAuthorizationStatusNotDetermined:
    default:
      return @"not-determined";
  }
}

// 정해지지 않았으면 시스템 대화상자를 띄운다 (Info.plist NSCameraUsageDescription). 이미 정해졌으면 묻지 않고 그 값이다.
// 완료 블록은 임의의 큐에서 불리므로 결과만 넘기고 안내 UI 는 JS 가 띄운다
- (void)request:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [AVCaptureDevice requestAccessForMediaType:AVMediaTypeVideo
                           completionHandler:^(BOOL granted) {
                             resolve(@(granted));
                           }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeCameraPermissionIOSSpecJSI>(params);
}

@end
