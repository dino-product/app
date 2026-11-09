import { enterEasing } from '../../shared/gesture/enterTransition';
import {
  TAB_ENTER_MS,
  TAB_ENTER_OFFSET,
  TAB_ENTER_TIMING,
  tabEnterStart,
} from './tabTransition';

// 탭을 옮길 때 탭 화면 안의 내용(상단 바 글자·카드·목록)이 들어오는 전환 (#140 → #176).
// 탭 순서: 홈 0 → 내 일정 1 → 작업 이력 2 → 마이 3
describe('탭 전환 — 내용이 들어오는 설정', () => {
  it('이동 거리는 #140 화면 전환 거리(24)의 절반인 12 다', () => {
    expect(TAB_ENTER_OFFSET).toBe(12);
  });

  it('오른쪽 탭으로 가면 +거리에서, 왼쪽 탭이면 -거리에서 시작한다 (몇 칸을 건너도 같은 거리)', () => {
    expect(tabEnterStart(0, 1)).toBe(TAB_ENTER_OFFSET);
    expect(tabEnterStart(0, 3)).toBe(TAB_ENTER_OFFSET);
    expect(tabEnterStart(3, 2)).toBe(-TAB_ENTER_OFFSET);
    expect(tabEnterStart(3, 0)).toBe(-TAB_ENTER_OFFSET);
  });

  it('같은 탭이면 옮기지 않는다', () => {
    expect(tabEnterStart(2, 2)).toBe(0);
  });

  // 좌우 모두 이 설정 객체 하나로 0 까지 간다. 방향은 시작 값의 부호뿐이다
  it('시작 지연 없이, 같은 시간·곡선으로 UI 스레드(네이티브 드라이버)에서 0 까지 간다', () => {
    expect(TAB_ENTER_TIMING).toEqual({
      toValue: 0,
      duration: TAB_ENTER_MS,
      easing: enterEasing,
      useNativeDriver: true,
    });
    expect(TAB_ENTER_TIMING).not.toHaveProperty('delay');
  });

  it('찰나에 방향만 느껴지는 짧은 시간이다', () => {
    expect(TAB_ENTER_MS).toBeLessThanOrEqual(200);
  });
});
