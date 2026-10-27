module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest/setup.js'],
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
