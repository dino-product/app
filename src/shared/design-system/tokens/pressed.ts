import { colors } from './colors';

// 누를 수 있는 리스트 행·카드를 누르고 있는 동안의 배경 (#102). 앱 전체가 이 값만 쓴다.
// Figma 변수 컬렉션(colors.ts 와 1:1)에 눌림 상태 변수가 없어 기본안이다:
// 흰 바탕 행은 Gray50, 회색 바탕 행(Background/3)은 한 단계 진한 Gray100.
// 배경만 바꾸므로 행 크기·레이아웃은 그대로이고, 둥근 모서리 행은 같은 모서리 안에 칠해진다.
// CTA·아이콘 버튼은 대상이 아니다 (CTA 는 디자인 시스템의 눌림 opacity 를 따른다)
export const pressedBackground = {
  onWhite: colors.gray[50],
  onGray: colors.gray[100],
} as const;
