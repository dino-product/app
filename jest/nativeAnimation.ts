import { act } from '@testing-library/react-native';
import { NativeModules } from 'react-native';

type EndCallback = (result: { finished: boolean }) => void;

/**
 * 네이티브 드라이버 애니메이션이 테스트가 끝낼 때까지 돌게 한다.
 * jest 프리셋의 목은 16ms 뒤에 저절로 끝나므로, 끝나기 전과 뒤를 나눠 보려면 이것으로 바꾼다.
 * 되돌리는 것은 jest.restoreAllMocks 다.
 */
export function holdNativeAnimations() {
  const running: EndCallback[] = [];
  jest
    .spyOn(NativeModules.NativeAnimatedModule, 'startAnimatingNode')
    .mockImplementation((...args: unknown[]) => {
      running.push(args[3] as EndCallback);
    });
  return {
    /** 지금까지 시작한 애니메이션을 모두 끝낸다. 도중에 멈춘 것은 이미 끝났다고 알렸으므로 다시 부르지 않는다 */
    finish: () =>
      act(() => {
        running.splice(0).forEach(end => end({ finished: true }));
      }),
  };
}
