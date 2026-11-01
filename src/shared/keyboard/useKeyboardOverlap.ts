import { NavigationContext } from '@react-navigation/native';
import { useContext, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  type EmitterSubscription,
  type LayoutChangeEvent,
} from 'react-native';

type Frame = { y: number; height: number };

// 영역 높이보다 크게 줄이면 Yoga 가 View 를 padding 만큼 늘려 onLayout 이 다시 오고, 그만큼 또 늘어난다
const overlapOf = (frame: Frame | null, keyboardTop: number | null) =>
  frame === null || keyboardTop === null
    ? 0
    : Math.min(frame.height, Math.max(0, frame.y + frame.height - keyboardTop));

/**
 * Android 에서 키보드가 이 View 의 아래쪽을 가린 높이. iOS 는 늘 0 이고 레이아웃도 받지 않는다
 * (ScrollView 의 automaticallyAdjustKeyboardInsets 가 맡는다). 화면에서는 KeyboardAvoidingArea 로 쓴다.
 *
 * edge-to-edge(gradle.properties 의 edgeToEdgeEnabled)라 매니페스트가 adjustResize 여도 창이 줄지 않고,
 * RN 도 루트 뷰에 키보드 인셋을 반영하지 않는다. 이 값을 View 의 paddingBottom 으로 주면
 * adjustResize 처럼 안의 ScrollView 가 키보드 윗변에서 끝난다. 그러면 Android ScrollView 가
 * 크기가 줄 때와 포커스가 옮겨 갈 때 포커스된 입력칸을 보이게 스크롤한다.
 *
 * 겹침은 KeyboardAvoidingView 처럼 키보드 윗변(endCoordinates.screenY, 디스플레이 좌표)으로 잰다.
 * 이벤트의 height 는 ime.bottom − systemBars.bottom 이라 내비게이션 바만큼 작다.
 * View 위치는 onLayout 값(부모 기준)을 디스플레이 좌표로 본다. 그래서 두 가지를 전제한다.
 * - 조상이 모두 화면 맨 위(y=0)에서 시작한다. 헤더 없는 스택 화면의 SafeAreaView 바로 아래에 둔다.
 * - 창이 디스플레이 맨 위에서 시작한다. 분할 화면 아래쪽 창·자유형 창에서는 겹침이 틀어진다.
 * paddingBottom 이 영역 높이 이하면 View 자신의 frame 은 그대로라 다시 재도 값이 흔들리지 않는다.
 *
 * 내비게이터 안에서는 화면이 보이는 동안만 키보드를 듣는다. 다른 탭·위 화면에서 키보드를 써도
 * 가려진 화면은 렌더·레이아웃하지 않는다. 내비게이터 밖(테스트 등)에서는 늘 듣는다.
 * KeyboardAvoidingView 는 Android 에서 마운트 직후 같은 값으로 다시 렌더해 리렌더 예산에 걸려 쓰지 않는다.
 */
export function useKeyboardOverlap() {
  const navigation = useContext(NavigationContext);
  const frame = useRef<Frame | null>(null);
  const keyboardTop = useRef<number | null>(null);
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    // 같은 값으로 setState 해도 직전에 값이 바뀌었으면 React 가 한 번 더 렌더하므로 먼저 거른다.
    // 내비게이션 바만 바뀌면 RN 이 같은 윗변으로 keyboardDidShow 를 다시 보낸다
    const setKeyboardTop = (top: number | null) => {
      if (top === keyboardTop.current) {
        return;
      }
      keyboardTop.current = top;
      setOverlap(overlapOf(frame.current, top));
    };

    let subscriptions: EmitterSubscription[] = [];
    const listen = () => {
      if (subscriptions.length > 0) {
        return;
      }
      // 키보드를 연 채로 화면이 열리거나 돌아올 수 있다
      setKeyboardTop(
        Keyboard.isVisible() ? Keyboard.metrics()?.screenY ?? null : null,
      );
      subscriptions = [
        // 키보드 높이가 바뀌어도(숫자 패드, 이모지 패널) 다시 온다
        Keyboard.addListener('keyboardDidShow', event =>
          setKeyboardTop(event.endCoordinates.screenY),
        ),
        Keyboard.addListener('keyboardDidHide', () => setKeyboardTop(null)),
      ];
    };
    const unlisten = () => {
      subscriptions.forEach(subscription => subscription.remove());
      subscriptions = [];
    };

    if (navigation?.isFocused() ?? true) {
      listen();
    }
    const unsubscribeFocus = navigation?.addListener('focus', listen);
    const unsubscribeBlur = navigation?.addListener('blur', () => {
      unlisten();
      setKeyboardTop(null);
    });
    return () => {
      unsubscribeFocus?.();
      unsubscribeBlur?.();
      unlisten();
    };
  }, [navigation]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    if (y === frame.current?.y && height === frame.current.height) {
      return;
    }
    frame.current = { y, height };
    setOverlap(overlapOf(frame.current, keyboardTop.current));
  };

  return {
    overlap,
    onLayout: Platform.OS === 'android' ? onLayout : undefined,
  };
}
