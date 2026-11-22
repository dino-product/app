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
 * 개발 빌드 경고에 붙일 점검할 곳 (#223). 코드는 네이티브가 보낸 값: 앱 키 없음 -2, 그 밖 -1,
 * 나머지는 카카오 인증 응답 (카카오맵 SDK v2 인증 오류 — 401 인증 오류, 403 권한 오류, 429 쿼터 초과)
 */
function mapErrorHint(code: number): string {
  switch (code) {
    case -2:
      return '앱 키가 비었다 — iOS ios/Config/Secrets.xcconfig, Android ~/.gradle/gradle.properties 의 KAKAO_NATIVE_APP_KEY';
    case 401:
      return '인증 오류 — 카카오 디벨로퍼스 [앱] > [플랫폼 키] > [네이티브 앱 키] 의 iOS 번들 ID · Android 패키지·키 해시';
    case 403:
      return '권한 오류 — 카카오 디벨로퍼스 [앱] > [제품 설정] > [카카오맵] 사용 설정';
    case 429:
      return '쿼터 초과 — 카카오맵 API 사용량';
    default:
      return '네트워크·엔진 오류 — 기기 로그(iOS Console.app KakaoMap, Android logcat KakaoMap)';
  }
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
