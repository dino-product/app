import { act } from '@testing-library/react-native';
import { useEffect, useMemo, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

// QR 인식 카메라(#108)는 네이티브(react-native-vision-camera, Android 는 react-native-vision-camera-barcode-scanner)라
// 테스트에서는 그리지 않는다 (jest/setup.js 가 이 목으로 바꾼다). 카메라 자리에는 testID 'qr-camera' View 를 두고
// 받은 isActive·device 를 props 로 남긴다. 인식은 테스트가 scanQr 로 일으킨다: 켜져 있는 카메라에 붙은 출력
// (iOS 객체 출력·Android 바코드 출력)으로 값을 보낸다. 꺼진 카메라는 실제처럼 아무것도 인식하지 않는다

type ScannedObjects = (objects: object[]) => void;
type Output =
  | { kind: 'objects'; emit: ScannedObjects }
  | { kind: 'barcodes'; emit: ScannedObjects; fail: (error: Error) => void };

type CameraProps = {
  isActive: boolean;
  device: unknown;
  orientationSource?: string;
  outputs?: Output[];
  onError?: (error: Error) => void;
  style?: StyleProp<ViewStyle>;
};

const activeOutputs = new Set<Output>();
const mountedCameras = new Set<{ onError?: (error: Error) => void }>();

function Camera({
  isActive,
  device,
  orientationSource,
  outputs = [],
  onError,
  style,
}: CameraProps) {
  const errorHandler = useRef({ onError });
  errorHandler.current.onError = onError;
  useEffect(() => {
    const camera = errorHandler.current;
    mountedCameras.add(camera);
    return () => {
      mountedCameras.delete(camera);
    };
  }, []);
  useEffect(() => {
    if (!isActive) {
      return;
    }
    outputs.forEach(output => activeOutputs.add(output));
    return () => outputs.forEach(output => activeOutputs.delete(output));
  }, [isActive, outputs]);
  // 테스트가 toHaveProp 로 읽는다
  const shown = { isActive, device, orientationSource };
  return <View testID="qr-camera" style={style} {...shown} />;
}

/** 마지막 콜백을 부르는 출력. 실제 훅처럼 콜백이 바뀌어도 출력은 그대로다 */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export const useObjectOutput = jest.fn(
  ({
    onObjectsScanned,
  }: {
    types: string[];
    onObjectsScanned?: ScannedObjects;
  }) => {
    const latest = useLatest(onObjectsScanned);
    return useMemo<Output>(
      () => ({ kind: 'objects', emit: objects => latest.current?.(objects) }),
      [latest],
    );
  },
);

export const useBarcodeScannerOutput = jest.fn(
  ({
    onBarcodeScanned,
    onError,
  }: {
    barcodeFormats: string[];
    onBarcodeScanned: ScannedObjects;
    onError: (error: Error) => void;
  }) => {
    const latest = useLatest({ onBarcodeScanned, onError });
    return useMemo<Output>(
      () => ({
        kind: 'barcodes',
        emit: barcodes => latest.current.onBarcodeScanned(barcodes),
        fail: error => latest.current.onError(error),
      }),
      [latest],
    );
  },
);

/** jest.mock('react-native-vision-camera') 이 돌려줄 모듈 */
export const visionCamera = {
  __esModule: true,
  Camera,
  useObjectOutput,
  isScannedCode: (object: object) => 'value' in object,
};

/** jest.mock('react-native-vision-camera-barcode-scanner') 이 돌려줄 모듈 */
export const barcodeScanner = {
  __esModule: true,
  useBarcodeScannerOutput,
};

/** 켜져 있는 카메라가 출력 그대로(iOS ScannedObject[], Android Barcode[]) 인식한 것으로 한다 */
export function emitScan(kind: Output['kind'], items: object[]) {
  return act(async () => {
    activeOutputs.forEach(output => {
      if (output.kind === kind) {
        output.emit(items);
      }
    });
  });
}

/** 켜져 있는 카메라가 이 QR 값들을 한 프레임에서 인식한 것으로 한다 (iOS·Android 출력 모두) */
export function scanQr(...values: string[]) {
  return act(async () => {
    activeOutputs.forEach(output => {
      output.emit(
        output.kind === 'objects'
          ? values.map(value => ({ type: 'qr', value }))
          : values.map(rawValue => ({ format: 'qr-code', rawValue })),
      );
    });
  });
}

/** 그려진 카메라가 열리지 못한 것으로 한다 (권한 없음·장치 없음 등) */
export function failCamera(error = new Error('camera unavailable')) {
  return act(async () => {
    mountedCameras.forEach(camera => camera.onError?.(error));
  });
}

/** Android 바코드 스캐너가 실패한 것으로 한다 */
export function failBarcodeScanner(error = new Error('scanner failed')) {
  return act(async () => {
    activeOutputs.forEach(output => {
      if (output.kind === 'barcodes') {
        output.fail(error);
      }
    });
  });
}
