import {
  AXIS_DECISION_DISTANCE,
  decidePanAxis,
  HORIZONTAL_MAX_ANGLE,
} from './panAxis';

describe('decidePanAxis', () => {
  it('임계값은 10pt·45도다', () => {
    expect(AXIS_DECISION_DISTANCE).toBe(10);
    expect(HORIZONTAL_MAX_ANGLE).toBe(45);
  });

  it('움직이지 않았으면 정하지 않는다', () => {
    expect(decidePanAxis(0, 0)).toBeNull();
  });

  // 거리는 가로·세로 중 큰 쪽으로 잰다. 기준 이하의 흔들림은 탭으로 남는다
  it.each([
    [10, 0],
    [-10, 0],
    [0, 10],
    [0, -10],
    [10, 10],
    [-10, 9],
  ])('가로·세로 모두 10pt 이하(%p, %p)면 아직 정하지 않는다', (dx, dy) => {
    expect(decidePanAxis(dx, dy)).toBeNull();
  });

  it.each([
    [10.5, 0, 'horizontal'],
    [-10.5, 0, 'horizontal'],
    [0, 10.5, 'vertical'],
    [0, -10.5, 'vertical'],
  ] as const)(
    '한쪽으로 10pt 를 넘으면(%p, %p) %s 로 정한다',
    (dx, dy, axis) => {
      expect(decidePanAxis(dx, dy)).toBe(axis);
    },
  );

  // 가로축에서 45도 안쪽이면 가로, 45도부터는 세로. 딱 45도(가로·세로가 같다)는 리스트 스크롤 쪽인 세로다
  it.each([
    [20, 19.9, 'horizontal'],
    [-20, -19.9, 'horizontal'],
    [20, 20, 'vertical'],
    [-20, 20, 'vertical'],
    [19.9, 20, 'vertical'],
  ] as const)('45도 경계: (%p, %p) 는 %s', (dx, dy, axis) => {
    expect(decidePanAxis(dx, dy)).toBe(axis);
  });

  it('임계값을 바꿔 쓸 수 있다', () => {
    const strict = { distance: 20, horizontalMaxAngle: 30 };

    expect(decidePanAxis(20, 0, strict)).toBeNull();
    expect(decidePanAxis(21, 0, strict)).toBe('horizontal');
    // tan 30° ≈ 0.577
    expect(decidePanAxis(30, 17, strict)).toBe('horizontal');
    expect(decidePanAxis(30, 18, strict)).toBe('vertical');
  });
});
