import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import {
  ENTER_MS,
  ENTER_OFFSET,
  enterEasing,
} from '../../shared/gesture/enterTransition';

type TransitionSpec = NonNullable<BottomTabNavigationOptions['transitionSpec']>;
type SceneStyleInterpolator = NonNullable<
  BottomTabNavigationOptions['sceneStyleInterpolator']
>;

// 메인 탭 전환 (#140). 탭 순서(홈 → 내 일정 → 작업 이력 → 마이)에서 오른쪽 탭으로 가면 새 화면이 오른쪽에서, 왼쪽 탭이면 왼쪽에서
// 살짝 들어온다. 탭 바를 누르든 밀든 같다. 또렷한 슬라이드가 아니라 찰나에 방향만 느껴지는 짧은 시간·작은 거리다.
//
// bottom-tabs 가 탭마다 진행값(지금 탭 0, 오른쪽 탭 1, 왼쪽 탭 -1)을 네이티브 드라이버로 옮기므로 애니메이션은 UI 스레드에서 돈다.
// 투명도는 건드리지 않는다. 새 화면(포커스한 탭)이 위에 그려지고, 덜 들어온 틈은 반대쪽으로 같은 만큼 비켜나는 앞 화면이 덮는다.
// 그래서 깜빡임·흰 화면·투명도 0 인 프레임이 없다.

/** 새 화면이 들어오기 시작하는 거리 (pt). 작업 이력 달 넘김(#153)과 같은 결이다 */
export const TAB_ENTER_OFFSET = ENTER_OFFSET;
/** 들어오는 시간 (ms) */
export const TAB_ENTER_MS = ENTER_MS;

const enterSpec: TransitionSpec = {
  animation: 'timing',
  config: { duration: TAB_ENTER_MS, easing: enterEasing },
};
// 동작 줄이기: 옮기지 않고 바로 바꾼다. 전환 설정 자체는 남겨 둔다 (bottom-tabs 는 전환 설정이 있고 없음에 따라
// 탭 화면 컨테이너 종류를 바꾸므로, 설정을 켜고 끌 때마다 탭 화면이 모두 다시 마운트된다)
const instantSpec: TransitionSpec = {
  animation: 'timing',
  config: { duration: 0 },
};

export const forTabEnter: SceneStyleInterpolator = ({ current }) => ({
  sceneStyle: {
    transform: [
      {
        translateX: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-TAB_ENTER_OFFSET, 0, TAB_ENTER_OFFSET],
        }),
      },
    ],
  },
});

export function tabTransitionOptions(
  reduceMotion: boolean,
): Pick<
  BottomTabNavigationOptions,
  'transitionSpec' | 'sceneStyleInterpolator'
> {
  return reduceMotion
    ? { transitionSpec: instantSpec, sceneStyleInterpolator: undefined }
    : { transitionSpec: enterSpec, sceneStyleInterpolator: forTabEnter };
}
