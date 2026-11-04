jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// MMKV 는 테스트에서 메모리 목을 만들지만(react-native-mmkv 의 isTest), 불러올 때 Nitro 네이티브 모듈을 찾는다
jest.mock('react-native-nitro-modules', () => ({ NitroModules: {} }));

// 햅틱 네이티브 모듈은 테스트에서 울리지 않는다. 화면 테스트는 src/shared/haptics 를 따로 목으로 둔다
jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: jest.fn() },
}));

// 촬영·앨범은 네이티브 화면이라 띄우지 않는다. 돌려줄 응답은 테스트마다 정한다 (jest/photoPicker.ts)
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

// 토큰 보관(Keychain)은 네이티브 모듈이라 메모리 목으로 바꾼다
jest.mock('react-native-keychain', () => require('./keychain'));
