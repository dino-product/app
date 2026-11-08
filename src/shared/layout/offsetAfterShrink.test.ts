import { offsetAfterShrink } from './offsetAfterShrink';

describe('offsetAfterShrink', () => {
  it('줄어든 뒤 스크롤 끝을 넘는 위치면 줄어든 끝으로 당긴다', () => {
    // 내용 900 이 190 줄면 끝은 710 − 600 = 110
    expect(
      offsetAfterShrink({
        scrollOffset: 300,
        contentHeight: 900,
        viewportHeight: 600,
        shrinkBy: 190,
      }),
    ).toBe(110);
  });

  it('줄어든 뒤에도 끝 안쪽이면 지금 위치 그대로다', () => {
    expect(
      offsetAfterShrink({
        scrollOffset: 80,
        contentHeight: 900,
        viewportHeight: 600,
        shrinkBy: 190,
      }),
    ).toBe(80);
  });

  it('줄어든 내용이 스크롤 영역보다 작으면 맨 위(0)다', () => {
    expect(
      offsetAfterShrink({
        scrollOffset: 60,
        contentHeight: 700,
        viewportHeight: 637,
        shrinkBy: 192,
      }),
    ).toBe(0);
  });
});
