#import <React/RCTViewComponentView.h>

NS_ASSUME_NONNULL_BEGIN

// 작업 위치 지도 Fabric 컴포넌트 (#67). JS 스펙: src/shared/native/KakaoMapViewNativeComponent.ts
// 지도는 KakaoMapContainerView(Swift, KakaoMapsSDK)가 그리고, 이 뷰는 props·이벤트·생명주기만 잇는다
@interface RCTKakaoMapView : RCTViewComponentView
@end

NS_ASSUME_NONNULL_END
