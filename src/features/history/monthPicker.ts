import { Easing } from 'react-native';
import { isBeforeMonth, monthOf, type YearMonth } from './model';

// 작업 이력 날짜 선택 상자 (#203, Figma 작업이력 (날짜 선택) 50867:4988 · (날짜 호버) 50867:4861).
// 월 글자를 누르면 글자 자리에서 흰 상자가 펼쳐지고(시안 A), 그 안의 연·월 휠을 굴려 달을 고른다.
// 휠은 iOS 기본 휠처럼 디자인돼 있지만 두 플랫폼 모두 플랫폼 피커를 쓰지 않고 같은 모양으로 직접 그린다.
// 이 파일은 값·판단만 두고, 그리기는 components/MonthPicker*.tsx · MonthWheel.tsx 가 한다.

type Keyframes<T = number> = { inputRange: number[]; outputRange: T[] };

/** 휠의 첫 해. 마지막은 올해이고 이번 달 뒤로는 고를 수 없다 */
export const PICKER_FIRST_YEAR = 2020;

/** 휠 한 줄 (Figma 열 묶음 51030:18403 의 줄 간격 31.99) */
export const WHEEL_ROW = 32;
/** 휠 높이 (Figma wheelPicker 51030:18401, 297×174) */
export const WHEEL_HEIGHT = 174;
/** 첫 줄·끝 줄도 가운데에 오도록 스크롤 내용 위아래에 두는 여백 */
export const WHEEL_PADDING = (WHEEL_HEIGHT - WHEEL_ROW) / 2;

export function pickerYears(today: Date): number[] {
  const last = today.getFullYear();
  return Array.from(
    { length: last - PICKER_FIRST_YEAR + 1 },
    (_, index) => PICKER_FIRST_YEAR + index,
  );
}

/** 고를 수 있는 범위(2020년 1월 ~ 이번 달) 안으로 맞춘다. 이미 안이면 같은 값을 돌려준다 */
export function clampPickerMonth(month: YearMonth, today: Date): YearMonth {
  const last = monthOf(today);
  if (isBeforeMonth(last, month)) {
    return last;
  }
  if (month.year < PICKER_FIRST_YEAR) {
    return { year: PICKER_FIRST_YEAR, month: 0 };
  }
  return month;
}

/** 스크롤 위치에서 가운데에 온 줄. 끝을 넘어 튕긴 위치는 끝 줄이다 */
export function wheelIndexAt(offset: number, count: number): number {
  return Math.max(0, Math.min(count - 1, Math.round(offset / WHEEL_ROW)));
}

// ---- 줄 모양 (Figma .atm_wheelPicker 51030:18404 · 51030:18405 의 가운데·±1~3 줄) ----
// 가운데에서 0~4 줄 떨어진 자리. 위아래 값이 조금 달라(예: -30.9 / +30.2) 평균을 쓴다 (시안과 같음).
// ±4 줄은 컴포넌트에만 있고 화면에서는 지웠다: 3 줄 바깥에서 사라진다
const DISTANCE = [0, 1, 2, 3, 4];
const ROW_Y = [0, 30.55, 55.3, 74.1, 83.5];
/** 가운데 글자 22.17 에 대한 배율: 18.37 · 14.57 · 11.40 · 5.07 */
export const WHEEL_FONT_SIZE = 22.17;
const ROW_SCALE = [22.17, 18.37, 14.57, 11.4, 5.07].map(
  size => size / WHEEL_FONT_SIZE,
);
/** 원통처럼 가운데 쪽으로 기우는 각도 (deg). Figma 두 열의 위아래 값을 고르게 편 것 (시안과 같음) */
const ROW_SKEW = [0, 2.7, 4.5, 7.5, 9];
/** 가운데 줄 밖의 투명도 (Figma opacity-35) */
const SIDE_OPACITY = 0.35;
/** 가운데 줄 글자 상자 (휠 안 위 74.9 · 높이 26, Figma I51030:18404;432:5713) */
export const WHEEL_ROW_TOP = 74.9;
export const WHEEL_ROW_TEXT_HEIGHT = 26;
const WHEEL_CENTER = WHEEL_ROW_TOP + WHEEL_ROW_TEXT_HEIGHT / 2;
/** 이 줄 수 밖에서는 보이지 않는다 */
const VISIBLE_DISTANCE = 3.6;
/** 연도 '년' 을 바꾸는 반 줄 경계의 폭 (줄). 시안처럼 거의 끊어 바꾼다 */
const SUFFIX_EDGE = 0.01;

const rowOpacity = (distance: number) =>
  Math.abs(distance) <= 3
    ? 1 - (1 - SIDE_OPACITY) * Math.min(1, Math.abs(distance))
    : SIDE_OPACITY *
      Math.max(0, 1 - (Math.abs(distance) - 3) / (VISIBLE_DISTANCE - 3));

/**
 * 가운데에서 떨어진 줄 수(d, 아래가 +)마다 정한 값을 줄 index 의 스크롤 위치 keyframes 로 바꾼다.
 * 스크롤 위치 y 에서 그 줄은 가운데에서 d = index - y / 32 줄 떨어져 있다 (y 가 커질수록 d 는 작아진다)
 */
function byDistance<T>(
  index: number,
  points: ReadonlyArray<readonly [number, T]>,
): Keyframes<T> {
  const sorted = [...points].sort(([a], [b]) => b - a);
  return {
    inputRange: sorted.map(([distance]) => (index - distance) * WHEEL_ROW),
    outputRange: sorted.map(([, value]) => value),
  };
}

/** 가운데 줄과 위아래 ±1~4 줄의 값 */
function symmetric<T>(
  values: readonly number[],
  map: (value: number, sign: number) => T,
): Array<readonly [number, T]> {
  return DISTANCE.flatMap(distance =>
    distance === 0
      ? [[0, map(values[0], 0)] as const]
      : [
          [distance, map(values[distance], 1)] as const,
          [-distance, map(values[distance], -1)] as const,
        ],
  );
}

/**
 * 휠 줄 index 의 모양을 스크롤 위치로 보간하는 keyframes (Animated interpolate 설정).
 * 연도 열은 오른쪽 맞춤이라 아래 줄이 + 로, 월 열은 왼쪽 맞춤이라 그 반대로 기운다
 */
export function wheelRowKeyframes(index: number, column: 'year' | 'month') {
  const skewSign = column === 'year' ? 1 : -1;
  return {
    translateY: byDistance(
      index,
      symmetric(ROW_Y, (value, sign) => value * sign),
    ),
    scale: byDistance(
      index,
      symmetric(ROW_SCALE, value => value),
    ),
    skewX: byDistance(
      index,
      symmetric(ROW_SKEW, (value, sign) => `${value * sign * skewSign}deg`),
    ),
    opacity: byDistance(index, [
      [-VISIBLE_DISTANCE, 0],
      [-3, SIDE_OPACITY],
      [-1, SIDE_OPACITY],
      [0, 1],
      [1, SIDE_OPACITY],
      [3, SIDE_OPACITY],
      [VISIBLE_DISTANCE, 0],
    ]),
  };
}

/** 휠 안 y 를 눌렀을 때 그 자리에 보이는 줄이 가운데에서 몇 줄 떨어졌는지 (위가 -). 보이는 3 줄 안에서 고른다 */
export function wheelRowAt(y: number): number {
  const offset = y - WHEEL_CENTER;
  let best = 0;
  for (const distance of [-3, -2, -1, 0, 1, 2, 3]) {
    const at = Math.sign(distance) * ROW_Y[Math.abs(distance)];
    const bestAt = Math.sign(best) * ROW_Y[Math.abs(best)];
    if (Math.abs(at - offset) < Math.abs(bestAt - offset)) {
      best = distance;
    }
  }
  return best;
}

/**
 * 연도 줄의 두 글자('2023년' 과 '2023')의 투명도. 가운데 반 줄 안에서만 '년' 이 붙는다 (Figma 가운데 줄만 '년').
 * 글자를 바꿔 그리지 않고(스크롤 중 렌더 0) 같은 자리의 두 글자를 반 줄 경계에서 바꿔 보인다
 */
export function yearRowKeyframes(index: number) {
  const edge = 0.5 + SUFFIX_EDGE;
  return {
    withSuffix: byDistance(index, [
      [-edge, 0],
      [-0.5, rowOpacity(0.5)],
      [0, 1],
      [0.5, rowOpacity(0.5)],
      [edge, 0],
    ]),
    plain: byDistance(index, [
      [-VISIBLE_DISTANCE, 0],
      [-3, SIDE_OPACITY],
      [-1, SIDE_OPACITY],
      [-edge, rowOpacity(edge)],
      [-0.5, 0],
      [0.5, 0],
      [edge, rowOpacity(edge)],
      [1, SIDE_OPACITY],
      [3, SIDE_OPACITY],
      [VISIBLE_DISTANCE, 0],
    ]),
  };
}

// ---- 상자 (Figma 50867:5275) ----
/** 상자 안쪽 여백·머리 줄과 휠 사이 */
export const BOX_PADDING = 24;
/** 화면 좌우와 상자 사이 (상자 345 = 393 - 24 × 2) */
export const BOX_INSET = 24;
export const BOX_RADIUS = 24.68;

/**
 * 상자 자리. 머리 줄은 기본 월 줄과 같은 자리(가로 가운데, 위 116 = 상태 표시줄 60 + 56)라서
 * 상자는 월 줄 위 24 에서 시작한다. 큰 글자로 월 줄이 높아지면 상자도 그만큼 길어진다
 */
export function pickerBoxGeometry(row: { y: number; height: number }) {
  const wheelTop = BOX_PADDING + row.height + BOX_PADDING;
  return {
    top: row.y - BOX_PADDING,
    height: wheelTop + WHEEL_HEIGHT + BOX_PADDING,
    wheelTop,
  };
}

// ---- 열기·닫기 (시안 A '글자 자리에서 펼쳐짐') ----
/** 열고 닫는 시간 (ms). 상단 바 접힘(#204)과 같다 */
export const PICKER_MS = 240;
/** cubic-bezier(0.2, 0, 0, 1). 닫을 때도 같은 곡선으로 진행도를 1 → 0 으로 돌린다 */
export const pickerEasing = Easing.bezier(0.2, 0, 0, 1);

/** 진행도(0 닫힘 → 1 열림)에 맞춘 값 */
export const pickerKeyframes = {
  // 휠은 흰 바탕이 거의 다 커진 뒤(70%부터) 나타난다
  contentOpacity: { inputRange: [0, 0.7, 1], outputRange: [0, 0, 1] },
  // 화살표는 앞 35% 안에 월 글자 쪽으로 8 들어가며 반으로 줄어 사라진다 (상단 바 접힘과 같은 모양)
  arrowOpacity: { inputRange: [0, 0.35, 1], outputRange: [1, 0, 0] },
  arrowScale: { inputRange: [0, 0.35, 1], outputRange: [1, 0.5, 0.5] },
  prevArrowTranslateX: { inputRange: [0, 0.35, 1], outputRange: [0, 8, 8] },
  nextArrowTranslateX: { inputRange: [0, 0.35, 1], outputRange: [0, -8, -8] },
} satisfies Record<string, Keyframes>;
