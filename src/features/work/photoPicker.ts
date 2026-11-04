import { ActionSheetIOS, Alert, Platform } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type CameraOptions,
  type ErrorCode,
  type ImagePickerResponse,
  type OptionsCommon,
} from 'react-native-image-picker';
import {
  requestCameraPermission,
  showCameraPermissionGuide,
} from '../../shared/native/cameraPermission';

// 완료 보고 사진을 카메라로 찍거나 앨범에서 고른다 (#111). 고른 사진의 로컬 URI 를 고른 순서대로 돌려준다.
// 고르지 않았거나 실패하면 빈 배열이다. 실패·권한 안내는 여기서 띄우므로 부르는 쪽은 보고를 그대로 두면 된다.
// 선택지·안내 문구는 기획 확인 전 기본안이다 (Figma 에 없는 시스템 UI)

// 긴 변 1920px 이하, 품질 0.8 JPEG. 'compatible' 은 iOS 앨범의 HEIC 를 JPEG 로 받는다 (Android 는 이 값이면 HEIC 를 JPEG 로 바꾼다).
// conversionQuality 는 Android 가 HEIC 를 줄이지 않고 JPEG 로만 바꿀 때의 품질이다. 라이브러리 Options.java 가 읽지만 TS 타입에는 없다
const PHOTO_OPTIONS: OptionsCommon & { conversionQuality: number } = {
  mediaType: 'photo',
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  conversionQuality: 0.8,
  assetRepresentationMode: 'compatible',
};

// 카메라를 쓸어내려 닫으면 찍던 사진이 사라지므로 전체 화면으로 띄운다 (iOS 기본은 pageSheet)
const CAMERA_OPTIONS: CameraOptions = {
  ...PHOTO_OPTIONS,
  presentationStyle: 'fullScreen',
};

type Source = 'camera' | 'library';

const SOURCE_OPTIONS = ['사진 촬영', '앨범에서 선택', '취소'];
const SOURCES: readonly (Source | null)[] = ['camera', 'library', null];

/** remaining: 더 붙일 수 있는 장수. 앨범은 그만큼 여러 장, 촬영은 한 장이다 */
export async function pickReportPhotos(remaining: number): Promise<string[]> {
  // 앨범의 selectionLimit 0 은 '제한 없음' 이라 남은 칸이 없으면 열지 않는다
  if (remaining < 1) {
    return [];
  }
  const source = await chooseSource();
  if (source === null) {
    return [];
  }
  try {
    return source === 'camera'
      ? await takePhoto()
      : await chooseFromLibrary(remaining);
  } catch {
    showFailure('others');
    return [];
  }
}

// iOS 는 액션 시트, Android 는 버튼 3개 대화상자. Android 는 마지막 버튼이 오른쪽 끝이라 취소를 맨 앞(왼쪽)에 둔다
function chooseSource(): Promise<Source | null> {
  return new Promise(resolve => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: SOURCE_OPTIONS, cancelButtonIndex: 2 },
        index => resolve(SOURCES[index] ?? null),
      );
      return;
    }
    Alert.alert(
      '사진 추가',
      undefined,
      [
        { text: '취소', style: 'cancel', onPress: () => resolve(null) },
        { text: '앨범에서 선택', onPress: () => resolve('library') },
        { text: '사진 촬영', onPress: () => resolve('camera') },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

// 권한은 카메라를 열기 전에 받는다 (shared/native/cameraPermission). Android 는 매니페스트에 CAMERA 를 선언해 두어
// 허용받기 전에는 라이브러리가 카메라 앱을 열지 않고, iOS 는 라이브러리(8.3.0)가 권한을 확인하지 않고 카메라를 띄운다
async function takePhoto(): Promise<string[]> {
  if (!(await requestCameraPermission())) {
    showCameraPermissionGuide(
      '사진을 찍으려면 설정에서 카메라 접근을 허용해 주세요.',
    );
    return [];
  }
  return toUris(await launchCamera(CAMERA_OPTIONS), 1);
}

// 앨범은 iOS PHPicker · Android Photo Picker 라 저장소 권한이 필요 없다
async function chooseFromLibrary(limit: number): Promise<string[]> {
  return toUris(
    await launchImageLibrary({ ...PHOTO_OPTIONS, selectionLimit: limit }),
    limit,
  );
}

// 옛 Android 의 대체 선택기는 selectionLimit 을 지키지 않을 수 있어 limit 장까지만 쓴다
function toUris(response: ImagePickerResponse, limit: number): string[] {
  if (response.didCancel) {
    return [];
  }
  if (response.errorCode) {
    showFailure(response.errorCode);
    return [];
  }
  return (response.assets ?? [])
    .flatMap(asset => (asset.uri ? [asset.uri] : []))
    .slice(0, limit);
}

function showFailure(errorCode: ErrorCode) {
  if (errorCode === 'camera_unavailable') {
    Alert.alert(
      '카메라를 사용할 수 없어요',
      '이 기기에서는 카메라를 열 수 없어요. 앨범에서 선택해 주세요.',
    );
    return;
  }
  Alert.alert('사진을 가져오지 못했어요', '잠시 후 다시 시도해 주세요.');
}
