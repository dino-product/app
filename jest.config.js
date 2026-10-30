module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest/setup.js'],
  // 프리셋 기본값 + React Navigation (ESM 으로만 배포돼 변환이 필요하다)
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation)/)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/ios/',
    '<rootDir>/android/',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'scripts/lib/**/*.js',
    '!**/*.perf-test.{ts,tsx}',
    '!**/__tests__/**',
  ],
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
};
