import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  TabActions,
  type ParamListBase,
  type TabNavigationState,
} from '@react-navigation/native';
import {
  createContext,
  memo,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotionEnabled } from '../../../shared/accessibility/useReduceMotion';
import { colors } from '../../../shared/design-system';
import {
  TabCoverContext,
  type TabCoverDrag,
} from '../../../shared/gesture/tabCover';
import { haptic } from '../../../shared/haptics/haptic';
import {
  EDGE_RETURN_MS,
  FOLLOW_BEFORE,
  FOLLOW_MS,
  SETTLE_MS,
  coverEasing,
  coverStyles,
  edgeResistance,
  nextFollow,
  settleDuration,
  type Follow,
} from './coverMotion';

// 메인 탭 화면을 직접 그리는 탭 뷰 (#216). bottom-tabs 의 BottomTabView 는 탭을 바꾼 뒤에야 그 탭을 그리고(처음 여는 탭은
// 그리지도 않는다) 바뀌는 동안 손가락을 따라 옮길 수 없어, 덮기 전환을 위해 장면을 여기서 그린다. 탭 상태·라우터·옵션·
// 탭 바(MainTabBar)·화면 layout 은 그대로 React Navigation 의 TabRouter 를 쓴다 (createCoverTabNavigator).
//
// - 끌기(drag): 탭 화면의 TabSwipeArea 가 TabCoverContext 로 손가락을 넘긴다. 이웃 탭 화면을 그려(처음이면 이때 마운트)
//   손가락을 따라 지금 화면 위로 덮고(coverMotion.ts), 놓을 때 정한 대로 마저 덮은 뒤 탭을 바꾸거나 원래대로 돌아온다.
//   탭 바는 탭이 바뀔 때 바뀐다 (미리 바꾸지 않는다). 끝 탭에서 바깥쪽으로 밀면 조금 버티다 돌아온다
// - 탭 바 누름 등 다른 길로 탭이 바뀌면(auto) 같은 덮기로 들어온다
// 한 번에 전환 하나다. 마무리하는 동안에는 새 끌기를 받지 않는다. 동작 줄이기면 따라오기만 하고 마무리는 바로다.
// 화면 위치·모서리·어둡기는 네이티브 값이라 UI 스레드에서 돈다. 끌기를 시작할 때와 끝낼 때만 다시 그린다

type Motion = {
  side: 1 | -1;
  finger: Animated.Value;
  follow: Animated.Value;
  edge: Animated.Value;
};

type Transition = {
  kind: 'drag' | 'auto';
  from: number;
  /** 덮는 탭. 끝 탭에서 바깥쪽으로 밀면 null */
  to: number | null;
  motion: Motion;
  /** 놓은 뒤 마무리 중이다 */
  settling: boolean;
  /** 끌어서 바꾸기로 정했고 탭 상태가 바뀌기를 기다린다 */
  landing: boolean;
};

type SceneStyle = Animated.WithAnimatedValue<StyleProp<ViewStyle>>;

const nativeValue = (value: number) =>
  new Animated.Value(value, { useNativeDriver: true });

function makeTransition(
  kind: Transition['kind'],
  from: number,
  to: number | null,
  side: 1 | -1,
): Transition {
  return {
    kind,
    from,
    to,
    settling: kind === 'auto',
    landing: false,
    motion: {
      side,
      finger: nativeValue(0),
      follow: nativeValue(kind === 'auto' ? 1 : FOLLOW_BEFORE),
      edge: nativeValue(0),
    },
  };
}

function timing(value: Animated.Value, toValue: number, duration: number) {
  return Animated.timing(value, {
    toValue,
    duration,
    easing: coverEasing,
    useNativeDriver: true,
  });
}

type TabSwitchFeedback = {
  /** 사용자가 탭 바로 이 탭(route key)을 눌러 옮긴다. 탭이 그리로 바뀌면 햅틱을 울린다 */
  markUserSwitch: (routeKey: string) => void;
};

const TabSwitchFeedbackContext = createContext<TabSwitchFeedback | null>(null);

/** 탭 바가 쓴다. 메인 탭 밖이면 null */
export function useTabSwitchFeedback(): TabSwitchFeedback | null {
  return useContext(TabSwitchFeedbackContext);
}

type Props = {
  state: TabNavigationState<ParamListBase>;
  navigation: BottomTabBarProps['navigation'];
  descriptors: BottomTabBarProps['descriptors'];
  tabBar: (props: BottomTabBarProps) => ReactNode;
};

export function CoverTabView({
  state,
  navigation,
  descriptors,
  tabBar,
}: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionEnabled();
  const [transition, setTransition] = useState<Transition | null>(null);
  /** 마지막으로 다 그린 탭. 탭 상태가 이것과 다르면 덮으며 들어온다 */
  const [shown, setShown] = useState(state.index);

  // 탭 상태에 맞춰 전환을 고른다 (그리는 중에 바로 바꿔 한 커밋에 들어가게 한다)
  if (transition?.landing && state.index !== transition.from) {
    // 바꾼 탭이 왔다 (또는 그사이 다른 길로 다른 탭이 왔다). 그 탭으로 쉰다
    setTransition(null);
    setShown(state.index);
  } else if (
    transition?.kind === 'drag' &&
    !transition.landing &&
    state.index !== transition.from
  ) {
    // 끄는 동안 다른 길로 탭이 바뀌었다. 끌던 것은 버린다
    setTransition(null);
    setShown(state.index);
  } else if (
    transition?.kind === 'auto' &&
    transition.to !== null &&
    state.index !== transition.to
  ) {
    // 들어오는 중에 또 바뀌었다. 지금 것은 끝난 것으로 보고 새로 들어온다
    setTransition(null);
    setShown(transition.to);
  } else if (transition === null && shown !== state.index) {
    if (reduceMotion || shown >= state.routes.length) {
      setShown(state.index);
    } else {
      setTransition(
        makeTransition(
          'auto',
          shown,
          state.index,
          state.index > shown ? 1 : -1,
        ),
      );
    }
  }

  // 그린 적 있는 탭만 둔다 (처음에는 지금 탭만). 덮을 탭은 끌기를 시작할 때 마운트한다
  const focusedKey = state.routes[state.index].key;
  const [loaded, setLoaded] = useState<string[]>([focusedKey]);
  const needed = [focusedKey, ...state.preloadedRouteKeys];
  if (transition) {
    needed.push(state.routes[transition.from]?.key);
    if (transition.to !== null) {
      needed.push(state.routes[transition.to]?.key);
    }
  }
  const missing = needed.filter(key => key && !loaded.includes(key));
  if (missing.length > 0) {
    setLoaded([...loaded, ...missing]);
  }

  /** 사용자가 밀거나 탭 바를 눌러 옮기는 탭(route key). 탭이 그리로 바뀔 때만 햅틱을 울린다 */
  const userSwitchTo = useRef<string | null>(null);
  const [feedback] = useState<TabSwitchFeedback>(() => ({
    markUserSwitch: routeKey => {
      userSwitchTo.current = routeKey;
    },
  }));

  const latest = useRef({ state, navigation, width, reduceMotion });
  useLayoutEffect(() => {
    latest.current = { state, navigation, width, reduceMotion };
  });

  const [cover] = useState(() => {
    /** 마무리(놓은 뒤·들어오는 중) 중이다 */
    let busy = false;
    /** 끄는 중이다 (begin 뒤 end·cancel 전) */
    let dragging = false;
    let drag: Transition | null = null;
    let follow: Follow | null = null;
    let lastDx = 0;
    /** 지금 따라오는 비율의 목표 (딸깍 전 0.8, 따라붙으면 1) */
    let followTarget = FOLLOW_BEFORE;
    /** 지금 그린 전환. 뷰가 전환을 버리면(다른 길로 탭이 바뀜) 끌기·마무리를 멈춘다 */
    let drawn: Transition | null = null;
    /** 놓은 뒤 마무리 애니메이션 */
    let settling: {
      transition: Transition;
      animation: Animated.CompositeAnimation;
    } | null = null;
    let disposed = false;

    const stillDrawn = (finished: Transition) =>
      !disposed && drawn?.motion === finished.motion;
    const done = (finished: Transition) => {
      busy = false;
      setTransition(current =>
        current?.motion === finished.motion ? null : current,
      );
      if (finished.kind === 'auto' && finished.to !== null) {
        setShown(finished.to);
      }
    };
    const land = (finished: Transition) => {
      busy = false;
      const { state: now, navigation: nav } = latest.current;
      const route = finished.to === null ? undefined : now.routes[finished.to];
      // 마무리하는 동안 탭이 다른 길로 바뀌었으면 바꾸지 않는다 (한 손길에 한 번)
      if (!route || now.index !== finished.from) {
        done(finished);
        return;
      }
      setTransition(current =>
        current?.motion === finished.motion
          ? { ...current, landing: true }
          : current,
      );
      userSwitchTo.current = route.key;
      nav.dispatch({
        ...TabActions.jumpTo(route.name, route.params),
        target: now.key,
      });
      // 바꾸기가 받아들여지지 않았으면 기다리지 않고 원래 탭으로 쉰다
      if (nav.getState().index !== finished.to) {
        done(finished);
      }
    };
    const snapFollow = (motion: Motion, to: number) => {
      followTarget = to;
      if (latest.current.reduceMotion) {
        motion.follow.setValue(to);
      } else {
        timing(motion.follow, to, FOLLOW_MS).start();
      }
    };
    const stopSettling = () => {
      const running = settling;
      settling = null;
      running?.animation.stop();
    };

    const controller: TabCoverDrag & {
      sync: (current: Transition | null) => void;
      startAuto: (auto: Transition) => () => void;
      dispose: () => void;
    } = {
      begin: () => {
        if (busy || dragging || drawn !== null) {
          return false;
        }
        dragging = true;
        drag = null;
        follow = null;
        return true;
      },
      move: (dx, switchDistance) => {
        if (!dragging) {
          return;
        }
        lastDx = dx;
        const { state: now } = latest.current;
        const side: 1 | -1 = dx < 0 ? 1 : dx > 0 ? -1 : drag?.motion.side ?? 1;
        if (!drag || drag.motion.side !== side) {
          const to = now.index + side;
          drag = makeTransition(
            'drag',
            now.index,
            to >= 0 && to < now.routes.length ? to : null,
            side,
          );
          follow = null;
          followTarget = FOLLOW_BEFORE;
          setTransition(drag);
        }
        const distance = Math.abs(dx);
        if (drag.to === null) {
          drag.motion.edge.setValue(edgeResistance(dx));
          return;
        }
        drag.motion.finger.setValue(distance);
        const next = nextFollow(follow, distance, switchDistance);
        follow = next.follow;
        if (next.snap) {
          snapFollow(drag.motion, next.snap === 'in' ? 1 : FOLLOW_BEFORE);
        }
      },
      end: (dx, commit) => {
        if (!dragging) {
          return;
        }
        dragging = false;
        const finished = drag;
        drag = null;
        follow = null;
        if (!finished) {
          return;
        }
        busy = true;
        setTransition(current =>
          current?.motion === finished.motion
            ? { ...current, settling: true }
            : current,
        );
        const { width: w, reduceMotion: reduce } = latest.current;
        const { motion } = finished;
        let animation: Animated.CompositeAnimation;
        if (finished.to === null) {
          animation = timing(motion.edge, 0, reduce ? 0 : EDGE_RETURN_MS);
        } else {
          // 손가락 거리는 놓은 자리(화면 폭까지)에서 끝(바꾸면 화면 폭, 아니면 0)으로 간다.
          // 바꿀 때는 따라오는 비율도 1 로 마저 간다 (돌아갈 때는 비율을 그대로 둬야 되밀리지 않는다)
          const from = Math.min(w, Math.abs(dx));
          const to = commit ? w : 0;
          const duration = reduce
            ? 0
            : settleDuration(from * followTarget, to, w);
          motion.finger.setValue(from);
          const settle = timing(motion.finger, to, duration);
          animation =
            commit && followTarget !== 1
              ? Animated.parallel([
                  timing(motion.follow, 1, reduce ? 0 : FOLLOW_MS),
                  settle,
                ])
              : settle;
        }
        settling = { transition: finished, animation };
        animation.start(({ finished: completed }) => {
          if (settling?.transition !== finished) {
            return;
          }
          settling = null;
          if (!completed || !stillDrawn(finished)) {
            busy = false;
            return;
          }
          if (commit && finished.to !== null) {
            land(finished);
          } else {
            done(finished);
          }
        });
      },
      cancel: () => controller.end(lastDx, false),
      sync: current => {
        drawn = current;
        if (dragging && drag && current?.motion !== drag.motion) {
          // 뷰가 끌기를 버렸다 (끄는 중에 탭이 다른 길로 바뀜)
          dragging = false;
          drag = null;
          follow = null;
        }
        if (settling && current?.motion !== settling.transition.motion) {
          // 마무리하는 동안 탭이 다른 길로 바뀌었다. 마무리를 멈추고 바꾸지 않는다
          stopSettling();
          busy = false;
        }
      },
      dispose: () => {
        disposed = true;
        stopSettling();
      },
      startAuto: auto => {
        busy = true;
        const animation = timing(
          auto.motion.finger,
          latest.current.width,
          SETTLE_MS,
        );
        animation.start(({ finished }) => {
          if (finished) {
            done(auto);
          }
        });
        return () => {
          animation.stop();
          busy = false;
        };
      },
    };
    return controller;
  });

  useLayoutEffect(() => {
    cover.sync(transition);
  }, [cover, transition]);
  // 사용자가 밀거나 탭 바를 눌러 옮긴 탭으로 실제로 바뀌는 순간에만 햅틱을 한 번 울린다 (#230).
  // 미는 도중·놓기만 한 때·원래 탭으로 돌아갈 때·지금 탭을 다시 누를 때는 울리지 않는다.
  // 다른 길(Android 뒤로가기는 시스템 햅틱이 따로 있다, 알림·화면 안 버튼)로 바뀐 탭도 울리지 않는다
  const switchedFrom = useRef(state.index);
  useEffect(() => {
    if (switchedFrom.current === state.index) {
      return;
    }
    switchedFrom.current = state.index;
    if (userSwitchTo.current === state.routes[state.index]?.key) {
      haptic.tabSwitch();
    }
    userSwitchTo.current = null;
  }, [state.index, state.routes]);
  useLayoutEffect(() => cover.dispose, [cover]);
  useLayoutEffect(
    () =>
      transition?.kind === 'auto' ? cover.startAuto(transition) : undefined,
    // 들어오는 전환이 새로 생길 때만 시작한다 (landing 등으로 객체가 바뀌어도 같은 움직임이다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cover, transition?.motion],
  );

  const motion = transition?.motion ?? null;
  const motionStyles = useMemo(
    () => (motion ? coverStyles(motion, width) : null),
    [motion, width],
  );

  const scenes = state.routes.map((route, index) => {
    if (!loaded.includes(route.key)) {
      return null;
    }
    const focused = index === state.index;
    // 지금 탭만 터치를 받는다. 다만 밀어서 놓은 뒤 마무리하는 동안의 지금 탭은 덮여 안 보이므로 받지 않는다
    // (탭 바로 들어오는 동안의 지금 탭은 위에서 들어오는 화면이라 받는다)
    const touchable =
      focused &&
      !(
        transition?.kind === 'drag' &&
        (transition.settling || transition.landing)
      );
    let style: SceneStyle = focused ? styles.rest : styles.hidden;
    if (transition && motionStyles) {
      if (index === transition.from) {
        style = [
          styles.rest,
          transition.to === null ? motionStyles.edge : motionStyles.under,
        ];
      } else if (index === transition.to) {
        style = [styles.over, motionStyles.over];
      } else {
        style = styles.hidden;
      }
    }
    return (
      <CoverScene
        key={route.key}
        focused={focused}
        touchable={touchable}
        style={style}
        render={descriptors[route.key].render}
      />
    );
  });

  return (
    <View style={styles.container}>
      <TabSwitchFeedbackContext.Provider value={feedback}>
        <TabCoverContext.Provider value={cover}>
          <View style={styles.scenes}>
            {scenes}
            {motionStyles && transition?.to !== null ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.scrim, motionStyles.scrim]}
              />
            ) : null}
          </View>
        </TabCoverContext.Provider>
        {tabBar({ state, descriptors, navigation, insets })}
      </TabSwitchFeedbackContext.Provider>
    </View>
  );
}

const CoverScene = memo(function Scene({
  focused,
  touchable,
  style,
  render,
}: {
  focused: boolean;
  touchable: boolean;
  style: SceneStyle;
  render: () => ReactNode;
}) {
  // 층(위치·스타일)이 바뀌어도 탭 화면 내용은 다시 그리지 않는다 (탭 전환 렌더 예산)
  const content = useMemo(render, [render]);
  return (
    <Animated.View
      style={style}
      pointerEvents={touchable ? 'box-none' : 'none'}
      accessibilityElementsHidden={!focused}
      importantForAccessibility={focused ? 'auto' : 'no-hide-descendants'}
    >
      {content}
    </Animated.View>
  );
});

const fill = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scenes: {
    flex: 1,
    overflow: 'hidden',
    // 둥근 모서리 뒤로 보이는 바탕
    backgroundColor: colors.primary,
  },
  rest: {
    ...fill,
    zIndex: 1,
    overflow: 'hidden',
    backgroundColor: colors.white[100],
  },
  over: {
    ...fill,
    zIndex: 3,
    overflow: 'hidden',
    backgroundColor: colors.white[100],
  },
  hidden: { ...fill, display: 'none' },
  scrim: {
    ...fill,
    zIndex: 2,
    backgroundColor: colors.black,
  },
});
