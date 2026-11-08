import {
  COMPONENT_SLACK,
  DIRECTION_LOCK,
  EDGE_BAND,
  SWITCH_DISTANCE,
  decideTabSwipe,
  neighborIndex,
  startOwner,
  swipeDirection,
} from './tabSwipe';

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
      decideTabSwipe({ dx: -(DIRECTION_LOCK - 1), dy: 0, touches: 1 }),
    ).toBe('wait');
  });

  it('가로로 정해졌지만 임계값에 못 미치면 따라가기만 한다 (아직 바꾸지 않는다)', () => {
    expect(decideTabSwipe({ dx: -DIRECTION_LOCK, dy: 0, touches: 1 })).toBe(
      'track',
    );
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
    expect(decideTabSwipe({ dx: 0, dy: DIRECTION_LOCK, touches: 1 })).toBe(
      'ignore',
    );
    expect(decideTabSwipe({ dx: 4, dy: -DIRECTION_LOCK, touches: 1 })).toBe(
      'ignore',
    );
  });

  it('방향을 정하기 전의 작은 흔들림은 기다린다', () => {
    expect(decideTabSwipe({ dx: 2, dy: DIRECTION_LOCK - 1, touches: 1 })).toBe(
      'wait',
    );
  });

  it('두 손가락 이상이면 무시한다', () => {
    expect(decideTabSwipe({ dx: -200, dy: 0, touches: 2 })).toBe('ignore');
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
