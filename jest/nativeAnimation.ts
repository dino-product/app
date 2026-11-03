import { act } from '@testing-library/react-native';
import { NativeModules } from 'react-native';

type EndCallback = (result: { finished: boolean; value?: number }) => void;

/**
 * 네이티브 드라이버 애니메이션이 테스트가 끝낼 때까지 돌게 한다.
 * jest 프리셋의 목은 16ms 뒤에 저절로 끝나므로, 끝나기 전과 뒤를 나눠 보려면 이것으로 바꾼다.
 * 되돌리는 것은 jest.restoreAllMocks 다.
 */
export function holdNativeAnimations() {
  const running: Array<() => void> = [];
  jest
    .spyOn(NativeModules.NativeAnimatedModule, 'startAnimatingNode')
    .mockImplementation((...args: unknown[]) => {
      const config = args[2] as { toValue?: number };
      const end = args[3] as EndCallback;
      // 실기기처럼 끝난 값을 함께 돌려줘 JS 쪽 값을 맞추고 Animated 컴포넌트를 다시 그리게 한다
      running.push(() => end({ finished: true, value: config.toValue }));
    });
  return {
    /** 지금까지 시작한 애니메이션을 모두 끝낸다. 도중에 멈춘 것은 멈출 때 끝났다고 알렸으므로 다시 알리지 않는다 */
    finish: () =>
      act(() => {
        running.splice(0).forEach(end => end());
      }),
  };
}
