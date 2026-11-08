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

    it('스크롤 위치는 네이티브 드라이버 이벤트로 받는다', async () => {
      const event = jest.spyOn(Animated, 'event');
      await render(<Harness />);

      expect(event).toHaveBeenCalledWith(
        [{ nativeEvent: { contentOffset: { y: expect.any(Animated.Value) } } }],
        expect.objectContaining({ useNativeDriver: true }),
      );
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

    // iOS 맨 위에서 당기면(음수 위치) 상단 바가 내용과 함께 내려와 새로고침 표시를 가리지 않는다
    it('맨 위에서 아래로 당기는 만큼 상단 바도 함께 내려온다', async () => {
      const event = jest.spyOn(Animated, 'event');
      const view = await render(<Harness />);
      const scrollY = (
        event.mock.calls[0][0] as [
          { nativeEvent: { contentOffset: { y: Animated.Value } } },
        ]
      )[0].nativeEvent.contentOffset.y;

      await act(() => scrollY.setValue(-60));
      await view.rerender(<Harness />);
      expect(autoHideHeaderOffset()).toBe(60);

      await act(() => scrollY.setValue(200));
      await view.rerender(<Harness />);
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
