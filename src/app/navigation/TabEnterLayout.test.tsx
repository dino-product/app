import { act, render } from '@testing-library/react-native';
import type {
  ParamListBase,
  TabNavigationState,
} from '@react-navigation/native';
import { useContext, useEffect } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { holdNativeAnimations } from '../../../jest/nativeAnimation';
import { TabEnterContext } from '../../shared/layout/tabEnter';
import { TabEnterLayout, TabEnterScope } from './TabEnterLayout';
import { TAB_ENTER_OFFSET, TAB_ENTER_TIMING } from './tabTransition';

// 탭이 바뀌면 들어오는 탭에만 시작 값(±거리)을 주고, 탭이 바뀐 커밋 직후 바로 시작한다 (#176)
const KEYS = ['home', 'schedule', 'history', 'my'] as const;
const stateAt = (index: number): TabNavigationState<ParamListBase> => ({
  stale: false,
  type: 'tab',
  key: 'tabs',
  index,
  routeNames: [...KEYS],
  routes: KEYS.map(key => ({ key, name: key })),
  history: [],
  preloadedRouteKeys: [],
});

type Log = string[];
/** 렌더할 때 받은 들어오는 값을 남기고, 커밋 뒤 패시브 효과가 돈 때를 남긴다 */
function Content({ name, log }: { name: string; log: Log }) {
  const shift = useContext(TabEnterContext);
  log.push(
    `${name} render ${
      shift ? (shift as unknown as { _value: number })._value : 'none'
    }`,
  );
  useEffect(() => {
    log.push(`${name} passive effect`);
  });
  return null;
}

function Tabs({ index, log }: { index: number; log: Log }) {
  const state = stateAt(index);
  return (
    <TabEnterLayout state={state}>
      {KEYS.map((key, i) =>
        // 처음 여는 탭처럼 지금 탭만 그린다 (lazy)
        i === index ? (
          <TabEnterScope key={key} routeKey={key}>
            <Content name={key} log={log} />
          </TabEnterScope>
        ) : null,
      )}
    </TabEnterLayout>
  );
}

function spyStarts(log: Log) {
  const timing = Animated.timing;
  return jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    const animation = timing(value, config);
    return {
      ...animation,
      start: callback => {
        log.push(`start ${config === TAB_ENTER_TIMING ? 'enter' : 'other'}`);
        animation.start(callback);
      },
    };
  });
}

describe('TabEnterLayout', () => {
  beforeEach(() => {
    holdNativeAnimations();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockImplementation(() => Promise.resolve(false));
  });

  it('처음 그릴 때는 옮기지 않는다', async () => {
    const log: Log = [];
    spyStarts(log);

    await render(<Tabs index={0} log={log} />);

    expect(log).toEqual(['home render none', 'home passive effect']);
  });

  it('오른쪽 탭은 +거리, 왼쪽 탭은 -거리에서 그 탭의 첫 렌더부터 그린다', async () => {
    const log: Log = [];
    const view = await render(<Tabs index={0} log={log} />);

    log.length = 0;
    await view.rerender(<Tabs index={2} log={log} />);
    expect(log[0]).toBe(`history render ${TAB_ENTER_OFFSET}`);

    log.length = 0;
    await view.rerender(<Tabs index={1} log={log} />);
    expect(log[0]).toBe(`schedule render ${-TAB_ENTER_OFFSET}`);
  });

  // #140 은 BottomTabView 의 패시브 효과에서 시작해, 처음 여는 탭이면 새 화면의 패시브 효과(조회 구독 등)가 다 돈 뒤에야 움직였다
  it('처음 여는 탭도 새 화면의 패시브 효과를 기다리지 않고 탭이 바뀐 커밋 직후 같은 설정으로 시작한다', async () => {
    const log: Log = [];
    const view = await render(<Tabs index={0} log={log} />);
    spyStarts(log);

    log.length = 0;
    await view.rerender(<Tabs index={3} log={log} />);
    expect(log).toEqual([
      `my render ${TAB_ENTER_OFFSET}`,
      'start enter',
      'my passive effect',
    ]);

    log.length = 0;
    await view.rerender(<Tabs index={0} log={log} />);
    expect(log).toEqual([
      `home render ${-TAB_ENTER_OFFSET}`,
      'start enter',
      'home passive effect',
    ]);
  });

  it('들어오는 탭이 아닌 탭에는 값을 주지 않는다', async () => {
    const seen: Array<Animated.Value | null> = [];
    function Peek() {
      seen.push(useContext(TabEnterContext));
      return null;
    }
    const view = await render(
      <TabEnterLayout state={stateAt(0)}>
        <TabEnterScope routeKey="home">
          <Peek />
        </TabEnterScope>
      </TabEnterLayout>,
    );

    seen.length = 0;
    await view.rerender(
      <TabEnterLayout state={stateAt(1)}>
        <TabEnterScope routeKey="home">
          <Peek />
        </TabEnterScope>
      </TabEnterLayout>,
    );

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(value => value === null)).toBe(true);
  });

  it('동작 줄이기면 옮기지 않는다', async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(true);
    const log: Log = [];
    spyStarts(log);
    const view = await render(<Tabs index={0} log={log} />);
    await act(async () => {});

    log.length = 0;
    await view.rerender(<Tabs index={1} log={log} />);

    expect(log).toEqual(['schedule render none', 'schedule passive effect']);
  });

  it('들어오는 중에 다른 탭으로 옮기면 앞 애니메이션을 멈추고 새로 시작한다', async () => {
    const log: Log = [];
    const view = await render(<Tabs index={0} log={log} />);
    const stop = jest.fn();
    const timing = Animated.timing;
    jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      const animation = timing(value, config);
      return {
        ...animation,
        stop: () => {
          stop();
          animation.stop();
        },
      };
    });

    await view.rerender(<Tabs index={1} log={log} />);
    expect(stop).not.toHaveBeenCalled();
    await view.rerender(<Tabs index={2} log={log} />);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
