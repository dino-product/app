import { gestureExclusionStyle } from './gestureExclusion';

describe('gestureExclusionStyle', () => {
  it('좌우로 부모 안쪽 여백만큼 넓혀 화면 가장자리까지 덮는다', () => {
    expect(
      gestureExclusionStyle({ edgeInset: 24, top: 0, height: 60 }),
    ).toMatchObject({ position: 'absolute', left: -24, right: -24 });
  });

  it('200dp 이하면 준 위치와 높이 그대로 뺀다', () => {
    expect(
      gestureExclusionStyle({ edgeInset: 24, top: 10, height: 196 }),
    ).toMatchObject({ top: 10, height: 196 });
  });

  // 시스템이 한쪽 가장자리마다 세로 200dp 까지만 받아 준다 (View.setSystemGestureExclusionRects)
  it('200dp 를 넘으면 위쪽부터 200dp 만 뺀다', () => {
    expect(
      gestureExclusionStyle({ edgeInset: 24, top: 10, height: 300 }),
    ).toMatchObject({ top: 10, height: 200 });
  });

  it('높이를 주지 않으면 부모 아래 끝까지 빼되 200dp 를 넘지 않는다', () => {
    expect(gestureExclusionStyle({ edgeInset: 24 })).toEqual({
      position: 'absolute',
      left: -24,
      right: -24,
      top: 0,
      bottom: 0,
      maxHeight: 200,
    });
  });
});
