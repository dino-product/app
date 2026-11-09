import { render } from '@testing-library/react-native';
import type {
  NavigationState,
  ParamListBase,
  TabNavigationState,
} from '@react-navigation/native';
import { BackHandler } from 'react-native';
import {
  backSwitchesTab,
  canSwitchTab,
  TabSwitchLockLayout,
  useHoldTabSwitchWhile,
  useTabSwitchLock,
  type TabSwitchLock,
} from './tabSwitchLock';

// 새로고침이 도는 동안에는 탭을 옮기지 않는다 (#177). 밀기·탭 바·Android 뒤로가기가 그때그때 묻는다
const KEYS = ['home', 'schedule', 'history', 'my'] as const;
function tabState(
  index: number,
  nested: Partial<Record<(typeof KEYS)[number], number>> = {},
): TabNavigationState<ParamListBase> {
  return {
    stale: false,
    type: 'tab',
    key: 'tabs',
    index,
    routeNames: [...KEYS],
    routes: KEYS.map(key => ({
      key,
      name: key,
      ...(nested[key] === undefined
        ? {}
        : {
            state: {
              index: nested[key],
              routes: [{ name: 'first' }, { name: 'second' }],
            } as unknown as NavigationState,
          }),
    })),
    history: [],
    preloadedRouteKeys: [],
  };
}

describe('canSwitchTab', () => {
  it('새로고침 중인 화면이 없을 때만 탭을 옮길 수 있다', () => {
    expect(canSwitchTab(0)).toBe(true);
    expect(canSwitchTab(1)).toBe(false);
    expect(canSwitchTab(2)).toBe(false);
  });
});

// backBehavior="firstRoute": 다른 탭 첫 화면에서 뒤로 가면 홈 탭으로, 홈 첫 화면에서는 앱을 나간다
describe('backSwitchesTab', () => {
  it('홈이 아닌 탭의 첫 화면에서는 뒤로 가기가 탭을 바꾼다', () => {
    expect(backSwitchesTab(tabState(1))).toBe(true);
    expect(backSwitchesTab(tabState(2, { history: 0 }))).toBe(true);
  });

  it('홈 탭에서는 앱을 나가고, 탭 안쪽 화면에서는 그 스택에서 돌아가므로 탭을 바꾸지 않는다', () => {
    expect(backSwitchesTab(tabState(0))).toBe(false);
    expect(backSwitchesTab(tabState(0, { home: 0 }))).toBe(false);
    expect(backSwitchesTab(tabState(2, { history: 1 }))).toBe(false);
  });
});

type Harness = {
  lock: TabSwitchLock | null;
  focused: boolean;
};

function renderLayout(
  state: TabNavigationState<ParamListBase>,
  harness: Harness,
  children: React.ReactNode = null,
) {
  function Peek() {
    harness.lock = useTabSwitchLock();
    return null;
  }
  const navigation = { isFocused: () => harness.focused };
  return render(
    <TabSwitchLockLayout state={state} navigation={navigation}>
      <Peek />
      {children}
    </TabSwitchLockLayout>,
  );
}

function Refreshing({ active }: { active: boolean }) {
  useHoldTabSwitchWhile(active);
  return null;
}

describe('TabSwitchLockLayout · useHoldTabSwitchWhile', () => {
  type Handler = Parameters<typeof BackHandler.addEventListener>[1];
  let handlers: Set<Handler>;
  /** RN BackHandler 처럼 나중에 등록한 핸들러부터 부르고, 하나가 처리하면 멈춘다 */
  const pressBack = () =>
    [...handlers].reverse().some(handler => handler(undefined as never));

  beforeEach(() => {
    handlers = new Set();
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        handlers.add(handler);
        return { remove: () => handlers.delete(handler) };
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('새로고침하는 화면이 있는 동안만 탭을 옮길 수 없고, 끝나면 바로 옮길 수 있다', async () => {
    const harness: Harness = { lock: null, focused: true };
    const view = await renderLayout(
      tabState(1),
      harness,
      <Refreshing active={false} />,
    );
    expect(harness.lock?.canSwitch()).toBe(true);

    await view.rerender(
      <TabSwitchLockLayout
        state={tabState(1)}
        navigation={{ isFocused: () => true }}
      >
        <Refreshing active />
      </TabSwitchLockLayout>,
    );
    expect(harness.lock?.canSwitch()).toBe(false);

    await view.rerender(
      <TabSwitchLockLayout
        state={tabState(1)}
        navigation={{ isFocused: () => true }}
      >
        <Refreshing active={false} />
      </TabSwitchLockLayout>,
    );
    expect(harness.lock?.canSwitch()).toBe(true);
  });

  it('새로고침하던 화면이 사라지면(로그아웃 등) 잠금도 풀린다', async () => {
    const harness: Harness = { lock: null, focused: true };
    const view = await renderLayout(
      tabState(1),
      harness,
      <Refreshing active />,
    );
    expect(harness.lock?.canSwitch()).toBe(false);

    await view.rerender(
      <TabSwitchLockLayout
        state={tabState(1)}
        navigation={{ isFocused: () => true }}
      >
        {null}
      </TabSwitchLockLayout>,
    );
    expect(harness.lock?.canSwitch()).toBe(true);
  });

  it('여러 화면이 잡으면 모두 놓아야 풀리고, 같은 잠금을 두 번 놓아도 다른 잠금은 그대로다', async () => {
    const harness: Harness = { lock: null, focused: true };
    await renderLayout(tabState(1), harness);
    const lock = harness.lock as TabSwitchLock;

    const releaseA = lock.hold();
    const releaseB = lock.hold();
    releaseA();
    releaseA();
    expect(lock.canSwitch()).toBe(false);
    releaseB();
    expect(lock.canSwitch()).toBe(true);
  });

  it('탭 내비게이터 밖(잠금이 없음)에서는 아무 일도 하지 않는다', async () => {
    await expect(render(<Refreshing active />)).resolves.toBeDefined();
  });

  it('Android 뒤로가기: 새로고침 중 다른 탭 첫 화면에서는 홈 탭으로 가지 않는다 (잡는 동안만 듣는다)', async () => {
    const harness: Harness = { lock: null, focused: true };
    await renderLayout(tabState(1), harness);
    const lock = harness.lock as TabSwitchLock;
    expect(handlers.size).toBe(0);

    const release = lock.hold();
    expect(pressBack()).toBe(true);
    release();
    expect(handlers.size).toBe(0);
  });

  it('Android 뒤로가기: 새로고침 중이어도 홈 탭(앱을 나간다)·탭 위에 연 화면에서는 막지 않는다', async () => {
    const harness: Harness = { lock: null, focused: true };
    const view = await renderLayout(tabState(0), harness);
    const lock = harness.lock as TabSwitchLock;
    lock.hold();
    expect(pressBack()).toBe(false);

    // 탭 위에 루트 화면(요청 상세 등)이 열려 메인이 포커스가 아니다
    await view.rerender(
      <TabSwitchLockLayout
        state={tabState(1)}
        navigation={{ isFocused: () => false }}
      >
        {null}
      </TabSwitchLockLayout>,
    );
    expect(pressBack()).toBe(false);
  });
});
