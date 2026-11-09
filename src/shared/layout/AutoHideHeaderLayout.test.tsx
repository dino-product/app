import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Animated,
  NativeModules,
  Platform,
  StyleSheet,
  Text,
} from 'react-native';
import { holdNativeAnimations } from '../../../jest/nativeAnimation';
import {
  autoHideHeader,
  autoHideHeaderOffset,
  scrollDownFromTop,
  scrollListTo,
} from '../testing/autoHideHeader';
import { AutoHideHeaderLayout } from './AutoHideHeaderLayout';
import { TabEnterContext } from './tabEnter';
import { TabHeader, TAB_HEADER_HEIGHT } from './TabHeader';
import {
  AUTO_HIDE_MS,
  useAutoHideHeader,
  type AutoHideHeaderEstimate,
} from './useAutoHideHeader';

// 탭 첫 화면처럼 상단 바와 리스트 하나를 그린다
const items = Array.from({ length: 40 }, (_, index) => `항목 ${index}`);

function Harness({
  onOpenNotifications = () => {},
  estimate,
  sticky,
}: {
  onOpenNotifications?: () => void;
  estimate?: AutoHideHeaderEstimate;
  sticky?: React.ReactNode;
}) {
  const autoHide = useAutoHideHeader(estimate);
  return (
    <AutoHideHeaderLayout
      autoHide={autoHide}
      header={
        <TabHeader title="내 작업" onOpenNotifications={onOpenNotifications} />
      }
      sticky={sticky}
      style={headerBackground}
    >
      <Animated.FlatList
        testID="list"
        {...autoHide.scrollProps}
        data={items}
        keyExtractor={item => item}
        renderItem={({ item }) => <Text>{item}</Text>}
        progressViewOffset={autoHide.progressViewOffset}
        contentContainerStyle={{ paddingTop: autoHide.height }}
      />
    </AutoHideHeaderLayout>
  );
}

const headerBackground = { backgroundColor: '#F7F8FA' };

const header = autoHideHeader;
const list = () => screen.getByTestId('list');
const scrollTo = (y: number) => scrollListTo(list(), y);
const scrollDown = () => scrollDownFromTop(list());
const layout = (height: number) => ({
  nativeEvent: { layout: { x: 0, y: 0, width: 390, height } },
});

/**
 * 스크롤 이벤트를 실기기처럼 보낸다. 실기기에서는 네이티브 드라이버 스크롤 이벤트(Animated.event)가 UI 스레드에서
 * 스크롤 위치 값을 옮기지만 테스트에서는 옮기지 않는다. 렌더 전에 불러 Animated.event 를 지켜보다가 스크롤 위치를
 * 받는 값이 있으면 같은 위치로 옮긴다 (머리가 스크롤 위치를 네이티브로 따라가는지까지 확인한다)
 */
function scrollLikeDevice() {
  const event = jest.spyOn(Animated, 'event');
  return async (y: number) => {
    await scrollTo(y);
    const nativeValues = event.mock.calls.flatMap(([mapping]) => {
      const value = (
        mapping as [{ nativeEvent?: { contentOffset?: { y?: unknown } } }]
      )[0]?.nativeEvent?.contentOffset?.y;
      return value instanceof Animated.Value ? [value] : [];
    });
    await act(() => nativeValues.forEach(value => value.setValue(y)));
  };
}

let finishAnimations: () => Promise<void>;

describe('AutoHideHeaderLayout · useAutoHideHeader (#148)', () => {
  beforeEach(() => {
    finishAnimations = holdNativeAnimations().finish;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('배치', () => {
    it('상단 바는 스크롤 뷰 앞(읽는 순서)에 두고, 리스트 위에 겹쳐 맨 위에 붙인다', async () => {
      await render(<Harness />);

      expect(header()).toHaveStyle({
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1,
        backgroundColor: '#F7F8FA',
      });
      // 머리와 리스트가 형제이고 머리가 먼저다
      const siblings = header().parent?.children;
      expect(siblings?.[0]).toBe(header());
      expect(header().parent).toHaveStyle({ flex: 1, overflow: 'hidden' });
    });

    // 빈 곳을 끌면 아래 리스트가 스크롤된다. 종 같은 버튼은 그대로 누를 수 있다
    it('머리의 빈 곳은 터치를 받지 않아 아래 리스트로 넘긴다', async () => {
      await render(<Harness />);

      expect(header()).toHaveStyle({ pointerEvents: 'box-none' });
    });

    it('내용 위 여백은 처음에 기본 글자 크기의 상단 바 높이이고, 잰 높이로 바뀐다', async () => {
      await render(<Harness />);
      const contentTop = () =>
        StyleSheet.flatten(
          screen.getByTestId('list').props.contentContainerStyle,
        ).paddingTop;

      expect(TAB_HEADER_HEIGHT).toBe(46);
      expect(contentTop()).toBe(46);

      await fireEvent(header(), 'layout', layout(58));
      expect(contentTop()).toBe(58);
    });

    // 픽셀 반올림 정도의 차이로는 화면을 다시 그리지 않는다
    it('잰 높이가 1pt 보다 적게 다르면 내용 위 여백을 그대로 둔다', async () => {
      await render(<Harness />);

      await fireEvent(header(), 'layout', layout(46.33));

      expect(
        StyleSheet.flatten(
          screen.getByTestId('list').props.contentContainerStyle,
        ).paddingTop,
      ).toBe(46);
    });

    // 상단 바는 당겨도 맨 위에 붙어 있다(#178). 새로고침 표시는 리스트 맨 위(상단 바 뒤)에 그려지므로 두 플랫폼 모두
    // 머리 높이만큼 아래로 내려 상단 바 바로 아래에 보이게 한다
    it.each(['ios', 'android'] as const)(
      '당겨서 새로고침 표시를 머리 아래로 내린다 (%s)',
      async os => {
        jest.replaceProperty(Platform, 'OS', os);
        await render(<Harness />);
        expect(screen.getByTestId('list')).toHaveProp('progressViewOffset', 46);

        // 하위 탭처럼 늘 보이는 부분까지 머리 전체 아래로 내린다
        await fireEvent(header(), 'layout', layout(108));
        expect(screen.getByTestId('list')).toHaveProp(
          'progressViewOffset',
          108,
        );
      },
    );

    it('스크롤 표시줄은 상단 바 아래에서 시작한다 (iOS)', async () => {
      await render(<Harness />);

      expect(screen.getByTestId('list')).toHaveProp('scrollIndicatorInsets', {
        top: 46,
      });
    });

    // Animated.View 는 배열·객체 props 를 참조로 비교해 바뀌면 네이티브 애니메이션 연결을 새로 만든다.
    // 화면이 다시 그려져 상단 바 요소가 새로 만들어져도 머리의 연결은 그대로 둔다
    it('화면이 다시 그려져도 머리의 애니메이션 연결을 다시 만들지 않는다', async () => {
      const view = await render(<Harness />);
      const connect = jest
        .spyOn(NativeModules.NativeAnimatedModule, 'connectAnimatedNodeToView')
        .mockClear();

      await view.rerender(<Harness onOpenNotifications={() => {}} />);
      await view.rerender(<Harness sticky={<Text>하위 탭</Text>} />);

      expect(connect).not.toHaveBeenCalled();
    });

    it('스크롤 위치는 한 프레임(16ms)마다 받는다', async () => {
      await render(<Harness />);

      expect(screen.getByTestId('list')).toHaveProp('scrollEventThrottle', 16);
    });
  });

  describe('숨김·다시 보임', () => {
    it('아래로 스크롤하면 상단 바가 UI 스레드 애니메이션으로 위로 올라가 숨는다', async () => {
      const timing = jest.spyOn(Animated, 'timing');
      await render(<Harness />);

      await scrollDown();

      expect(timing).toHaveBeenCalledTimes(1);
      expect(timing.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          toValue: 1,
          duration: AUTO_HIDE_MS,
          useNativeDriver: true,
        }),
      );
      await finishAnimations();
      expect(autoHideHeaderOffset()).toBe(-46);
    });

    it('숨은 상태에서 위로 스크롤을 시작하면 맨 위까지 가지 않아도 부드럽게 다시 내려온다', async () => {
      const timing = jest.spyOn(Animated, 'timing');
      await render(<Harness />);
      await scrollDown();
      await finishAnimations();

      await scrollTo(280);

      expect(timing).toHaveBeenCalledTimes(2);
      expect(timing.mock.calls[1][1]).toEqual(
        expect.objectContaining({
          toValue: 0,
          duration: AUTO_HIDE_MS,
          useNativeDriver: true,
        }),
      );
      await finishAnimations();
      expect(autoHideHeaderOffset()).toBe(0);
    });

    it('맨 위 근처(상단 바 높이 이내)에서는 숨지 않는다', async () => {
      const timing = jest.spyOn(Animated, 'timing');
      await render(<Harness />);

      for (const y of [0, 15, 30, 45]) {
        await scrollTo(y);
      }

      expect(timing).not.toHaveBeenCalled();
    });

    // 숨는 거리는 상단 바 높이다. 아래에 늘 보이는 부분(내 일정 하위 탭)이 있으면 그 부분은 화면 맨 위로 올라와 남는다
    it('숨는 거리는 상단 바 높이이고, 늘 보이는 부분은 남는다', async () => {
      await render(
        <Harness
          estimate={{ collapsible: 62, total: 108 }}
          sticky={<Text>하위 탭</Text>}
        />,
      );
      expect(
        StyleSheet.flatten(
          screen.getByTestId('list').props.contentContainerStyle,
        ).paddingTop,
      ).toBe(108);

      await scrollDown();
      await finishAnimations();
      expect(autoHideHeaderOffset()).toBe(-62);

      // 큰 글자에서 상단 바가 더 높으면 잰 높이만큼 숨는다
      await fireEvent(
        screen.getByTestId('auto-hide-header-collapsible'),
        'layout',
        layout(80),
      );
      await act(async () => {});
      await scrollTo(400);
      await scrollTo(380);
      await finishAnimations();
      await scrollTo(500);
      await finishAnimations();
      expect(autoHideHeaderOffset()).toBe(-80);
    });

    // iOS 맨 위 바운스·당겨서 새로고침은 위치가 음수가 된다. 상단 바가 내용을 따라 내려오면 화면 맨 위에서
    // 떨어져 보인다 (#178). 화면 맨 위에 붙어 있고, 새로고침 표시는 progressViewOffset 으로 그 아래에 보인다
    it('맨 위에서 더 당겨도(음수 위치) 상단 바는 맨 위에 붙어 있다', async () => {
      const pullTo = scrollLikeDevice();
      const view = await render(<Harness />);

      for (const y of [-30, -80, -120, -20, 0]) {
        await pullTo(y);
        await view.rerender(<Harness />);
        expect(autoHideHeaderOffset()).toBe(0);
      }
    });

    // 숨은 채 위로 세게 밀면 관성으로 맨 위를 넘어 튕긴다. 다시 보이는 상단 바도 맨 위를 넘어 내려오지 않는다
    it('숨은 채 맨 위를 넘어 튕겨 올라가도 다시 보인 상단 바는 맨 위에 멈춘다', async () => {
      const scrollOnDevice = scrollLikeDevice();
      const view = await render(<Harness />);
      await scrollDown();
      await finishAnimations();
      expect(autoHideHeaderOffset()).toBe(-46);

      for (const y of [150, 0, -50]) {
        await scrollOnDevice(y);
      }
      await finishAnimations();
      await view.rerender(<Harness />);

      expect(autoHideHeaderOffset()).toBe(0);
    });

    // 바깥(내 일정 하위 탭 전환, 리스트 대신 불러오기 화면)에서 바로 다시 보일 수 있다
    it('show 를 부르면 숨은 상단 바가 다시 보인다', async () => {
      let show = () => {};
      function Exposed() {
        const autoHide = useAutoHideHeader();
        show = autoHide.show;
        return (
          <AutoHideHeaderLayout
            autoHide={autoHide}
            header={<TabHeader title="내 작업" />}
            style={headerBackground}
          >
            <Animated.FlatList
              testID="list"
              {...autoHide.scrollProps}
              data={items}
              keyExtractor={item => item}
              renderItem={({ item }) => <Text>{item}</Text>}
            />
          </AutoHideHeaderLayout>
        );
      }
      await render(<Exposed />);
      await scrollDown();
      await finishAnimations();
      expect(autoHideHeaderOffset()).toBe(-46);

      await act(() => show());
      await finishAnimations();

      expect(autoHideHeaderOffset()).toBe(0);
    });

    // 하위 탭을 바꿔 다른 리스트가 그려지거나 화면 크기가 바뀌면 새 리스트는 맨 위다
    it('스크롤 뷰가 새로 자리 잡으면 상단 바를 다시 보인다', async () => {
      await render(<Harness />);
      await scrollDown();
      await finishAnimations();

      await fireEvent(screen.getByTestId('list'), 'layout', layout(600));
      await finishAnimations();

      expect(autoHideHeaderOffset()).toBe(0);
    });

    // 숨은 동안 내용이 줄어 상단 바 높이만큼도 스크롤할 수 없으면 스크롤 이벤트가 오지 않을 수 있다
    it('숨은 동안 내용이 짧아져 상단 바 높이만큼도 스크롤할 수 없으면 다시 보인다', async () => {
      await render(<Harness />);
      await fireEvent(list(), 'layout', layout(600));
      await scrollDown();
      await finishAnimations();
      expect(autoHideHeaderOffset()).toBe(-46);

      // 아직 상단 바 높이보다 길게 스크롤할 수 있으면 그대로다
      await fireEvent(list(), 'contentSizeChange', 390, 1500);
      await finishAnimations();
      expect(autoHideHeaderOffset()).toBe(-46);

      await fireEvent(list(), 'contentSizeChange', 390, 620);
      await finishAnimations();
      expect(autoHideHeaderOffset()).toBe(0);
    });

    it('화면을 닫으면 돌던 애니메이션을 멈춘다', async () => {
      const stop = jest.spyOn(Animated.Value.prototype, 'stopAnimation');
      const view = await render(<Harness />);
      await scrollDown();

      await view.unmount();

      expect(stop).toHaveBeenCalled();
    });
  });

  describe('접근성', () => {
    it('숨은 동안에도 상단 바와 종은 접근성 트리에 남는다', async () => {
      await render(<Harness />);
      await scrollDown();
      await finishAnimations();

      expect(autoHideHeaderOffset()).toBe(-46);
      expect(screen.getByRole('header', { name: '내 작업' })).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: '알림센터' }),
      ).toBeOnTheScreen();
    });

    it('다시 보인 뒤 종을 누르면 알림센터를 연다', async () => {
      const onOpenNotifications = jest.fn();
      await render(<Harness onOpenNotifications={onOpenNotifications} />);
      await scrollDown();
      await finishAnimations();
      await scrollTo(250);
      await finishAnimations();

      await userEvent.press(screen.getByRole('button', { name: '알림센터' }));

      expect(onOpenNotifications).toHaveBeenCalledTimes(1);
    });

    it('동작 줄이기면 애니메이션 없이 바로 숨고 바로 보인다', async () => {
      jest
        .mocked(AccessibilityInfo.isReduceMotionEnabled)
        .mockResolvedValueOnce(true);
      const timing = jest.spyOn(Animated, 'timing');
      const view = await render(<Harness />);
      await act(async () => {});

      // 네이티브 값을 바로 바꾼다. 테스트에서는 다시 그려야 그 값이 보인다
      await scrollDown();
      await view.rerender(<Harness />);
      expect(autoHideHeaderOffset()).toBe(-46);
      await scrollTo(250);
      await view.rerender(<Harness />);
      expect(autoHideHeaderOffset()).toBe(0);

      expect(timing).not.toHaveBeenCalled();
    });

    // 화면 밖으로 옮긴 버튼은 스크린리더로 두 번 탭해도 눌리지 않는다. 스크린리더를 쓰는 동안은 늘 보인다
    it('스크린리더가 켜져 있으면 스크롤해도 숨기지 않는다', async () => {
      jest
        .mocked(AccessibilityInfo.isScreenReaderEnabled)
        .mockResolvedValueOnce(true);
      const timing = jest.spyOn(Animated, 'timing');
      await render(<Harness />);
      await act(async () => {});

      await scrollDown();

      expect(timing).not.toHaveBeenCalled();
      expect(autoHideHeaderOffset()).toBe(0);
    });

    it('숨은 동안 스크린리더를 켜면 다시 보인다', async () => {
      // 프리셋 목은 공유 jest.fn 이라 앞 테스트의 기록을 지운다
      const listen = jest
        .spyOn(AccessibilityInfo, 'addEventListener')
        .mockClear();
      await render(<Harness />);
      await act(async () => {});
      await scrollDown();
      await finishAnimations();

      const screenReaderChanged = listen.mock.calls.find(
        ([event]) => event === 'screenReaderChanged',
      )?.[1] as (enabled: boolean) => void;
      await act(() => screenReaderChanged(true));
      await finishAnimations();

      expect(autoHideHeaderOffset()).toBe(0);
    });
  });
});

// 탭을 옮길 때 탭 화면 안의 내용만 옆에서 들어온다 (#176). 머리 바탕·화면 바탕은 제자리다
describe('AutoHideHeaderLayout — 탭 전환 때 내용만 옮긴다 (#176)', () => {
  beforeEach(() => {
    holdNativeAnimations();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function EnteringHarness({
    shift,
    title = '내 작업',
  }: {
    shift: Animated.Value | null;
    title?: string;
  }) {
    const autoHide = useAutoHideHeader();
    return (
      <TabEnterContext.Provider value={shift}>
        <AutoHideHeaderLayout
          autoHide={autoHide}
          header={<TabHeader title={title} />}
          sticky={<Text>하위 탭</Text>}
          style={headerBackground}
          bodyStyle={bodyBackground}
        >
          <Animated.FlatList
            testID="list"
            {...autoHide.scrollProps}
            data={items}
            keyExtractor={item => item}
            renderItem={({ item }) => <Text>{item}</Text>}
          />
        </AutoHideHeaderLayout>
      </TabEnterContext.Provider>
    );
  }

  const bodyBackground = { backgroundColor: '#EEF0F3' };
  const headerContent = () => screen.getByTestId('tab-enter-header');
  const bodyContent = () => screen.getByTestId('tab-enter-body');
  const translateXOf = (element: { props: { style?: unknown } }) =>
    (
      StyleSheet.flatten(element.props.style as never)?.transform as
        | Array<{ translateX?: number }>
        | undefined
    )?.find(item => item.translateX !== undefined)?.translateX;

  it('머리 내용(상단 바·하위 탭)과 본문 내용(리스트)만 들어오는 값만큼 옮기고, 머리 바탕·본문 바탕은 제자리다', async () => {
    await render(<EnteringHarness shift={new Animated.Value(12)} />);

    expect(translateXOf(headerContent())).toBe(12);
    expect(translateXOf(bodyContent())).toBe(12);
    // 상단 바·하위 탭·리스트가 내용 쪽에 있다
    expect(headerContent()).toContainElement(screen.getByText('내 작업'));
    expect(headerContent()).toContainElement(screen.getByText('하위 탭'));
    expect(bodyContent()).toContainElement(screen.getByTestId('list'));
    // 바탕: 머리(스크롤로 숨는 세로 이동만)와 본문은 가로로 옮기지 않는다
    expect(translateXOf(header())).toBeUndefined();
    const body = header().parent;
    expect(body).toHaveStyle({ backgroundColor: '#EEF0F3' });
    expect(StyleSheet.flatten(body?.props.style).transform).toBeUndefined();
  });

  it('들어오는 값이 없으면(전환 중이 아니거나 동작 줄이기) 옮기지 않는다', async () => {
    await render(<EnteringHarness shift={null} />);

    expect(translateXOf(headerContent())).toBeUndefined();
    expect(translateXOf(bodyContent())).toBeUndefined();
  });

  it('머리 내용의 빈 곳도 터치를 받지 않아 아래 리스트로 넘기고, 본문 내용은 남은 높이를 채운다', async () => {
    await render(<EnteringHarness shift={new Animated.Value(-12)} />);

    expect(headerContent()).toHaveStyle({ pointerEvents: 'box-none' });
    expect(bodyContent()).toHaveStyle({ flex: 1 });
  });

  it('들어오는 동안 화면이 다시 그려져도 애니메이션 연결을 다시 만들지 않는다', async () => {
    const shift = new Animated.Value(12);
    const view = await render(<EnteringHarness shift={shift} />);
    const connect = jest
      .spyOn(NativeModules.NativeAnimatedModule, 'connectAnimatedNodeToView')
      .mockClear();

    await view.rerender(<EnteringHarness shift={shift} title="내 일정" />);

    expect(connect).not.toHaveBeenCalled();
  });
});
