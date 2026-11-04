import {
  ActionSheetIOS,
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
  type AlertButton,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { pickReportPhotos } from './photoPicker';

// react-native-image-picker 는 jest/setup.js 에서 목으로 바꿨다. 테스트마다 돌려줄 응답을 정한다
const camera = jest.mocked(launchCamera);
const library = jest.mocked(launchImageLibrary);
// 프리셋의 Linking 목
const openSettings = jest.mocked(Linking.openSettings);

const PHOTO_OPTIONS = {
  mediaType: 'photo',
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  assetRepresentationMode: 'compatible',
};

const asset = (uri: string) => ({ uri, type: 'image/jpeg' });

// iOS 액션 시트에서 label 버튼을 누른 것으로 한다
const chooseOnIOS = (label: string) =>
  jest
    .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
    .mockImplementation((options, callback) =>
      callback(options.options.indexOf(label)),
    );

// 대화상자(Alert)를 띄우지 않고 기록만 한다. Android 선택지·안내 모두 Alert 다
const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const alertButtons = (alert: ReturnType<typeof spyAlert>, call: number) =>
  (alert.mock.calls[call]?.[2] ?? []) as AlertButton[];
const pressAlertButton = (
  alert: ReturnType<typeof spyAlert>,
  call: number,
  text: string,
) =>
  alertButtons(alert, call)
    .find(button => button.text === text)
    ?.onPress?.();

// Android 선택지(첫 Alert)에서 label 버튼을 누른 것으로 한다. 뒤이은 안내 Alert 는 기록만 한다
function chooseOnAndroid(label: string) {
  jest.replaceProperty(Platform, 'OS', 'android');
  const alert = spyAlert();
  alert.mockImplementationOnce((_title, _message, buttons) =>
    buttons?.find(button => button.text === label)?.onPress?.(),
  );
  return alert;
}

const requestCamera = (result: 'granted' | 'denied' | 'never_ask_again') =>
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(result);

afterEach(() => {
  jest.restoreAllMocks();
  // 모듈 목은 spy 가 아니라 restoreAllMocks 로 호출 기록이 지워지지 않는다
  camera.mockReset();
  library.mockReset();
  openSettings.mockReset();
});

describe('pickReportPhotos 선택지', () => {
  it('iOS 는 사진 촬영 · 앨범에서 선택 · 취소 액션 시트를 띄운다', async () => {
    const sheet = chooseOnIOS('취소');

    await pickReportPhotos(6);

    expect(sheet).toHaveBeenCalledWith(
      expect.objectContaining({
        options: ['사진 촬영', '앨범에서 선택', '취소'],
        cancelButtonIndex: 2,
      }),
      expect.any(Function),
    );
  });

  it('iOS 에서 취소하면 아무것도 고르지 않고 카메라·앨범을 열지 않는다', async () => {
    chooseOnIOS('취소');

    await expect(pickReportPhotos(6)).resolves.toEqual([]);
    expect(camera).not.toHaveBeenCalled();
    expect(library).not.toHaveBeenCalled();
  });

  it('Android 는 사진 촬영 · 앨범에서 선택 · 취소 버튼 3개 대화상자를 띄운다', async () => {
    const alert = chooseOnAndroid('취소');

    await pickReportPhotos(6);

    expect(
      alertButtons(alert, 0)
        .map(button => button.text)
        .sort(),
    ).toEqual(['사진 촬영', '앨범에서 선택', '취소'].sort());
    // 바깥 탭·뒤로가기로도 닫을 수 있다
    expect(alert.mock.calls[0]?.[3]).toEqual(
      expect.objectContaining({ cancelable: true }),
    );
  });

  it('Android 에서 취소하면 아무것도 고르지 않는다', async () => {
    chooseOnAndroid('취소');

    await expect(pickReportPhotos(6)).resolves.toEqual([]);
    expect(camera).not.toHaveBeenCalled();
    expect(library).not.toHaveBeenCalled();
  });

  it('Android 에서 바깥 탭·뒤로가기로 닫아도 아무것도 고르지 않는다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    spyAlert().mockImplementationOnce((_title, _message, _buttons, options) =>
      options?.onDismiss?.(),
    );

    await expect(pickReportPhotos(6)).resolves.toEqual([]);
    expect(camera).not.toHaveBeenCalled();
    expect(library).not.toHaveBeenCalled();
  });

  it('남은 칸이 없으면 선택지를 띄우지 않는다', async () => {
    const sheet = chooseOnIOS('앨범에서 선택');

    await expect(pickReportPhotos(0)).resolves.toEqual([]);
    expect(sheet).not.toHaveBeenCalled();
    expect(library).not.toHaveBeenCalled();
  });
});

describe('pickReportPhotos 사진 촬영', () => {
  it('카메라를 열어 찍은 사진 한 장을 돌려준다 (긴 변 1920 · 품질 0.8 · JPEG)', async () => {
    chooseOnIOS('사진 촬영');
    camera.mockResolvedValue({ assets: [asset('file:///tmp/a.jpg')] });

    await expect(pickReportPhotos(4)).resolves.toEqual(['file:///tmp/a.jpg']);
    expect(camera).toHaveBeenCalledTimes(1);
    expect(camera.mock.calls[0]?.[0]).toEqual(PHOTO_OPTIONS);
    expect(library).not.toHaveBeenCalled();
  });

  it('iOS 는 앱이 권한을 따로 묻지 않는다 (카메라가 열릴 때 시스템이 묻는다)', async () => {
    chooseOnIOS('사진 촬영');
    const request = requestCamera('granted');
    camera.mockResolvedValue({ assets: [asset('file:///tmp/a.jpg')] });

    await pickReportPhotos(6);

    expect(request).not.toHaveBeenCalled();
    expect(camera).toHaveBeenCalledTimes(1);
  });

  it('Android 는 런타임 CAMERA 권한을 먼저 받고, 허용하면 카메라를 연다', async () => {
    chooseOnAndroid('사진 촬영');
    const request = requestCamera('granted');
    camera.mockResolvedValue({ assets: [asset('file:///tmp/a.jpg')] });

    await expect(pickReportPhotos(6)).resolves.toEqual(['file:///tmp/a.jpg']);
    expect(request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.CAMERA);
    expect(request.mock.invocationCallOrder[0]).toBeLessThan(
      camera.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it.each(['denied', 'never_ask_again'] as const)(
    'Android 에서 권한이 %s 면 카메라를 열지 않고 설정으로 가는 안내를 띄운다',
    async result => {
      const alert = chooseOnAndroid('사진 촬영');
      requestCamera(result);
      openSettings.mockResolvedValue(undefined);

      await expect(pickReportPhotos(6)).resolves.toEqual([]);
      expect(camera).not.toHaveBeenCalled();
      expect(alert).toHaveBeenCalledTimes(2);
      expect(alert.mock.calls[1]?.[0]).toBe('카메라 권한이 필요해요');

      pressAlertButton(alert, 1, '설정으로 이동');
      expect(openSettings).toHaveBeenCalledTimes(1);
    },
  );

  it('안내에서 닫기를 누르면 설정으로 가지 않는다', async () => {
    const alert = chooseOnAndroid('사진 촬영');
    requestCamera('never_ask_again');

    await pickReportPhotos(6);
    pressAlertButton(alert, 1, '닫기');

    expect(openSettings).not.toHaveBeenCalled();
  });

  it('카메라가 권한 오류를 돌려주면(iOS 에서 거부) 설정으로 가는 안내를 띄운다', async () => {
    chooseOnIOS('사진 촬영');
    const alert = spyAlert();
    camera.mockResolvedValue({ errorCode: 'permission' });

    await expect(pickReportPhotos(6)).resolves.toEqual([]);
    expect(alert.mock.calls[0]?.[0]).toBe('카메라 권한이 필요해요');
    expect(alertButtons(alert, 0).map(button => button.text)).toContain(
      '설정으로 이동',
    );
  });

  it('찍지 않고 닫으면 아무것도 붙이지 않고 안내도 띄우지 않는다', async () => {
    chooseOnIOS('사진 촬영');
    const alert = spyAlert();
    camera.mockResolvedValue({ didCancel: true });

    await expect(pickReportPhotos(6)).resolves.toEqual([]);
    expect(alert).not.toHaveBeenCalled();
  });
});

describe('pickReportPhotos 앨범에서 선택', () => {
  it('남은 칸 수만큼 고를 수 있게 열고, 고른 순서대로 돌려준다', async () => {
    chooseOnIOS('앨범에서 선택');
    library.mockResolvedValue({
      assets: [
        asset('file:///tmp/3.jpg'),
        asset('file:///tmp/1.jpg'),
        asset('file:///tmp/2.jpg'),
      ],
    });

    await expect(pickReportPhotos(4)).resolves.toEqual([
      'file:///tmp/3.jpg',
      'file:///tmp/1.jpg',
      'file:///tmp/2.jpg',
    ]);
    expect(library.mock.calls[0]?.[0]).toEqual({
      ...PHOTO_OPTIONS,
      selectionLimit: 4,
    });
    expect(camera).not.toHaveBeenCalled();
  });

  it('Android 도 같은 옵션으로 앨범(Photo Picker)을 연다. 저장소 권한은 묻지 않는다', async () => {
    chooseOnAndroid('앨범에서 선택');
    const request = jest.spyOn(PermissionsAndroid, 'request');
    library.mockResolvedValue({ assets: [asset('content://media/1')] });

    await expect(pickReportPhotos(2)).resolves.toEqual(['content://media/1']);
    expect(library.mock.calls[0]?.[0]).toEqual({
      ...PHOTO_OPTIONS,
      selectionLimit: 2,
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('남은 칸보다 많이 돌아와도 남은 칸까지만 돌려준다', async () => {
    chooseOnIOS('앨범에서 선택');
    library.mockResolvedValue({
      assets: [
        asset('file:///tmp/1.jpg'),
        asset('file:///tmp/2.jpg'),
        asset('file:///tmp/3.jpg'),
      ],
    });

    await expect(pickReportPhotos(2)).resolves.toEqual([
      'file:///tmp/1.jpg',
      'file:///tmp/2.jpg',
    ]);
  });

  it('주소가 없는 항목은 건너뛴다', async () => {
    chooseOnIOS('앨범에서 선택');
    library.mockResolvedValue({
      assets: [{ type: 'image/jpeg' }, asset('file:///tmp/1.jpg')],
    });

    await expect(pickReportPhotos(6)).resolves.toEqual(['file:///tmp/1.jpg']);
  });

  it('고르지 않고 닫으면 아무것도 붙이지 않고 안내도 띄우지 않는다', async () => {
    chooseOnIOS('앨범에서 선택');
    const alert = spyAlert();
    library.mockResolvedValue({ didCancel: true });

    await expect(pickReportPhotos(6)).resolves.toEqual([]);
    expect(alert).not.toHaveBeenCalled();
  });
});

describe('pickReportPhotos 실패', () => {
  it('카메라가 없으면 안내를 띄우고 아무것도 붙이지 않는다', async () => {
    chooseOnIOS('사진 촬영');
    const alert = spyAlert();
    camera.mockResolvedValue({ errorCode: 'camera_unavailable' });

    await expect(pickReportPhotos(6)).resolves.toEqual([]);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0]?.[0]).toBe('카메라를 사용할 수 없어요');
  });

  it.each([
    ['사진 촬영', () => camera],
    ['앨범에서 선택', () => library],
  ] as const)(
    '%s 이 오류를 돌려주면 안내를 띄우고 아무것도 붙이지 않는다',
    async (label, launcher) => {
      chooseOnIOS(label);
      const alert = spyAlert();
      launcher().mockResolvedValue({
        errorCode: 'others',
        errorMessage: 'boom',
      });

      await expect(pickReportPhotos(6)).resolves.toEqual([]);
      expect(alert).toHaveBeenCalledTimes(1);
      expect(alert.mock.calls[0]?.[0]).toBe('사진을 가져오지 못했어요');
    },
  );

  it('네이티브 호출이 예외를 던져도 안내를 띄우고 아무것도 붙이지 않는다', async () => {
    chooseOnIOS('앨범에서 선택');
    const alert = spyAlert();
    library.mockRejectedValue(new Error('native module missing'));

    await expect(pickReportPhotos(6)).resolves.toEqual([]);
    expect(alert.mock.calls[0]?.[0]).toBe('사진을 가져오지 못했어요');
  });

  it('권한 요청이 실패해도 안내를 띄우고 카메라를 열지 않는다', async () => {
    const alert = chooseOnAndroid('사진 촬영');
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockRejectedValue(new Error('no activity'));

    await expect(pickReportPhotos(6)).resolves.toEqual([]);
    expect(camera).not.toHaveBeenCalled();
    expect(alert.mock.calls[1]?.[0]).toBe('사진을 가져오지 못했어요');
  });
});
