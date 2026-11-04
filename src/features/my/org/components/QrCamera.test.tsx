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

    it('바코드 인식이 실패하면 onError 로 알린다', async () => {
      const props = await renderCamera(AndroidQrCamera);
      const error = new Error('ml kit');

      await failBarcodeScanner(error);

      expect(props.onError).toHaveBeenCalledWith(error);
    });
  });
});
