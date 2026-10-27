module.exports = {
  presets: ['module:@react-native/babel-preset'],
  env: {
    // Release 번들에서 console.log/info/debug 호출 제거 (warn, error 는 유지)
    production: {
      plugins: [['transform-remove-console', { exclude: ['warn', 'error'] }]],
    },
  },
};
