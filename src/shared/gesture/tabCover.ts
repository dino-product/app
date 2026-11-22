import { createContext } from 'react';

// 탭 밀기(TabSwipeArea)가 메인 탭 내비게이터에 손가락을 넘기는 창구 (#216). 내비게이터가 이웃 탭 화면을 덮고 탭을 바꾼다
export type TabCoverDrag = {
  /** 가로로 정해졌다. 지금 덮을 수 없으면(다른 전환 마무리 중) false 이고 이번 손길은 받지 않는다 */
  begin: () => boolean;
  /** 손가락이 시작점에서 dx(pt) 만큼 갔다. switchDistance 는 지금 탭을 바꾸는 거리 (망설이면 커진다) */
  move: (dx: number, switchDistance: number) => void;
  /** 놓았다. commit 이면 옆 탭으로 바꾸고, 아니면 원래대로 돌아온다 */
  end: (dx: number, commit: boolean) => void;
  /** 끊겼다 (두 손가락, 다른 응답자가 가져감). 원래대로 돌아온다 */
  cancel: () => void;
};

export const TabCoverContext = createContext<TabCoverDrag | null>(null);
