import {
  COMPONENT_SLACK,
  EDGE_BAND,
  QUICK_SWITCH_DISTANCE,
  TAB_TRACK_DISTANCE,
  SWITCH_DISTANCE,
  decideTabSwipe,
  decideTabTrack,
  hesitantSwitchDistance,
  neighborIndex,
  startOwner,
  switchOnRelease,
  swipeDirection,
} from './tabSwipe';
import { AXIS_DECISION_DISTANCE } from './panAxis';

const WINDOW_WIDTH = 390;
// 화면 가운데 놓인 카드 (좌우 여백 80, 가장자리 띠 밖)
const CARD = { x: 80, y: 200, width: 230, height: 120 };
const cardCenter = { x: 195, y: 260 };

describe('startOwner — 밀기 시작점의 주인', () => {
  it('엄지 띠 폭은 엄지 접촉면 폭(9.2mm)을 160pt/inch 로 바꾼 값이다', () => {
    expect(EDGE_BAND).toBe(58);
  });

  it('컴포넌트 안쪽 깊은 곳에서 시작하면 컴포넌트가 갖는다', () => {
    expect(startOwner(cardCenter, CARD, WINDOW_WIDTH)).toBe('component');
  });

  it('컴포넌트 가장자리 안쪽 여유 영역에서 시작하면 탭 전환이 갖는다 (네 변 모두)', () => {
    const inside = COMPONENT_SLACK - 1;
    expect(startOwner({ x: CARD.x + inside, y: 260 }, CARD, WINDOW_WIDTH)).toBe(
      'tab',
    );
    expect(
      startOwner(
        { x: CARD.x + CARD.width - inside, y: 260 },
        CARD,
        WINDOW_WIDTH,
      ),
    ).toBe('tab');
    expect(startOwner({ x: 195, y: CARD.y + inside }, CARD, WINDOW_WIDTH)).toBe(
      'tab',
    );
    expect(
      startOwner(
        { x: 195, y: CARD.y + CARD.height - inside },
        CARD,
        WINDOW_WIDTH,
      ),
    ).toBe('tab');
  });

  it('여유 영역 경계(가장자리에서 정확히 여유만큼 안쪽)부터는 컴포넌트다', () => {
    expect(
      startOwner(
        { x: CARD.x + COMPONENT_SLACK, y: CARD.y + COMPONENT_SLACK },
        CARD,
        WINDOW_WIDTH,
      ),
    ).toBe('component');
  });

  it('컴포넌트 밖(배경)에서 시작하면 탭 전환이 갖는다', () => {
    expect(startOwner({ x: 195, y: 150 }, CARD, WINDOW_WIDTH)).toBe('tab');
  });

  it('화면을 꽉 채운 컴포넌트도 화면 좌우 가장자리 띠에서 시작하면 탭 전환이 갖는다', () => {
    const fullWidth = { x: 0, y: 200, width: WINDOW_WIDTH, height: 400 };

    expect(startOwner({ x: 0, y: 400 }, fullWidth, WINDOW_WIDTH)).toBe('tab');
    expect(
      startOwner({ x: EDGE_BAND - 1, y: 400 }, fullWidth, WINDOW_WIDTH),
    ).toBe('tab');
    expect(
      startOwner(
        { x: WINDOW_WIDTH - EDGE_BAND + 1, y: 400 },
        fullWidth,
        WINDOW_WIDTH,
      ),
    ).toBe('tab');
  });

  it('가장자리 띠 바로 안쪽부터는 꽉 찬 컴포넌트가 갖는다', () => {
    const fullWidth = { x: 0, y: 200, width: WINDOW_WIDTH, height: 400 };

    expect(startOwner({ x: EDGE_BAND, y: 400 }, fullWidth, WINDOW_WIDTH)).toBe(
      'component',
    );
    expect(
      startOwner(
        { x: WINDOW_WIDTH - EDGE_BAND, y: 400 },
        fullWidth,
        WINDOW_WIDTH,
      ),
    ).toBe('component');
  });

  it('위아래로 다른 행과 붙은 행(stacked)은 위·아래 변에 여유를 두지 않는다', () => {
    const row = { x: 0, y: 200, width: WINDOW_WIDTH, height: 110 };

    expect(
      startOwner({ x: 195, y: 201 }, row, WINDOW_WIDTH, { stacked: true }),
    ).toBe('component');
    expect(
      startOwner({ x: 195, y: 309 }, row, WINDOW_WIDTH, { stacked: true }),
    ).toBe('component');
    // 좌우는 가장자리 띠가 그대로 탭 전환이다
    expect(
      startOwner({ x: 10, y: 250 }, row, WINDOW_WIDTH, { stacked: true }),
    ).toBe('tab');
  });

  it('영역 크기를 모르면(측정 불가) 띠 밖은 컴포넌트가 갖는다 (기존 동작 유지)', () => {
    expect(startOwner(cardCenter, null, WINDOW_WIDTH)).toBe('component');
    expect(startOwner({ x: 5, y: 260 }, null, WINDOW_WIDTH)).toBe('tab');
  });
});

describe('decideTabSwipe — 손바닥 오작동 방지', () => {
  it('방향을 정할 만큼 움직이기 전에는 기다린다', () => {
    expect(decideTabSwipe({ dx: 0, dy: 0, touches: 1 })).toBe('wait');
    expect(
      // 방향은 공용 규칙(decidePanAxis)대로 10pt 를 넘어야 정한다
      decideTabSwipe({ dx: -AXIS_DECISION_DISTANCE, dy: 0, touches: 1 }),
    ).toBe('wait');
  });

  it('가로로 정해졌지만 임계값에 못 미치면 따라가기만 한다 (아직 바꾸지 않는다)', () => {
    expect(
      decideTabSwipe({ dx: -(AXIS_DECISION_DISTANCE + 1), dy: 0, touches: 1 }),
    ).toBe('track');
    expect(
      decideTabSwipe({ dx: -(SWITCH_DISTANCE - 1), dy: 0, touches: 1 }),
    ).toBe('track');
  });

  it('가로 이동이 임계값을 넘고 가로가 확실히 크면 전환한다 (양방향)', () => {
    expect(decideTabSwipe({ dx: -SWITCH_DISTANCE, dy: 0, touches: 1 })).toBe(
      'switch',
    );
    expect(decideTabSwipe({ dx: SWITCH_DISTANCE, dy: 10, touches: 1 })).toBe(
      'switch',
    );
  });

  it('수평에서 30° 안쪽이어야 가로가 확실히 큰 것으로 본다', () => {
    // 29° 와 31°
    const at = (deg: number) => ({
      dx: 100,
      dy: Math.round(100 * Math.tan((deg * Math.PI) / 180)),
      touches: 1,
    });
    expect(decideTabSwipe(at(29))).toBe('switch');
    expect(decideTabSwipe(at(31))).toBe('ignore');
  });

  it('세로로 먼저 움직이면 이번 제스처는 탭 전환이 아니다', () => {
    expect(
      decideTabSwipe({ dx: 0, dy: AXIS_DECISION_DISTANCE + 1, touches: 1 }),
    ).toBe('ignore');
    expect(
      decideTabSwipe({ dx: 4, dy: -(AXIS_DECISION_DISTANCE + 1), touches: 1 }),
    ).toBe('ignore');
  });

  it('방향을 정하기 전의 작은 흔들림은 기다린다', () => {
    expect(
      decideTabSwipe({ dx: 2, dy: AXIS_DECISION_DISTANCE, touches: 1 }),
    ).toBe('wait');
  });

  it('두 손가락 이상이면 무시한다', () => {
    expect(decideTabSwipe({ dx: -200, dy: 0, touches: 2 })).toBe('ignore');
  });
});

describe('decideTabSwipe — 방향 판정은 공용 규칙(decidePanAxis)을 수평 30° 로 좁혀 쓴다', () => {
  it.each([
    // [dx, dy, 판정]  각도는 수평에서 잰 값
    [11, 0, 'track'], // 0°, 10pt 를 넘어 가로로 정함
    [20, 11, 'track'], // 28.8°
    [20, 12, 'ignore'], // 31.0°
    [5, 11, 'ignore'], // 65.6°, 세로
    [-70, 39, 'switch'], // 29.1°, 임계값 넘음
    [-70, 41, 'ignore'], // 30.4°
  ] as const)('(%i, %i) → %s', (dx, dy, expected) => {
    expect(decideTabSwipe({ dx, dy, touches: 1 })).toBe(expected);
  });
});

describe('밀기 방향과 이웃 탭', () => {
  it('왼쪽으로 밀면 오른쪽 탭(next), 오른쪽으로 밀면 왼쪽 탭(prev)', () => {
    expect(swipeDirection(-60)).toBe('next');
    expect(swipeDirection(60)).toBe('prev');
  });

  it('양 끝 탭에서 바깥쪽으로는 옮길 탭이 없다', () => {
    expect(neighborIndex(0, 4, 'prev')).toBeNull();
    expect(neighborIndex(3, 4, 'next')).toBeNull();
  });

  it('가운데 탭은 양옆으로 옮긴다', () => {
    expect(neighborIndex(0, 4, 'next')).toBe(1);
    expect(neighborIndex(2, 4, 'prev')).toBe(1);
    expect(neighborIndex(2, 4, 'next')).toBe(3);
  });
});

describe('놓을 때 탭을 바꾸는 거리 — 이어 밀면 방향만, 망설이면 화면 절반 (#216)', () => {
  it('이어 밀면 방향을 정하는 거리(8pt)만 넘으면 된다 (거의 터치 수준)', () => {
    expect(QUICK_SWITCH_DISTANCE).toBe(TAB_TRACK_DISTANCE);
    expect(TAB_TRACK_DISTANCE).toBe(8);
    expect(
      switchOnRelease({ distance: 8, hesitant: false, windowWidth: 393 }),
    ).toBe(true);
    expect(
      switchOnRelease({ distance: 7, hesitant: false, windowWidth: 393 }),
    ).toBe(false);
  });

  it('망설인 뒤에는 화면 폭의 절반(내림)을 넘겨야 한다. 폭마다 다시 잰다', () => {
    expect(hesitantSwitchDistance(393)).toBe(196);
    expect(hesitantSwitchDistance(375)).toBe(187);
    expect(hesitantSwitchDistance(430)).toBe(215);
    expect(
      switchOnRelease({ distance: 195, hesitant: true, windowWidth: 393 }),
    ).toBe(false);
    expect(
      switchOnRelease({ distance: 196, hesitant: true, windowWidth: 393 }),
    ).toBe(true);
  });
});

describe('decideTabTrack — 덮기 밀기는 놓을 때까지 따라가기만 한다 (#216)', () => {
  it('8pt 를 넘게 가로로 움직이면 따라가고, 아무리 멀리 가도 미는 중에는 바꾸지 않는다', () => {
    // 손바닥·손가락이 스치는 8pt 이하의 움직임은 방향도 정하지 않는다 (어디서 시작했든)
    expect(decideTabTrack({ dx: -8, dy: 0, touches: 1 })).toBe('wait');
    expect(decideTabTrack({ dx: -9, dy: 0, touches: 1 })).toBe('track');
    // 달력·달 넘김(decideTabSwipe)은 그대로 10pt 다
    expect(decideTabSwipe({ dx: -10, dy: 0, touches: 1 })).toBe('wait');
    expect(decideTabTrack({ dx: -900, dy: 0, touches: 1 })).toBe('track');
  });

  it('수평 30° 밖이거나 두 손가락이면 탭 밀기가 아니다', () => {
    expect(decideTabTrack({ dx: 20, dy: 12, touches: 1 })).toBe('ignore');
    expect(decideTabTrack({ dx: -40, dy: 0, touches: 2 })).toBe('ignore');
  });
});
