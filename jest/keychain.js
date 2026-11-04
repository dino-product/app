// react-native-keychain 은 네이티브 모듈이라 테스트에서는 메모리에 둔다 (jest/setup.js 가 목으로 바꾼다).
// 테스트마다 jest/setupAfterEnv.js 가 비운다. 넘긴 옵션을 보려면 jest.spyOn(Keychain, 'setGenericPassword') 로 본다
const actual = jest.requireActual('react-native-keychain');

const items = new Map();
const serviceOf = options => options?.service ?? 'default';

module.exports = {
  // import * as Keychain 이 사본을 만들지 않게 해서 spyOn 이 코드가 부르는 함수에 걸린다
  __esModule: true,
  ...actual,
  setGenericPassword: async (username, password, options) => {
    const service = serviceOf(options);
    const storage = options?.storage ?? actual.STORAGE_TYPE.AES_GCM_NO_AUTH;
    items.set(service, { service, storage, username, password });
    return { service, storage };
  },
  getGenericPassword: async options => items.get(serviceOf(options)) ?? false,
  hasGenericPassword: async options => items.has(serviceOf(options)),
  resetGenericPassword: async options => {
    items.delete(serviceOf(options));
    return true;
  },
  clearMockKeychain: () => items.clear(),
};
