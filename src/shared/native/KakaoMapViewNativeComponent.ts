import type { CodegenTypes, ColorValue, ViewProps } from 'react-native';
import { codegenNativeComponent } from 'react-native';

// 카카오맵 SDK v2 지도 뷰를 감싼 앱 네이티브 뷰 (#67).
// iOS: ios/DinoApp/RCTKakaoMapView.mm + KakaoMapContainerView.swift (KakaoMapsSDK), Android: android/.../kakaomap (com.kakao.maps.open:android).
// 움직이지 않는 표시용이다: 좌표를 가운데에 두고 그 자리에 마커를 찍는다. 이동·확대·회전 제스처는 네이티브에서 모두 끄고
// 터치도 받지 않아, 지도 위에서 끌어도 화면이 세로로 스크롤되고 누르기는 감싼 JS 가 받는다.
// 앱 키는 카카오 로그인과 같은 네이티브 앱 키(iOS Info.plist KAKAO_APP_KEY, Android 리소스 kakao_app_key)를 쓴다.
// 키가 없거나 인증·네트워크·엔진 오류면 onMapError 를 보낸다
interface NativeProps extends ViewProps {
  /** 가운데 좌표 (WGS84) */
  latitude: CodegenTypes.Double;
  longitude: CodegenTypes.Double;
  /** 카카오맵 SDK v2 줌 레벨 (클수록 확대) */
  zoomLevel: CodegenTypes.Int32;
  /**
   * Android 전용. 지도는 SurfaceView 라 부모의 둥근 모서리 자르기가 먹지 않는다.
   * 이 반지름 바깥 네 귀퉁이를 cornerMaskColor 로 덮는다 (iOS 는 borderRadius·overflow 로 자른다)
   */
  cornerRadius?: CodegenTypes.WithDefault<CodegenTypes.Float, 0>;
  cornerMaskColor?: ColorValue;
  /** 지도와 마커를 다 그렸다 */
  onMapReady?: CodegenTypes.DirectEventHandler<Readonly<{}>>;
  /** 지도를 그리지 못했다. code: 카카오 인증 오류 코드(401 등), 없으면 -1 */
  onMapError?: CodegenTypes.DirectEventHandler<
    Readonly<{ code: CodegenTypes.Int32 }>
  >;
}

export default codegenNativeComponent<NativeProps>('KakaoMapView');
