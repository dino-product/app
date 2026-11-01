// 터치 영역 테스트(*.touch.test.*)를 Android 로도 돌린다 (npm run test:android).
// 모듈을 *.android.js 로 풀어 Platform.OS·Platform.select·모듈 상수가 Android 값이 된다.
// 테스트 안에서 jest.replaceProperty(Platform, 'OS') 로 바꾸는 것과 달리 모듈 상수까지 바뀐다.
const base = require('./jest.config');

module.exports = {
  ...base,
  displayName: 'android',
  haste: {
    defaultPlatform: 'android',
    platforms: ['android', 'ios', 'native'],
  },
  testMatch: ['**/*.touch.test.[jt]s?(x)'],
  // 일부 테스트만 돌므로 커버리지 기준(80%)은 물려받지 않는다. 커버리지는 npm run test:coverage 가 본다
  coverageThreshold: undefined,
};
