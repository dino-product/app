const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  // babel 이 번들에 넣는 API 주소(babel.config.js, ORBIT_API_BASE_URL)는 Metro 변환 캐시 키에 들어가지 않는다.
  // 값마다 캐시를 따로 써서, 주소를 바꿔 만든 번들이 캐시에 남은 옛 주소를 쓰지 않게 한다 (#110)
  cacheVersion: `orbit-api-base-url:${process.env.ORBIT_API_BASE_URL ?? ''}`,
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
