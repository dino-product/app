import { ENTER_MS, enterEasing } from '../../shared/gesture/enterTransition';

// 메인 탭 전환 (#140 → #176). 탭 화면(배경)은 바로 바뀌고, 그 안의 내용(상단 바 글자·하위 탭·카드·목록·빈 상태)만
// 오른쪽 탭으로 가면 오른쪽에서, 왼쪽 탭이면 왼쪽에서 살짝 들어와 화면이 들어오는 것처럼 보인다. 탭 바를 누르든 밀든 같다.
// 또렷한 슬라이드가 아니라 찰나에 방향만 느껴지는 짧은 시간·작은 거리이고, 투명도는 건드리지 않는다.
//
// 좌우의 차이는 시작 값의 부호뿐이다. 시작 지연·시간·곡선은 TAB_ENTER_TIMING 하나를 같이 쓴다.
// 들어오는 값은 탭이 바뀌는 렌더에서 만들고 그 커밋 직후(layout effect)에 시작한다 (TabEnterLayout.tsx). 움직이는 쪽은
// 탭 첫 화면의 머리 내용·본문 내용이다 (AutoHideHeaderLayout). 애니메이션은 네이티브 드라이버로 UI 스레드에서 돈다

/** 내용이 들어오기 시작하는 거리 (pt). #140 의 화면 전환 거리(24)의 절반 */
export const TAB_ENTER_OFFSET = 12;
/** 들어오는 시간 (ms). 작업 이력 달 넘김(#153)과 같은 결이다 */
export const TAB_ENTER_MS = ENTER_MS;

/** 좌우 모두 이 설정 하나로 시작 값에서 0 까지 간다 (시작 지연 없음) */
export const TAB_ENTER_TIMING = {
  toValue: 0,
  duration: TAB_ENTER_MS,
  easing: enterEasing,
  useNativeDriver: true,
} as const;

/** from 탭에서 to 탭으로 옮길 때 내용이 들어오기 시작하는 가로 위치. 오른쪽 탭이면 +, 왼쪽 탭이면 -, 같은 탭이면 0 */
export function tabEnterStart(from: number, to: number): number {
  return Math.sign(to - from) * TAB_ENTER_OFFSET;
}
