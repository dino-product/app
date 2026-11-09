import type {
  ParamListBase,
  TabNavigationState,
} from '@react-navigation/native';
import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';
import { Animated } from 'react-native';
import { useReduceMotionEnabled } from '../../shared/accessibility/useReduceMotion';
import { TabEnterContext } from '../../shared/layout/tabEnter';
import { TAB_ENTER_TIMING, tabEnterStart } from './tabTransition';

// 탭을 옮길 때 새 탭의 내용이 들어오는 값을 만든다 (#176, tabTransition.ts).
//
// #140 은 bottom-tabs 의 장면 애니메이션으로 탭 화면 전체를 옮겼다. 그 애니메이션은 BottomTabView 의 useEffect(패시브)에서
// 시작해, 처음 여는 탭(lazy)이면 그 탭 전체를 처음 그리고 마운트한 커밋이 끝나고 새 화면의 패시브 효과(조회 구독 등)까지
// 돈 뒤에야 시작했다. 새 화면은 그 사이 +24 에 멈춰 보였다. 이미 연 탭은 그릴 것이 적어 바로 시작한다.
// 홈(맨 왼쪽)에서 시작하면 오른쪽 탭은 대개 처음 열고 왼쪽 탭은 이미 연 탭이라, 오른쪽으로 갈 때만 멈칫했다.
//
// 여기서는 탭이 바뀌는 그 렌더에서 시작 값(±거리)을 만들어 새 탭의 첫 커밋부터 그 자리에 그리고, 커밋 직후 layout effect 에서
// 바로 시작한다 (자식의 패시브 효과를 기다리지 않는다). 처음 여는 탭이든 이미 연 탭이든, 왼쪽이든 오른쪽이든 같은 경로다.
// 장면(탭 화면)에는 애니메이션이 없어 바로 바뀐다

type Enter = {
  index: number;
  key: string;
  /** 지금 들어오는 탭 내용의 가로 위치. 처음 그릴 때·동작 줄이기면 null (옮기지 않는다) */
  shift: Animated.Value | null;
};

const EnterContext = createContext<Enter | null>(null);

/** 탭 내비게이터의 layout 으로 쓴다. 지금 탭이 바뀌면 들어오는 값을 새로 만든다 */
export function TabEnterLayout({
  state,
  children,
}: {
  state: TabNavigationState<ParamListBase>;
  children: ReactNode;
}) {
  const reduceMotion = useReduceMotionEnabled();
  const focusedKey = state.routes[state.index].key;
  const [enter, setEnter] = useState<Enter>(() => ({
    index: state.index,
    key: focusedKey,
    shift: null,
  }));
  // 앞 렌더의 탭과 다르면 이번 렌더에서 바로 바꾼다 (탭이 바뀐 커밋에 새 값이 함께 들어간다)
  if (enter.key !== focusedKey) {
    const start = tabEnterStart(enter.index, state.index);
    setEnter({
      index: state.index,
      key: focusedKey,
      // 처음부터 네이티브 값으로 만든다. 시작할 때 네이티브로 바뀌며 내용 뷰를 한 번 더 그리지 않게 한다
      shift:
        reduceMotion || start === 0
          ? null
          : new Animated.Value(start, { useNativeDriver: true }),
    });
  }
  const { shift } = enter;
  useLayoutEffect(() => {
    if (shift === null) {
      return;
    }
    const animation = Animated.timing(shift, TAB_ENTER_TIMING);
    animation.start();
    return () => animation.stop();
  }, [shift]);
  return (
    <EnterContext.Provider value={enter}>{children}</EnterContext.Provider>
  );
}

/** 탭 화면 하나를 감싼다. 지금 들어오는 탭에만 값을 넘긴다 (다른 탭의 내용은 옮기지 않는다) */
export function TabEnterScope({
  routeKey,
  children,
}: {
  routeKey: string;
  children: ReactNode;
}) {
  const enter = useContext(EnterContext);
  const shift = enter?.key === routeKey ? enter.shift : null;
  return (
    <TabEnterContext.Provider value={shift}>
      {children}
    </TabEnterContext.Provider>
  );
}
