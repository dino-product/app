import {
  clampPickerMonth,
  PICKER_FIRST_YEAR,
  pickerBoxGeometry,
  pickerYears,
  WHEEL_PADDING,
  WHEEL_ROW,
  wheelIndexAt,
  wheelRowAt,
  wheelRowKeyframes,
  yearRowKeyframes,
} from './monthPicker';

const today = new Date(2026, 10, 22); // 2026년 11월

/** 스크롤 위치 y 에서 keyframes 의 값 (Animated 의 interpolate 와 같은 선형 보간, 끝은 고정) */
function valueAt(
  { inputRange, outputRange }: { inputRange: number[]; outputRange: unknown[] },
  y: number,
) {
  const outputs = outputRange.map(value =>
    typeof value === 'string' ? parseFloat(value) : (value as number),
  );
  if (y <= inputRange[0]) {
    return outputs[0];
  }
  for (let i = 1; i < inputRange.length; i++) {
    if (y <= inputRange[i]) {
      const t = (y - inputRange[i - 1]) / (inputRange[i] - inputRange[i - 1]);
      return outputs[i - 1] + (outputs[i] - outputs[i - 1]) * t;
    }
  }
  return outputs[outputs.length - 1];
}

describe('날짜 선택 휠 범위 (#203)', () => {
  it('연도는 2020 부터 올해까지다', () => {
    expect(PICKER_FIRST_YEAR).toBe(2020);
    expect(pickerYears(today)).toEqual([
      2020, 2021, 2022, 2023, 2024, 2025, 2026,
    ]);
  });

  // YearMonth 의 month 는 Date 처럼 0(1월)부터다
  it('이번 달 뒤의 달은 이번 달로, 2020년 1월 앞의 달은 2020년 1월로 맞춘다', () => {
    expect(clampPickerMonth({ year: 2026, month: 11 }, today)).toEqual({
      year: 2026,
      month: 10,
    });
    expect(clampPickerMonth({ year: 2019, month: 4 }, today)).toEqual({
      year: 2020,
      month: 0,
    });
    const inside = { year: 2024, month: 3 };
    expect(clampPickerMonth(inside, today)).toBe(inside);
  });

  it('한 줄은 32 이고, 휠(174) 가운데 줄 위아래로 71 씩 여백을 둔다', () => {
    expect(WHEEL_ROW).toBe(32);
    expect(WHEEL_PADDING).toBe(71);
  });

  it('스크롤 위치는 가장 가까운 줄로 읽고, 끝을 넘어 튕긴 위치는 끝 줄이다', () => {
    expect(wheelIndexAt(0, 7)).toBe(0);
    expect(wheelIndexAt(47, 7)).toBe(1);
    expect(wheelIndexAt(49, 7)).toBe(2);
    expect(wheelIndexAt(-40, 7)).toBe(0);
    expect(wheelIndexAt(32 * 9, 7)).toBe(6);
  });
});

// Figma 작업이력 (날짜 선택) 50867:4988 › wheelPicker 51030:18401 › .atm_wheelPicker 51030:18404 · 51030:18405
describe('휠 줄 모양 — Figma 값 (#203)', () => {
  // 3번째 줄(index 2)을 본다. 가운데에 오는 스크롤 위치는 64 다
  const index = 2;
  const at = (distance: number) => (index - distance) * WHEEL_ROW;

  it('가운데 줄은 제자리·배율 1·불투명이고 기울지 않는다', () => {
    const frames = wheelRowKeyframes(index, 'month');
    expect(valueAt(frames.translateY, at(0))).toBe(0);
    expect(valueAt(frames.scale, at(0))).toBe(1);
    expect(valueAt(frames.opacity, at(0))).toBe(1);
    expect(valueAt(frames.skewX, at(0))).toBe(0);
  });

  it.each([
    // 가운데에서 몇 줄, Figma 위(-)·아래(+) 줄 자리(두 열 같음), 글자 배율(22.17 → 18.37 · 14.57 · 11.40)
    [1, 30.92, 30.2, 18.37 / 22.17],
    [2, 55.26, 55.35, 14.57 / 22.17],
    [3, 75.32, 72.98, 11.4 / 22.17],
  ])(
    '가운데에서 %i 줄 떨어지면 위로 %f · 아래로 %f 떨어지고 배율 %f, 투명도 0.35 다',
    (distance, up, down, scale) => {
      for (const column of ['year', 'month'] as const) {
        const frames = wheelRowKeyframes(index, column);
        expect(valueAt(frames.translateY, at(distance))).toBeCloseTo(down, 5);
        expect(valueAt(frames.translateY, at(-distance))).toBeCloseTo(-up, 5);
        expect(valueAt(frames.scale, at(distance))).toBeCloseTo(scale, 3);
        expect(valueAt(frames.scale, at(-distance))).toBeCloseTo(scale, 3);
        expect(valueAt(frames.opacity, at(distance))).toBeCloseTo(0.35, 5);
        expect(valueAt(frames.opacity, at(-distance))).toBeCloseTo(0.35, 5);
      }
    },
  );

  it('셋째 줄 바깥(3.6 줄)에서는 보이지 않는다 (Figma 에서 ±4 줄은 지움)', () => {
    const frames = wheelRowKeyframes(index, 'year');
    expect(valueAt(frames.opacity, at(3.6))).toBe(0);
    expect(valueAt(frames.opacity, at(-3.6))).toBe(0);
  });

  // Figma 줄마다 기울기가 다르다 (위아래가 고르지 않고, 연도 바로 위 줄은 기울지 않는다). 줄별 값을 그대로 쓴다
  it.each([
    ['year', [-7.58, -3.32, 0, 0, 3.32, 3.79, 7.11]],
    ['month', [7.58, 6.63, 2.37, 0, -2.37, -4.26, -7.58]],
  ] as const)(
    '%s 열은 가운데에서 -3 ~ +3 줄마다 Figma 기울기(deg)로 기운다',
    (column, skews) => {
      const frames = wheelRowKeyframes(index, column);
      skews.forEach((skew, row) => {
        expect(valueAt(frames.skewX, at(row - 3))).toBeCloseTo(skew, 5);
      });
      expect(frames.skewX.outputRange.every(value => /deg$/.test(value))).toBe(
        true,
      );
    },
  );

  // Figma 가운데 줄은 '2023년', 위아래 줄은 '2022'·'2024' 로 '년' 이 없다
  it("연도는 가운데 줄(반 줄 안)에서만 '년' 을 붙인다", () => {
    const { withSuffix, plain } = yearRowKeyframes(index);
    expect(valueAt(withSuffix, at(0))).toBe(1);
    expect(valueAt(plain, at(0))).toBe(0);
    expect(valueAt(withSuffix, at(0.49))).toBeGreaterThan(0.6);
    expect(valueAt(plain, at(0.49))).toBe(0);
    expect(valueAt(withSuffix, at(0.52))).toBe(0);
    expect(valueAt(plain, at(-0.52))).toBeGreaterThan(0.6);
    expect(valueAt(plain, at(2))).toBeCloseTo(0.35, 5);
    expect(valueAt(withSuffix, at(2))).toBe(0);
  });
});

describe('휠 줄 누르기 (#203)', () => {
  // 가운데 줄 글자 상자는 휠 위 74.9 · 높이 26 (가운데 87.9). 위 줄은 30.92 · 55.26 · 75.32, 아래 줄은 30.2 · 55.35 · 72.98 떨어져 있다
  it.each([
    [87.9, 0],
    [87.9 + 30, 1],
    [87.9 - 50, -2],
    [26, -2],
    [170, 3],
    [0, -3],
  ])('휠 안 %f 을 누르면 가운데에서 %i 줄', (y, rows) => {
    expect(wheelRowAt(y)).toBe(rows);
  });
});

// Figma 50867:5275 상자 · 50867:5276 머리 줄 · 51030:18401 휠
describe('날짜 선택 상자 자리 (#203)', () => {
  it('상자는 월 줄 위 24 에서 시작해 머리 줄(높이 28)·사이 24·휠 174·아래 24 로 274 다', () => {
    expect(pickerBoxGeometry({ y: 56, height: 28 })).toEqual({
      top: 32,
      height: 274,
      wheelTop: 76,
    });
  });

  it('큰 글자로 월 줄이 높아지면 상자도 그만큼 길어지고 휠이 내려간다', () => {
    expect(pickerBoxGeometry({ y: 60, height: 36 })).toEqual({
      top: 36,
      height: 282,
      wheelTop: 84,
    });
  });
});
