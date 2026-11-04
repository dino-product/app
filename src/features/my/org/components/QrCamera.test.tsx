import { render, screen } from '@testing-library/react-native';
import {
  emitScan,
  failBarcodeScanner,
  failCamera,
  useBarcodeScannerOutput,
  useObjectOutput,
} from '../../../../../jest/qrCamera';
import { QrCamera as AndroidQrCamera } from './QrCamera.android';
import { QrCamera as IOSQrCamera } from './QrCamera.ios';

// QR 을 읽는 카메라는 플랫폼마다 구현이 다르다 (#108). 카메라는 jest/qrCamera 의 목이다.
// 두 플랫폼 파일을 직접 불러 각각 확인한다 (jest 는 기본으로 .ios 파일을 고른다)
const cameras = [
  ['iOS', IOSQrCamera],
  ['Android', AndroidQrCamera],
] as const;

function renderCamera(
  Camera: (typeof cameras)[number][1],
  props: Partial<Parameters<typeof IOSQrCamera>[0]> = {},
) {
  const all = {
    isActive: true,
    onScanned: jest.fn(),
    onError: jest.fn(),
    ...props,
  };
  return render(<Camera {...all} />).then(() => all);
}

describe('QrCamera', () => {
  it.each(cameras)(
    '%s: 뒤 카메라를 isActive 대로 켜고 끈다',
    async (_, Camera) => {
      const props = await renderCamera(Camera, { isActive: false });
      expect(screen.getByTestId('qr-camera')).toHaveProp('isActive', false);
      expect(screen.getByTestId('qr-camera')).toHaveProp('device', 'back');
      // 세로 고정 앱이라 출력 방향은 기기 방향이 아니라 화면 방향을 따른다
      expect(screen.getByTestId('qr-camera')).toHaveProp(
        'orientationSource',
        'interface',
      );

      await screen.rerender(<Camera {...props} isActive />);

      expect(screen.getByTestId('qr-camera')).toHaveProp('isActive', true);
    },
  );

  it.each(cameras)(
    '%s: 카메라를 열지 못하면 onError 로 알린다',
    async (_, Camera) => {
      const props = await renderCamera(Camera);
      const error = new Error('no camera');

      await failCamera(error);

      expect(props.onError).toHaveBeenCalledWith(error);
    },
  );

  describe('iOS (vision-camera 객체 출력, AVFoundation)', () => {
    it('QR 만 찾는 객체 출력을 붙인다', async () => {
      await renderCamera(IOSQrCamera);

      expect(useObjectOutput).toHaveBeenLastCalledWith(
        expect.objectContaining({ types: ['qr'] }),
      );
    });

    // 콜백이 바뀔 때마다 네이티브 출력에 다시 넣지 않는다
    it('onScanned 가 바뀌어도 객체 출력 콜백은 그대로이고, 새 onScanned 로 넘긴다', async () => {
      const props = await renderCamera(IOSQrCamera);
      const next = jest.fn();

      await screen.rerender(<IOSQrCamera {...props} onScanned={next} />);
      const [before, after] = useObjectOutput.mock.calls
        .slice(-2)
        .map(([options]) => options.onObjectsScanned);
      await emitScan('objects', [{ type: 'qr', value: 'RBT124' }]);

      expect(after).toBe(before);
      expect(next).toHaveBeenCalledWith(['RBT124']);
      expect(props.onScanned).not.toHaveBeenCalled();
    });

    it('한 프레임에서 읽은 코드의 값만 넘긴다. 값이 없는 코드·코드가 아닌 객체는 뺀다', async () => {
      const props = await renderCamera(IOSQrCamera);

      await emitScan('objects', [
        { type: 'qr', value: 'RBT124' },
        { type: 'qr', value: undefined },
        { type: 'face', faceID: 1 },
        { type: 'qr', value: 'https://orbit.example/join/HB0010' },
      ]);

      expect(props.onScanned).toHaveBeenCalledTimes(1);
      expect(props.onScanned).toHaveBeenCalledWith([
        'RBT124',
        'https://orbit.example/join/HB0010',
      ]);
    });

    it('읽은 값이 없으면 부르지 않는다', async () => {
      const props = await renderCamera(IOSQrCamera);

      await emitScan('objects', [{ type: 'face', faceID: 1 }]);
      await emitScan('objects', []);

      expect(props.onScanned).not.toHaveBeenCalled();
    });
  });

  describe('Android (ML Kit 바코드 스캐너)', () => {
    it('QR 형식만 찾는 바코드 출력을 붙인다', async () => {
      await renderCamera(AndroidQrCamera);

      expect(useBarcodeScannerOutput).toHaveBeenLastCalledWith(
        expect.objectContaining({ barcodeFormats: ['qr-code'] }),
      );
    });

    it('한 프레임에서 읽은 바코드의 원래 값만 넘긴다. 값이 없는 바코드는 뺀다', async () => {
      const props = await renderCamera(AndroidQrCamera);

      await emitScan('barcodes', [
        { format: 'qr-code', rawValue: 'RBT124' },
        { format: 'qr-code', rawValue: undefined },
      ]);

      expect(props.onScanned).toHaveBeenCalledTimes(1);
      expect(props.onScanned).toHaveBeenCalledWith(['RBT124']);
    });

    it('읽은 값이 없으면 부르지 않는다', async () => {
      const props = await renderCamera(AndroidQrCamera);

      await emitScan('barcodes', []);

      expect(props.onScanned).not.toHaveBeenCalled();
    });

    // ML Kit 은 프레임마다 인식하고 실패도 프레임마다 알린다. 카메라는 그대로 켜져 있고 다음 프레임에서 다시 읽는다
    it('한 프레임의 바코드 인식 실패는 카메라 오류로 알리지 않고 다음 프레임을 읽는다', async () => {
      const props = await renderCamera(AndroidQrCamera);

      await failBarcodeScanner(new Error('ml kit'));
      await emitScan('barcodes', [{ format: 'qr-code', rawValue: 'RBT124' }]);

      expect(props.onError).not.toHaveBeenCalled();
      expect(props.onScanned).toHaveBeenCalledWith(['RBT124']);
    });
  });
});
