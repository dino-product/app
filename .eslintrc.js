// 성능 관련 규칙의 근거는 docs/performance.md 참고
module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: [
    'coverage/',
    '.reassure/',
    'ios/',
    'android/',
    // ESLint 는 dotfile 을 기본 무시한다. 설정 파일도 린트 대상에 포함
    '!.eslintrc.js',
    '!.prettierrc.js',
  ],
  rules: {
    // 프로덕션 console.log 는 JS 스레드를 점유한다 (프로덕션 빌드는 babel 이 제거)
    'no-console': ['error', { allow: ['warn', 'error'] }],
    // 렌더마다 새 스타일 객체 생성 금지
    'react-native/no-inline-styles': 'error',
    // 부모 렌더마다 자식이 unmount/remount 된다
    'react/no-unstable-nested-components': 'error',
    'react-hooks/exhaustive-deps': 'error',
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'moment',
            message:
              '번들 크기가 큽니다. Intl 또는 date-fns 개별 함수를 사용하세요.',
          },
          {
            name: 'lodash',
            message:
              '전체 import 금지. lodash/<함수> 또는 네이티브 메서드를 사용하세요.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['scripts/**/*.js'],
      rules: { 'no-console': 'off' },
    },
    {
      files: ['jest/**/*.js'],
      env: { jest: true },
    },
  ],
};
