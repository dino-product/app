import { offsetToRevealAboveKeyboard } from './revealAboveKeyboard';

// 스크롤 영역이 화면 위 100 ~ 700 (높이 600) 이고, 키보드 윗변이 450 이면 위 350 만 보인다
const viewport = { viewportTop: 100, viewportHeight: 600 };

describe('offsetToRevealAboveKeyboard', () => {
  it('대상 아래 끝이 키보드에 가리면, 아래 끝(+여백)이 키보드 윗변에 닿을 만큼 내린다', () => {
    expect(
      offsetToRevealAboveKeyboard({
        ...viewport,
        scrollOffset: 0,
        keyboardTop: 450,
        targetTop: 400,
        targetBottom: 536,
        gap: 24,
      }),
    ).toBe(536 + 24 - 350);
  });

  it('이미 스크롤해 둔 위치에서도 키보드 높이만큼 가린 곳을 계산한다', () => {
    expect(
      offsetToRevealAboveKeyboard({
        ...viewport,
        scrollOffset: 100,
        keyboardTop: 450,
        targetTop: 400,
        targetBottom: 536,
        gap: 0,
      }),
    ).toBe(536 - 350);
  });

  it('아래 끝(+여백)까지 이미 키보드 위에 보이면 지금 위치 그대로다', () => {
    expect(
      offsetToRevealAboveKeyboard({
        ...viewport,
        scrollOffset: 300,
        keyboardTop: 450,
        targetTop: 400,
        targetBottom: 536,
        gap: 24,
      }),
    ).toBe(300);
  });

  it('키보드가 스크롤 영역 아래에 있으면 스크롤 영역 높이만큼 보인다', () => {
    expect(
      offsetToRevealAboveKeyboard({
        ...viewport,
        scrollOffset: 0,
        keyboardTop: 760,
        targetTop: 600,
        targetBottom: 736,
        gap: 24,
      }),
    ).toBe(736 + 24 - 600);
  });

  it('대상이 위로 지나가 있으면 윗변이 보이게 올린다', () => {
    expect(
      offsetToRevealAboveKeyboard({
        ...viewport,
        scrollOffset: 450,
        keyboardTop: 450,
        targetTop: 400,
        targetBottom: 536,
        gap: 24,
      }),
    ).toBe(400);
  });

  it('보이는 높이보다 대상이 크면 윗변부터 보이게 한다 (가로 화면 등)', () => {
    expect(
      offsetToRevealAboveKeyboard({
        viewportTop: 60,
        viewportHeight: 250,
        scrollOffset: 0,
        keyboardTop: 160,
        targetTop: 400,
        targetBottom: 536,
        gap: 24,
      }),
    ).toBe(400);
  });

  it('키보드가 스크롤 영역을 다 덮어도 음수가 되지 않는다', () => {
    expect(
      offsetToRevealAboveKeyboard({
        ...viewport,
        scrollOffset: 0,
        keyboardTop: 40,
        targetTop: 0,
        targetBottom: 136,
        gap: 24,
      }),
    ).toBe(0);
  });
});
