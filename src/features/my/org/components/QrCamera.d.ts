import type { ReactElement } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

// QR 을 읽는 카메라 (#108). 플랫폼마다 구현이 다르다:
// iOS QrCamera.ios.tsx 는 vision-camera core 의 객체 출력(AVFoundation), Android QrCamera.android.tsx 는 ML Kit 바코드 스캐너.
// Metro·jest 는 플랫폼 파일을 고르고, TypeScript 는 이 선언을 본다

export type QrCameraProps = {
  /** 끄면 카메라 세션을 멈춘다. 화면이 보이고 앱이 앞에 있을 때만 켠다 */
  isActive: boolean;
  /** 한 프레임에서 읽은 QR 값들. QR 이 보이는 동안 프레임마다 부른다 */
  onScanned: (values: string[]) => void;
  /** 카메라를 열지 못했거나 인식에 실패했다 (권한 없음·장치 없음 등) */
  onError: (error: Error) => void;
  style?: StyleProp<ViewStyle>;
};

export declare function QrCamera(props: QrCameraProps): ReactElement;
