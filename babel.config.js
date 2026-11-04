module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // API 서버 주소를 빌드할 때 번들에 넣는다 (src/shared/api/config.ts). 비밀 값이 아니며, 이 이름 말고는 넣지 않는다.
    // babel 은 값을 캐시에 남기므로 값을 바꾸면 Metro 를 --reset-cache 로 다시 띄운다
    [
      'transform-inline-environment-variables',
      { include: ['ORBIT_API_BASE_URL'] },
    ],
  ],
  env: {
    // Release 번들에서 console.log/info/debug 호출 제거 (warn, error 는 유지)
    production: {
      plugins: [['transform-remove-console', { exclude: ['warn', 'error'] }]],
    },
  },
};
