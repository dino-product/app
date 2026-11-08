#import "RCTKakaoMapView.h"

#import <react/renderer/components/DinoAppSpec/ComponentDescriptors.h>
#import <react/renderer/components/DinoAppSpec/EventEmitters.h>
#import <react/renderer/components/DinoAppSpec/Props.h>
#import <react/renderer/components/DinoAppSpec/RCTComponentViewHelpers.h>

#import "DinoApp-Swift.h"

using namespace facebook::react;

@interface RCTKakaoMapView () <RCTKakaoMapViewViewProtocol>
@end

@implementation RCTKakaoMapView {
  KakaoMapContainerView *_map;
}

// package.json codegenConfig.ios.componentProvider 가 이 클래스를 KakaoMapView 로 찾는다
+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<KakaoMapViewComponentDescriptor>();
}

// KakaoMapsSDK 는 뷰를 재사용하도록 만들어지지 않았다 (주의사항: 재사용 시 초기화되지 않게 해야 한다). 매번 새로 만들고 버린다
+ (BOOL)shouldBeRecycled
{
  return NO;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const KakaoMapViewProps>();
    _props = defaultProps;

    _map = [[KakaoMapContainerView alloc] initWithFrame:self.bounds];
    _map.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    __weak RCTKakaoMapView *weakSelf = self;
    _map.onReady = ^{
      [weakSelf emitReady];
    };
    _map.onError = ^(NSInteger code) {
      [weakSelf emitError:code];
    };
    self.contentView = _map;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &oldMapProps = *std::static_pointer_cast<const KakaoMapViewProps>(_props);
  const auto &newMapProps = *std::static_pointer_cast<const KakaoMapViewProps>(props);
  if (oldMapProps.latitude != newMapProps.latitude || oldMapProps.longitude != newMapProps.longitude ||
      oldMapProps.zoomLevel != newMapProps.zoomLevel) {
    [_map setCenterWithLatitude:newMapProps.latitude longitude:newMapProps.longitude zoomLevel:newMapProps.zoomLevel];
  }
  // 둥근 모서리는 RN 의 borderRadius·overflow 가 자른다 (cornerRadius·cornerMaskColor 는 Android SurfaceView 전용)
  [super updateProps:props oldProps:oldProps];
}

- (void)emitReady
{
  if (_eventEmitter) {
    std::static_pointer_cast<const KakaoMapViewEventEmitter>(_eventEmitter)
        ->onMapReady(KakaoMapViewEventEmitter::OnMapReady{});
  }
}

- (void)emitError:(NSInteger)code
{
  if (_eventEmitter) {
    KakaoMapViewEventEmitter::OnMapError event;
    event.code = static_cast<int>(code);
    std::static_pointer_cast<const KakaoMapViewEventEmitter>(_eventEmitter)->onMapError(event);
  }
}

- (void)dealloc
{
  [_map destroy];
}

@end
