import {
  AUTO_HIDE_INITIAL,
  DIRECTION_SLOP,
  nextAutoHideState,
  type AutoHideState,
} from './autoHideHeader';

// 상단 바 높이 46, 화면(스크롤 뷰) 높이 600, 내용 높이 2000 → 내려갈 수 있는 끝은 1400
const TOP_ZONE = 46;
const metrics = (offset: number, contentHeight = 2000) => ({
  offset,
  contentHeight,
  viewportHeight: 600,
});

/** 스크롤 위치를 차례로 지나가며 상태를 굴린다 */
const scrollThrough = (
  offsets: readonly number[],
  from: AutoHideState = AUTO_HIDE_INITIAL,
  contentHeight?: number,
) =>
  offsets.reduce(
    (state, offset) =>
      nextAutoHideState(state, metrics(offset, contentHeight), TOP_ZONE),
    from,
  );

describe('nextAutoHideState (#148)', () => {
  it('처음에는 보인다', () => {
    expect(AUTO_HIDE_INITIAL.hidden).toBe(false);
  });

  it('맨 위에서 상단 바 높이를 지나 아래로 스크롤하면 숨는다', () => {
    expect(scrollThrough([0, 20, 40, 60, 80]).hidden).toBe(true);
  });

  it('맨 위 근처(상단 바 높이 이내)에서는 아래로 스크롤해도 보인다', () => {
    expect(scrollThrough([0, 10, 20, 30, 45]).hidden).toBe(false);
  });

  it('숨은 상태에서 위로 스크롤을 시작하면 맨 위까지 가지 않아도 다시 보인다', () => {
    const hidden = scrollThrough([0, 200, 400, 600]);
    expect(hidden.hidden).toBe(true);

    expect(scrollThrough([600 - DIRECTION_SLOP], hidden).hidden).toBe(false);
  });

  it('보이는 상태에서 다시 아래로 스크롤하면 또 숨는다', () => {
    const shown = scrollThrough([0, 200, 400, 600, 500]);
    expect(shown.hidden).toBe(false);

    expect(scrollThrough([500 + DIRECTION_SLOP], shown).hidden).toBe(true);
  });

  // 손가락 떨림·관성이 멈출 때의 작은 되돌림에 상단 바가 깜빡이지 않는다
  it('방향을 바꾼 거리가 DIRECTION_SLOP 보다 짧으면 그대로다', () => {
    const hidden = scrollThrough([0, 300, 600]);
    expect(
      scrollThrough([600 - DIRECTION_SLOP + 1, 600, 600 - 5], hidden).hidden,
    ).toBe(true);

    const shown = scrollThrough([0, 300, 600, 400]);
    expect(
      scrollThrough([400 + DIRECTION_SLOP - 1, 400, 405], shown).hidden,
    ).toBe(false);
  });

  // 위로 되돌리는 기준은 숨은 뒤 가장 아래로 내려간 위치다
  it('숨은 뒤 더 내려갔다가 올라오면 가장 아래 위치에서부터 잰다', () => {
    const hidden = scrollThrough([0, 300, 900]);

    expect(scrollThrough([900 - DIRECTION_SLOP + 1], hidden).hidden).toBe(true);
    expect(scrollThrough([900 - DIRECTION_SLOP], hidden).hidden).toBe(false);
  });

  // iOS 맨 위 바운스·당겨서 새로고침은 위치가 음수가 된다
  it('맨 위에서 아래로 당겼다 놓아도(음수 위치) 보이는 그대로다', () => {
    const states = [0, -30, -80, -60, -20, 0].map(offset =>
      nextAutoHideState(AUTO_HIDE_INITIAL, metrics(offset), TOP_ZONE),
    );

    expect(states.every(state => !state.hidden)).toBe(true);
    expect(scrollThrough([0, -30, -80, -60, -20, 0, 20]).hidden).toBe(false);
  });

  // iOS 맨 아래 바운스: 끝(1400)을 넘어 끌렸다가 되돌아오는 것은 위로 스크롤한 것이 아니다
  it('맨 아래에서 끝을 넘어 끌렸다 되돌아와도 숨은 그대로다', () => {
    const atEnd = scrollThrough([0, 600, 1200, 1400]);
    expect(atEnd.hidden).toBe(true);

    expect(scrollThrough([1450, 1500, 1460, 1420, 1400], atEnd).hidden).toBe(
      true,
    );
  });

  it('내용이 화면보다 짧으면 늘 보인다', () => {
    expect(scrollThrough([0, 30, 80, 120], AUTO_HIDE_INITIAL, 500).hidden).toBe(
      false,
    );
  });

  it('스크롤 끝이 상단 바 높이 이내면 끝까지 내려도 보인다', () => {
    expect(scrollThrough([0, 20, 40], AUTO_HIDE_INITIAL, 640).hidden).toBe(
      false,
    );
  });

  // 처음 상태는 위치를 모른다: 다른 리스트로 바뀐 뒤 처음 받은 위치를 기준으로 삼는다
  it('처음 받은 위치가 깊어도 그 위치를 기준으로 삼아 바로 숨지 않는다', () => {
    const first = scrollThrough([800]);
    expect(first.hidden).toBe(false);

    expect(scrollThrough([800 + DIRECTION_SLOP], first).hidden).toBe(true);
  });

  it('바뀐 것이 없으면 같은 상태를 돌려준다', () => {
    const hidden = scrollThrough([0, 300, 600]);

    expect(nextAutoHideState(hidden, metrics(600), TOP_ZONE)).toBe(hidden);
  });
});
