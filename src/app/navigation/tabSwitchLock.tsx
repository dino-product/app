import type {
  NavigationState,
  ParamListBase,
  PartialState,
  TabNavigationState,
} from '@react-navigation/native';
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { BackHandler } from 'react-native';

// 새로고침이 도는 동안에는 메인 탭을 옮기지 않는다 (#177).
// 당겨서 새로고침 중에 탭을 옮기면 떠난 화면이 창에서 떼어져, 돌아왔을 때 새로고침 표시가 위에 남고 리스트·상단 바가
// 내려간 채로 멈췄다. 탭 첫 화면이 새로고침하는 동안 잠금을 잡고(useHoldTabSwitchWhile), 탭을 옮기는 길
// — 좌우 밀기(TabSwipeArea 의 canSwipe), 탭 바 누름(MainTabBar), Android 뒤로가기(다른 탭 첫 화면 → 홈 탭) — 이
// 그때그때 canSwitch() 를 묻는다. 새로고침이 끝나면(성공·실패 모두) 잠금을 놓아 바로 다시 옮길 수 있다.
// 묻는 쪽이 누르거나 밀 때 읽으므로 잠금이 바뀌어도 아무것도 다시 그리지 않는다

/** 새로고침 중인 화면 수로 본 탭 전환 가능 여부 */
export function canSwitchTab(refreshingScreens: number): boolean {
  return refreshingScreens === 0;
}

type AnyNavigationState =
  | NavigationState<ParamListBase>
  | PartialState<NavigationState<ParamListBase>>;

/**
 * Android 뒤로가기가 탭을 바꾸는지 (backBehavior="firstRoute").
 * 다른 탭의 첫 화면이면 홈 탭으로 바꾸고, 홈 탭이면 앱을 나가고, 탭 안쪽 화면이면 그 스택에서 돌아간다
 */
export function backSwitchesTab(
  state: TabNavigationState<ParamListBase>,
): boolean {
  if (state.index === 0) {
    return false;
  }
  const nested = state.routes[state.index]?.state as
    | AnyNavigationState
    | undefined;
  return nested === undefined || (nested.index ?? 0) === 0;
}

export type TabSwitchLock = {
  /** 잠금을 잡는다. 돌려준 함수로 놓는다 (두 번 불러도 한 번만 놓는다) */
  hold: () => () => void;
  /** 지금 탭을 옮길 수 있는지 */
  canSwitch: () => boolean;
};

const TabSwitchLockContext = createContext<TabSwitchLock | null>(null);

/**
 * 메인 탭 내비게이터의 layout 으로 쓴다. state 는 탭 상태, navigation.isFocused 는 메인(탭 묶음)이 루트에서 맨 위인지다.
 * 잡혀 있는 동안만 Android 뒤로가기를 듣는다. 잡을 때 등록해 React Navigation 의 뒤로가기 처리(먼저 등록됨)보다 먼저 불린다
 */
export function TabSwitchLockLayout({
  state,
  navigation,
  children,
}: {
  state: TabNavigationState<ParamListBase>;
  navigation: { isFocused: () => boolean };
  children: ReactNode;
}) {
  const latest = useRef({ state, navigation });
  useLayoutEffect(() => {
    latest.current = { state, navigation };
  });
  const [lock] = useState<TabSwitchLock>(() => {
    let holders = 0;
    let backSubscription: { remove: () => void } | null = null;
    // 탭 위에 루트 화면(요청 상세 등)이 열려 있으면 그 화면이 뒤로 간다. 막지 않는다
    const onBack = () =>
      latest.current.navigation.isFocused() &&
      backSwitchesTab(latest.current.state);
    return {
      hold: () => {
        holders += 1;
        if (holders === 1) {
          backSubscription = BackHandler.addEventListener(
            'hardwareBackPress',
            onBack,
          );
        }
        let held = true;
        return () => {
          if (!held) {
            return;
          }
          held = false;
          holders -= 1;
          if (holders === 0) {
            backSubscription?.remove();
            backSubscription = null;
          }
        };
      },
      canSwitch: () => canSwitchTab(holders),
    };
  });
  return (
    <TabSwitchLockContext.Provider value={lock}>
      {children}
    </TabSwitchLockContext.Provider>
  );
}

/** 탭을 옮기는 쪽(밀기·탭 바)이 쓴다. 메인 탭 밖이면 null (막을 것이 없다) */
export function useTabSwitchLock(): TabSwitchLock | null {
  return useContext(TabSwitchLockContext);
}

/** active(새로고침 중)인 동안 탭 전환을 막는다. 끝나거나 화면이 사라지면 바로 푼다. 메인 탭 밖이면 아무 일도 하지 않는다 */
export function useHoldTabSwitchWhile(active: boolean) {
  const lock = useContext(TabSwitchLockContext);
  useLayoutEffect(
    () => (active && lock !== null ? lock.hold() : undefined),
    [active, lock],
  );
}
