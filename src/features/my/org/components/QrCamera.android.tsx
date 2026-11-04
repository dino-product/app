import { useMemo } from 'react';
import { Camera } from 'react-native-vision-camera';
import {
  useBarcodeScannerOutput,
  type Barcode,
  type TargetBarcodeFormat,
} from 'react-native-vision-camera-barcode-scanner';
import type { QrCameraProps } from './QrCamera';

// Android 는 vision-camera core 에 객체 출력이 없어 ML Kit 바코드 스캐너 출력으로 QR 을 읽는다 (#108).
// 미리보기 크기 프레임으로 읽는다(기본값). 화면 가운데 안내 사각형 크기의 QR 은 그걸로 충분하다
const QR_FORMATS: TargetBarcodeFormat[] = ['qr-code'];

// 스캐너는 프레임마다 인식하고 실패도 프레임마다 알린다. 카메라는 그대로 켜져 있어 다음 프레임에서 다시 읽으므로
// 카메라 오류(onError)로 올리지 않는다
const ignoreFrameError = () => {};

export function QrCamera({
  isActive,
  onScanned,
  onError,
  style,
}: QrCameraProps) {
  const output = useBarcodeScannerOutput({
    barcodeFormats: QR_FORMATS,
    onBarcodeScanned: (barcodes: Barcode[]) => {
      const values = barcodes.flatMap(barcode =>
        barcode.rawValue ? [barcode.rawValue] : [],
      );
      if (values.length > 0) {
        onScanned(values);
      }
    },
    onError: ignoreFrameError,
  });
  // 출력 배열이 바뀌면 세션을 다시 구성하므로 고정한다
  const outputs = useMemo(() => [output], [output]);

  return (
    <Camera
      style={style}
      isActive={isActive}
      device="back"
      // 세로 고정 앱이라 기기를 눕혀도 화면 방향을 따른다
      orientationSource="interface"
      outputs={outputs}
      onError={onError}
    />
  );
}
