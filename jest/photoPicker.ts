import { ActionSheetIOS } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

// 완료 보고의 사진 추가 칸을 누르면 시스템 선택지(iOS 액션 시트)에서 '앨범에서 선택' 을 고르고,
// 앨범에서 사진 한 장을 고른 것으로 한다. 선택지·앨범은 네이티브 화면이라 테스트에서 띄우지 않는다.
// 부를 때마다 새 파일을 준다. 테스트가 끝나면 jest.restoreAllMocks + resetPhotoLibrary 로 되돌린다
export function pickOnePhotoFromLibrary() {
  let count = 0;
  jest
    .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
    .mockImplementation((options, callback) =>
      callback(options.options.indexOf('앨범에서 선택')),
    );
  jest.mocked(launchImageLibrary).mockImplementation(async () => {
    count += 1;
    return { assets: [{ uri: `file:///tmp/photo-${count}.jpg` }] };
  });
}

/** 모듈 목은 spy 가 아니라 restoreAllMocks 로 응답·호출 기록이 지워지지 않는다 */
export function resetPhotoLibrary() {
  jest.mocked(launchImageLibrary).mockReset();
}
