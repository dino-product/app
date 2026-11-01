import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type LayoutChangeEvent } from 'react-native';

const overlapOf = (frameBottom: number | null, keyboardTop: number | null) =>
  frameBottom === null || keyboardTop === null
    ? 0
    : Math.max(0, frameBottom - keyboardTop);

/**
 * Android 에서 키보드가 이 View 의 아래쪽을 가린 높이. iOS 는 늘 0 이다
 * (ScrollView 의 automaticallyAdjustKeyboardInsets 가 맡는다).
 *
 * edge-to-edge(gradle.properties 의 edgeToEdgeEnabled)라 매니페스트가 adjustResize 여도 창이 줄지 않고,
 * RN 도 루트 뷰에 키보드 인셋을 반영하지 않는다. 이 값을 View 의 paddingBottom 으로 주면
 * adjustResize 처럼 안의 ScrollView 가 키보드 윗변에서 끝난다. 그러면 Android ScrollView 가
 * 크기가 줄 때와 포커스가 옮겨 갈 때 포커스된 입력칸을 보이게 스크롤한다.
 *
 * 겹침은 KeyboardAvoidingView 처럼 키보드 윗변(endCoordinates.screenY)으로 잰다. 이벤트의 height 는
 * ime.bottom − systemBars.bottom 이라 내비게이션 바만큼 작다. View 위치는 onLayout 값(부모 기준)을
 * 화면 좌표로 보므로 부모는 화면 맨 위에서 시작하는 화면 루트(SafeAreaView)여야 한다.
 * paddingBottom 은 View 자신의 크기를 바꾸지 않아 다시 재도 값이 흔들리지 않는다.
 * KeyboardAvoidingView 는 Android 에서 마운트 직후 같은 값으로 다시 렌더해 리렌더 예산에 걸려 쓰지 않는다.
 */
export function useKeyboardOverlap() {
  const frameBottom = useRef<number | null>(null);
  const keyboardTop = useRef<number | null>(null);
  // 값이 같으면 React 가 렌더를 건너뛰므로 레이아웃·키보드 이벤트마다 렌더되지 않는다
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    const subscriptions = [
      // 키보드 높이가 바뀌어도(숫자 패드, 이모지 패널) 다시 온다
      Keyboard.addListener('keyboardDidShow', event => {
        keyboardTop.current = event.endCoordinates.screenY;
        setOverlap(overlapOf(frameBottom.current, keyboardTop.current));
      }),
      Keyboard.addListener('keyboardDidHide', () => {
        keyboardTop.current = null;
        setOverlap(0);
      }),
    ];
    return () => subscriptions.forEach(subscription => subscription.remove());
  }, []);

  const onLayout = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    // 아래 끝이 그대로면 가린 높이도 그대로다. 같은 값이어도 직전에 값이 바뀌었으면 React 가 한 번 더 렌더한다
    if (y + height === frameBottom.current) {
      return;
    }
    frameBottom.current = y + height;
    setOverlap(overlapOf(frameBottom.current, keyboardTop.current));
  };

  return { overlap, onLayout };
}
