import { memo, useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
} from 'react-native';
import { colors } from '../../../shared/design-system';
import KakaoMapView from '../../../shared/native/KakaoMapViewNativeComponent';
import type { GeoPoint } from '../model';

/**
 * 작업 위치 지도의 줌 레벨 (카카오맵 SDK v2, 클수록 확대). 현장 주변 1–2블록과 도로 이름이 보이는 정도로,
 * 16 에서 시작해 실기기에서 맞춘다 (#67)
 */
export const MAP_ZOOM_LEVEL = 16;

// Figma 작업 위치 지도 (작업 상세 3235:16283, 응답 필요 상세 3463:16691): 카드 폭 그대로, 높이 202, 모서리 10
const MAP_HEIGHT = 202;
const MAP_RADIUS = 10;

type LoadState = 'loading' | 'ready' | 'failed';

/**
 * 개발 빌드 경고에 붙일 점검할 곳 (#223). onMapError 의 code 출처는 셋이다
 * - 카카오 인증 응답 (두 플랫폼 공통): 400 요청 오류, 401 인증 오류, 403 권한 오류, 429 쿼터 초과
 * - 앱이 정한 값: iOS KakaoMapContainerView(-2 앱 키 없음, -1 엔진 준비·지도 뷰 추가 실패),
 *   Android KakaoMapContainer(-2 앱 키 없음·SDK·MapView 를 켜지 못함, -1 MapAuthException 이 아닌 오류)
 * - Android SDK MapAuthException 상수 (2.15.2): -1 UNKNOWN_ERROR, -2 CONNECT_INITIATE_FAILURE,
 *   -3 SOCKET_TIMEOUT_EXCEPTION, -4 CONNECT_TIMEOUT_EXCEPTION, 499 CONNECT_ERROR,
 *   1001 INITIALIZE_FAILURE, 1002 RENDER_VIEW_FAILURE, 1003 APP_KEY_INVALID_ERROR
 * Android 의 -1·-2 는 앱 값과 SDK 상수가 겹쳐 둘 다 적는다
 */
const AUTH_HINTS: Record<number, string> = {
  400: '인증 요청 오류 — 필수 파라미터',
  401: '인증 오류 — 앱 키와 카카오 디벨로퍼스 [앱] > [플랫폼 키] > [네이티브 앱 키] 의 iOS 번들 ID · Android 패키지·키 해시',
  403: '권한 오류 — 카카오 디벨로퍼스 [앱] > [제품 설정] > [카카오맵] 사용 설정',
  429: '쿼터 초과 — 카카오맵 API 사용량',
};
const IOS_HINTS: Record<number, string> = {
  [-2]: '앱 키가 비었다 — ios/Config/Secrets.xcconfig 의 KAKAO_NATIVE_APP_KEY',
  [-1]: '지도 엔진 준비 또는 지도 뷰 추가 실패',
};
const ANDROID_HINTS: Record<number, string> = {
  [-2]: '앱 키가 비었거나(~/.gradle/gradle.properties 의 KAKAO_NATIVE_APP_KEY) SDK·지도 뷰를 켜지 못했다(지원하지 않는 ABI 등), 또는 통신 연결 시작 실패(CONNECT_INITIATE_FAILURE)',
  [-1]: '원인 불명 (UNKNOWN_ERROR 또는 MapAuthException 이 아닌 오류)',
  [-3]: '통신 시간 초과 (SOCKET_TIMEOUT_EXCEPTION)',
  [-4]: '연결 시간 초과 (CONNECT_TIMEOUT_EXCEPTION)',
  499: '통신 실패 — 인터넷 연결 (CONNECT_ERROR)',
  1001: '지도 엔진 초기화 실패 (INITIALIZE_FAILURE)',
  1002: '지도 렌더 뷰 실패 (RENDER_VIEW_FAILURE)',
  1003: '앱 키가 올바르지 않다 — gradle.properties 의 KAKAO_NATIVE_APP_KEY 와 콘솔 네이티브 앱 키 (APP_KEY_INVALID_ERROR)',
};

function mapErrorHint(code: number): string {
  const platformHints = Platform.OS === 'android' ? ANDROID_HINTS : IOS_HINTS;
  return (
    AUTH_HINTS[code] ??
    platformHints[code] ??
    '알 수 없는 코드 — 기기 로그(iOS Console.app · Android logcat 의 KakaoMap)'
  );
}

/**
 * 작업 위치 카드의 지도. 서버 좌표를 가운데에 두고 마커를 찍은 카카오맵을 보여 준다 (움직이지 않는 표시용).
 * 누르면 카카오맵에서 그 위치를 연다 (onPress).
 * 좌표가 없으면 회색 자리만 두고, 불러오는 동안·실패하면 같은 크기의 회색 자리로 덮는다.
 */
export const WorkLocationMap = memo(function LocationMap({
  location,
  onPress,
}: {
  location: GeoPoint | null;
  onPress: () => void;
}) {
  const [load, setLoad] = useState<LoadState>('loading');
  const onMapReady = useCallback(() => setLoad('ready'), []);
  const onMapError = useCallback(
    (event: NativeSyntheticEvent<Readonly<{ code: number }>>) => {
      if (__DEV__) {
        const { code } = event.nativeEvent;
        console.warn(
          `[작업 위치 지도] 카카오맵을 그리지 못했다 (code ${code}): ${mapErrorHint(
            code,
          )}`,
        );
      }
      setLoad('failed');
    },
    [],
  );

  if (!location) {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.frame, styles.placeholder]}
        testID="work-location-map-placeholder"
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel="작업 위치 지도"
      accessibilityHint="카카오맵에서 위치를 엽니다"
      onPress={onPress}
      style={[styles.frame, Platform.OS === 'ios' && styles.clip]}
    >
      {load !== 'failed' && (
        <KakaoMapView
          // 제스처는 네이티브에서 끄고, 터치는 지도로 보내지 않는다 (스크롤·누르기는 바깥이 받는다)
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          latitude={location.latitude}
          longitude={location.longitude}
          zoomLevel={MAP_ZOOM_LEVEL}
          cornerRadius={MAP_RADIUS}
          cornerMaskColor={colors.white[100]}
          onMapReady={onMapReady}
          onMapError={onMapError}
          style={StyleSheet.absoluteFill}
          testID="work-location-native-map"
        />
      )}
      {load !== 'ready' && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.frameRadius,
            styles.placeholder,
          ]}
          testID="work-location-map-placeholder"
        />
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  frame: { height: MAP_HEIGHT, borderRadius: MAP_RADIUS },
  frameRadius: { borderRadius: MAP_RADIUS },
  // iOS 지도(Metal)는 부모의 둥근 모서리로 자른다. Android 지도는 SurfaceView 라 부모 자르기가 먹지 않아
  // 네이티브가 귀퉁이를 카드 배경색으로 덮는데(cornerMaskColor), 부모가 자르면 그 덮개까지 잘려 나가므로 자르지 않는다
  clip: { overflow: 'hidden' },
  // 지도 SDK 를 쓰기 전부터 있던 자리 색
  placeholder: { backgroundColor: colors.background[1] },
});
