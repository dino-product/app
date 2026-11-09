import { Easing } from 'react-native';

// 좌우로 옮겨 갈 때 새 내용이 들어오는 짧은 전환 (#140 탭, #153 작업 이력 달). 오른쪽(다음)으로 가면 +x 에서, 왼쪽(이전)으로
// 가면 -x 에서 0 으로 들어온다. 또렷한 슬라이드가 아니라 찰나에 방향만 느껴지는 짧은 시간·작은 거리이고, 투명도는 건드리지 않는다

/** 새 내용이 들어오기 시작하는 거리 (pt) */
export const ENTER_OFFSET = 24;
/** 들어오는 시간 (ms) */
export const ENTER_MS = 150;
export const enterEasing = Easing.out(Easing.cubic);
