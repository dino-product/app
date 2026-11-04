import { useCallback, useMemo } from 'react';
import {
  Camera,
  isScannedCode,
  useObjectOutput,
  type ScannedObject,
  type ScannedObjectType,
} from 'react-native-vision-camera';
import type { QrCameraProps } from './QrCamera';

// iOS 는 vision-camera core 의 객체 출력(AVFoundation 메타데이터 출력)으로 QR 을 읽는다 (#108).
// ML Kit 이 필요 없어 바코드 스캐너 패키지는 iOS 에 연결하지 않는다 (react-native.config.js)
const QR_TYPES: ScannedObjectType[] = ['qr'];

export function QrCamera({
  isActive,
  onScanned,
  onError,
  style,
}: QrCameraProps) {
  const onObjectsScanned = useCallback(
    (objects: ScannedObject[]) => {
      const values = objects.flatMap(object =>
        isScannedCode(object) && object.value ? [object.value] : [],
      );
      if (values.length > 0) {
        onScanned(values);
      }
    },
    [onScanned],
  );
  const output = useObjectOutput({ types: QR_TYPES, onObjectsScanned });
  // 출력 배열이 바뀌면 세션을 다시 구성하므로 고정한다
  const outputs = useMemo(() => [output], [output]);

  return (
    <Camera
      style={style}
      isActive={isActive}
      device="back"
      outputs={outputs}
      onError={onError}
    />
  );
}
