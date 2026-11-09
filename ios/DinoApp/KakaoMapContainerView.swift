import KakaoMapsSDK
import UIKit

/// 작업 위치 지도 (#67). 카카오맵 SDK v2(KakaoMapsSDK)로 좌표를 가운데에 둔 지도와 마커를 그린다.
/// Fabric 컴포넌트 RCTKakaoMapView(ObjC++)가 감싸 쓴다 (JS 스펙 src/shared/native/KakaoMapViewNativeComponent.ts).
///
/// - 움직이지 않는 표시용이라 제스처를 모두 끄고 터치도 받지 않는다 (스크롤·누르기는 RN 쪽이 받는다)
/// - SDK 초기화는 처음 지도를 그릴 때 한다 (콜드 스타트에 넣지 않는다). 앱 키는 카카오 로그인과 같은 Info.plist KAKAO_APP_KEY
/// - 생명주기는 자동이 아니다 (KakaoMapsSDK 주의사항): 창에 붙거나 앱이 활성일 때만 엔진을 켜고, 내려가면 resetEngine 으로 정리한다
///
/// ObjC 헤더(DinoApp-Swift.h)에 SDK 타입이 드러나지 않게, 공개 면은 기본 타입과 블록만 쓴다.
@objc public final class KakaoMapContainerView: UIView {
  /// 지도와 마커를 다 그렸다
  @objc public var onReady: (() -> Void)?
  /// 지도를 그리지 못했다. 카카오 인증 오류 코드(401 등), 앱 키 없음 -2, 그 밖 -1
  @objc public var onError: ((Int) -> Void)?

  private let engine = KakaoMapEngine()

  override public init(frame: CGRect) {
    super.init(frame: frame)
    isUserInteractionEnabled = false
    engine.attach(to: self)
  }

  @available(*, unavailable)
  public required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  /// 가운데 좌표와 줌. 처음이면 지도를 준비하고, 이미 그렸으면 가운데·마커만 옮긴다
  @objc public func setCenter(latitude: Double, longitude: Double, zoomLevel: Int) {
    engine.setCenter(latitude: latitude, longitude: longitude, zoomLevel: zoomLevel)
  }

  /// 뷰가 내려간다. 엔진을 멈추고 자원을 놓는다 (상세를 들락날락해도 메모리가 쌓이지 않게)
  @objc public func destroy() {
    engine.destroy()
  }

  override public func didMoveToWindow() {
    super.didMoveToWindow()
    engine.windowDidChange(attached: window != nil)
  }

  fileprivate func emitReady() {
    onReady?()
  }

  fileprivate func emitError(_ code: Int) {
    onError?(code)
  }
}

/// SDK 엔진과 이벤트 delegate. 공개 클래스와 떼어 두어 생성 헤더에 SDK 프로토콜이 나오지 않게 한다
private final class KakaoMapEngine: NSObject, MapControllerDelegate {
  private static let viewName = "mapview"
  private static let poiStyleID = "work-location-marker"
  private static let layerID = "work-location"
  /// Figma 마커(반투명 원 52 + 핀 48)에서 핀 끝 y 45.5 / 52. 핀 끝이 좌표를 가리킨다
  private static let markerAnchor = CGPoint(x: 0.5, y: 45.5 / 52)
  /// 앱 키가 없어 SDK 를 켜지 않았다
  private static let noAppKeyError = -2
  private static let unknownError = -1
  private static var sdkInitialized = false

  private weak var host: KakaoMapContainerView?
  private let container = KMViewContainer()
  private var controller: KMController?
  private var center: MapPoint?
  private var zoomLevel = 16
  private var poi: Poi?
  private var attached = false
  private var appActive = UIApplication.shared.applicationState == .active
  private var observing = false
  private var failed = false
  private var destroyed = false

  func attach(to host: KakaoMapContainerView) {
    self.host = host
    container.frame = host.bounds
    container.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    container.isUserInteractionEnabled = false
    host.addSubview(container)
  }

  func setCenter(latitude: Double, longitude: Double, zoomLevel: Int) {
    guard !destroyed else { return }
    let point = MapPoint(longitude: longitude, latitude: latitude)
    center = point
    self.zoomLevel = zoomLevel
    if let map = kakaoMap {
      map.moveCamera(CameraUpdate.make(target: point, zoomLevel: zoomLevel, mapView: map))
      poi?.position = point
      return
    }
    prepareIfNeeded()
  }

  func windowDidChange(attached: Bool) {
    self.attached = attached
    if attached {
      prepareIfNeeded()
    }
    updateRendering()
  }

  func destroy() {
    guard !destroyed else { return }
    destroyed = true
    stopObserving()
    poi = nil
    if let controller {
      controller.pauseEngine()
      controller.resetEngine()
      controller.delegate = nil
    }
    controller = nil
  }

  private var kakaoMap: KakaoMap? {
    controller?.getView(Self.viewName) as? KakaoMap
  }

  /// 좌표가 있고 창에 붙었을 때 한 번 SDK 를 켜고 엔진을 준비한다 (인증은 엔진이 알아서 한다)
  private func prepareIfNeeded() {
    guard !destroyed, !failed, controller == nil, center != nil, attached else { return }
    guard Self.initializeSdk() else {
      failed = true
      host?.emitError(Self.noAppKeyError)
      return
    }
    let controller = KMController(viewContainer: container)
    controller.delegate = self
    self.controller = controller
    startObserving()
    guard controller.prepareEngine() else {
      // 엔진을 준비하지 못했다. 불러오는 중으로 남지 않게 실패로 알린다
      fail(Self.unknownError)
      return
    }
    updateRendering()
  }

  /// 창에 붙어 있고 앱이 활성일 때만 그린다. 백그라운드·화면을 떠나면 렌더링을 멈춘다
  private func updateRendering() {
    guard let controller, !destroyed else { return }
    if attached && appActive {
      if !controller.isEngineActive {
        controller.activateEngine()
      }
    } else if controller.isEngineActive {
      controller.pauseEngine()
    }
  }

  private static func initializeSdk() -> Bool {
    if sdkInitialized {
      return true
    }
    // Info.plist KAKAO_APP_KEY = $(KAKAO_NATIVE_APP_KEY). Secrets.xcconfig 없이 만든 빌드는 빈 값이다
    let appKey =
      (Bundle.main.object(forInfoDictionaryKey: "KAKAO_APP_KEY") as? String)?
      .trimmingCharacters(in: .whitespaces) ?? ""
    guard !appKey.isEmpty else { return false }
    SDKInitializer.InitSDK(appKey: appKey)
    sdkInitialized = true
    return true
  }

  // MARK: 앱 활성 상태

  private func startObserving() {
    guard !observing else { return }
    observing = true
    let center = NotificationCenter.default
    center.addObserver(
      self, selector: #selector(willResignActive),
      name: UIApplication.willResignActiveNotification, object: nil)
    center.addObserver(
      self, selector: #selector(didBecomeActive),
      name: UIApplication.didBecomeActiveNotification, object: nil)
  }

  private func stopObserving() {
    guard observing else { return }
    observing = false
    NotificationCenter.default.removeObserver(self)
  }

  @objc private func willResignActive() {
    appActive = false
    updateRendering()
  }

  @objc private func didBecomeActive() {
    appActive = true
    updateRendering()
  }

  // MARK: MapControllerDelegate

  func addViews() {
    guard let center else { return }
    controller?.addView(
      MapviewInfo(
        viewName: Self.viewName, viewInfoName: "map", defaultPosition: center,
        defaultLevel: zoomLevel))
  }

  func addViewSucceeded(_ viewName: String, viewInfoName: String) {
    guard let map = kakaoMap, let center else { return }
    // 레이아웃이 addView 보다 먼저 끝나면 크기 변경을 받지 못하므로 여기서 다시 맞춘다 (KakaoMapsSDK View Controls)
    map.viewRect = container.bounds
    // 표시용: 이동·확대·축소·회전·기울이기 제스처를 모두 끈다
    let gestures: [GestureType] = [
      .doubleTapZoomIn, .twoFingerTapZoomOut, .pan, .rotate, .zoom, .tilt, .longTapAndDrag,
      .rotateZoom, .oneFingerZoom,
    ]
    for gesture in gestures {
      map.setGestureEnable(type: gesture, enable: false)
    }
    addMarker(on: map, at: center)
    host?.emitReady()
  }

  func addViewFailed(_ viewName: String, viewInfoName: String) {
    fail(Self.unknownError)
  }

  func containerDidResized(_ size: CGSize) {
    kakaoMap?.viewRect = CGRect(origin: .zero, size: size)
  }

  func authenticationFailed(_ errorCode: Int, desc: String) {
    // 키·번들 ID 미등록(401·403)이나 네트워크 오류(499). 다시 시도하지 않고 회색 자리로 둔다 (무한 재시도 금지)
    fail(errorCode)
  }

  private func fail(_ code: Int) {
    guard !failed, !destroyed else { return }
    failed = true
    host?.emitError(code)
  }

  private func addMarker(on map: KakaoMap, at point: MapPoint) {
    // KakaoMapsSDK 는 그림을 (화면 배율 / 2) 로 키워 그린다. 마커 그림은 52pt 를 2배(104px) 한 배율 하나짜리다
    guard let image = UIImage(named: "KakaoMapMarker") else { return }
    let manager = map.getLabelManager()
    let style = PoiStyle(
      styleID: Self.poiStyleID,
      styles: [
        PerLevelPoiStyle(
          iconStyle: PoiIconStyle(symbol: image, anchorPoint: Self.markerAnchor), level: 0)
      ])
    manager.addPoiStyle(style)
    let layer = manager.addLabelLayer(
      option: LabelLayerOptions(
        layerID: Self.layerID, competitionType: .none, competitionUnit: .poi, orderType: .rank,
        zOrder: 0))
    poi = layer?.addPoi(option: PoiOptions(styleID: Self.poiStyleID), at: point)
    poi?.show()
  }
}
