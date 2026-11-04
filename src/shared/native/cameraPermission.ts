import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import CameraPermissionIOS from './NativeCameraPermissionIOS';

// 카메라 권한. 완료 보고 사진 촬영(#111)과 회사 찾기 QR 인식(#108)이 같이 쓴다.
// 안내 문구는 기획 확인 전 기본안이다 (Figma 에 없는 시스템 UI)

/**
 * 카메라를 써도 되는지. 아직 정하지 않았으면 시스템 대화상자로 묻는다.
 * Android 는 매니페스트에 선언한 CAMERA 를 런타임으로 받는다 (거부·다시 묻지 않음이면 false).
 * iOS 는 앱 모듈(NativeCameraPermissionIOS)로 상태를 먼저 보고, 정해지지 않았을 때만 묻는다 (NSCameraUsageDescription).
 * 모듈이 없는 빌드면 카메라가 열릴 때 시스템에 맡긴다
 */
export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  if (!CameraPermissionIOS) {
    return true;
  }
  const status = CameraPermissionIOS.getStatus();
  if (status === 'not-determined') {
    return CameraPermissionIOS.request();
  }
  return status !== 'denied' && status !== 'restricted';
}

/**
 * 거부했거나 '다시 묻지 않음'(iOS 는 거부·제한)이면 앱이 다시 물을 수 없어 설정으로 보낸다.
 * message 는 카메라로 하려는 일과 설정에서 허용하라는 안내다
 */
export function showCameraPermissionGuide(message: string) {
  Alert.alert('카메라 권한이 필요해요', message, [
    { text: '닫기', style: 'cancel' },
    {
      text: '설정으로 이동',
      onPress: () => {
        Linking.openSettings().catch(() => {});
      },
    },
  ]);
}
