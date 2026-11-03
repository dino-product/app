jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// MMKV 는 테스트에서 메모리 목을 만들지만(react-native-mmkv 의 isTest), 불러올 때 Nitro 네이티브 모듈을 찾는다
jest.mock('react-native-nitro-modules', () => ({ NitroModules: {} }));
