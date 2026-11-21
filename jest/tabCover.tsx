import type { ReactNode } from 'react';
import {
  TabCoverContext,
  type TabCoverDrag,
} from '../src/shared/gesture/tabCover';
import type { SwipeDirection } from '../src/shared/gesture/tabSwipe';

/**
 * 메인 탭 내비게이터 대신 TabSwipeArea 의 손길을 받는 덮기 (#216). 놓아서 바꾸기로 정하면 onSwipe 로 방향을 알린다.
 * 탭 영역만 따로 그리는 테스트에서 WithTabCover 로 감싸 쓴다
 */
export function fakeTabCover() {
  const onSwipe = jest.fn<void, [SwipeDirection]>();
  const cover = {
    begin: jest.fn(() => true),
    move: jest.fn(),
    end: jest.fn((dx: number, commit: boolean) => {
      if (commit) {
        onSwipe(dx < 0 ? 'next' : 'prev');
      }
    }),
    cancel: jest.fn(),
  } satisfies TabCoverDrag;
  return { cover, onSwipe };
}

export function WithTabCover({
  cover,
  children,
}: {
  cover: TabCoverDrag;
  children: ReactNode;
}) {
  return (
    <TabCoverContext.Provider value={cover}>
      {children}
    </TabCoverContext.Provider>
  );
}
