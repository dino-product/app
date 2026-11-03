import { render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet, View } from 'react-native';
import { ShadowView, type DropShadow } from './ShadowView';

// 메인화면 진행 작업 카드의 Figma 드롭 섀도: X0 Y1 blur 18, #776BA8 12%
const cardShadow: DropShadow = {
  x: 0,
  y: 1,
  blur: 18,
  color: '#776BA8',
  opacity: 0.12,
};
const cardStyle = { padding: 20, borderRadius: 18, backgroundColor: '#FFFFFF' };

const renderCard = (shadow = cardShadow) =>
  render(
    <ShadowView shadow={shadow} style={cardStyle} testID="card">
      <View testID="content" />
    </ShadowView>,
  );

const onAndroid = (version: number) => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(version);
};

type Node = ReturnType<typeof screen.getByTestId>;
const styleOf = (node: Node) => StyleSheet.flatten(node.props.style) ?? {};
// -0 과 0 을 같게 본다 (x 가 0 이면 오른쪽 위치가 -0 이 된다)
const unsigned = (value: unknown) => Number(value) + 0;

// 카드 뒤에 깐 컨테이너와 그 안의 사각형들. 위치는 카드 기준으로 바꾸고,
// 진하기는 기기(processColor)처럼 1/255 단위로 읽는다
const shadowOf = (card: Node) => {
  const container = card.parent?.children.find(child => child !== card);
  if (container === undefined || typeof container === 'string') {
    return undefined;
  }
  const box = styleOf(container);
  const layers = container.children.map(layer => {
    if (typeof layer === 'string') {
      throw new Error('사각형이 아닙니다');
    }
    const style = styleOf(layer);
    const [, rgb, alpha] =
      /^rgba\((\d+, \d+, \d+), ([\d.]+)\)$/.exec(
        String(style.backgroundColor),
      ) ?? [];
    const edge = (side: 'top' | 'bottom' | 'left' | 'right') =>
      unsigned(Number(box[side]) + Number(style[side]));
    return {
      rgb,
      alpha: Math.round(Number(alpha) * 255) / 255,
      top: edge('top'),
      bottom: edge('bottom'),
      left: edge('left'),
      right: edge('right'),
      borderRadius: unsigned(style.borderRadius),
      // 컨테이너 안에서의 자기 위치
      inset: (['top', 'bottom', 'left', 'right'] as const).map(side =>
        unsigned(style[side]),
      ),
    };
  });
  return { container, box, layers };
};

describe('ShadowView', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('iOS 에서는 boxShadow 하나로 그린다', async () => {
    await renderCard();

    const card = screen.getByTestId('card');
    expect(card).toHaveStyle({
      ...cardStyle,
      boxShadow: '0px 1px 18px rgba(119, 107, 168, 0.12)',
    });
    expect(shadowOf(card)).toBeUndefined();
    expect(screen.getByTestId('content')).toBeOnTheScreen();
  });

  it('Android 9(API 28) 이상에서도 boxShadow 하나로 그린다', async () => {
    onAndroid(28);
    await renderCard();

    const card = screen.getByTestId('card');
    expect(card).toHaveStyle({
      boxShadow: '0px 1px 18px rgba(119, 107, 168, 0.12)',
    });
    expect(shadowOf(card)).toBeUndefined();
  });

  describe('boxShadow 를 못 그리는 Android 8.1(API 27) 이하', () => {
    beforeEach(() => onAndroid(27));

    // spread 만큼 키운 사각형 아래 d 만큼 밖은, spread ≥ d 인 사각형들이 겹쳐 덮는다
    const compositeAt = (
      layers: NonNullable<ReturnType<typeof shadowOf>>['layers'],
      d: number,
    ) =>
      1 -
      layers
        .filter(({ left }) => -left >= d)
        .reduce((rest, { alpha }) => rest * (1 - alpha), 1);

    it('boxShadow 대신 카드 뒤 컨테이너에 같은 색 둥근 사각형을 겹쳐 깔고, 한 번 그려 텍스처로 쓴다', async () => {
      await renderCard();

      const card = screen.getByTestId('card');
      expect(StyleSheet.flatten(card.props.style).boxShadow).toBeUndefined();
      expect(card).toHaveStyle(cardStyle);
      expect(screen.getByTestId('content')).toBeOnTheScreen();
      // 먼저 그린 컨테이너가 카드 뒤에 깔린다
      expect(card.parent?.children.at(-1)).toBe(card);

      const shadow = shadowOf(card);
      expect(shadow?.box).toMatchObject({
        position: 'absolute',
        pointerEvents: 'none',
      });
      // 사각형들이 평탄화돼 컨테이너 밖으로 빠지면 텍스처가 빈다
      expect(shadow?.container.props).toMatchObject({
        renderToHardwareTextureAndroid: true,
        collapsable: false,
        importantForAccessibility: 'no-hide-descendants',
      });
      const layers = shadow?.layers ?? [];
      expect(layers.length).toBeGreaterThan(1);
      // 하드웨어 레이어는 View 경계 밖을 자르므로 사각형이 모두 컨테이너 안에 있어야 한다.
      // 가장 큰 사각형이 컨테이너를 꼭 채우고, 컨테이너는 카드보다 그만큼 크고 Y 1 만큼 아래다
      const extent = Math.max(...layers.map(({ left }) => -left));
      expect(layers[0].inset).toEqual([0, 0, 0, 0]);
      for (const { inset } of layers) {
        expect(Math.min(...inset)).toBeGreaterThanOrEqual(0);
      }
      expect(
        [
          shadow?.box.top,
          shadow?.box.bottom,
          shadow?.box.left,
          shadow?.box.right,
        ].map(unsigned),
      ).toEqual([1 - extent, -1 - extent, -extent, -extent].map(unsigned));
      for (const { rgb, top, bottom, left, right, borderRadius } of layers) {
        const spread = -left;
        expect(rgb).toBe('119, 107, 168');
        // Y 1 만큼 아래로 내리고, 모서리는 CSS 처럼 키운 만큼 둥글어진다
        expect([top, bottom, right, borderRadius]).toEqual(
          [1 - spread, -1 - spread, -spread, 18 + spread].map(unsigned),
        );
      }
    });

    // 0.12 · (1 − Φ(d / 9)) 를 따로 계산한 값. 띠(2pt) 가운데에서 잰다
    it.each([
      [1, 0.0547],
      [3, 0.0443],
      [5, 0.0347],
      [7, 0.0262],
      [9, 0.019],
      [11, 0.0133],
      [13, 0.0089],
      [15, 0.0057],
      [17, 0.0035],
    ])(
      '그림자 가장자리에서 %ipt 밖의 겹친 진하기가 CSS 감쇠(σ = blur/2) %f 와 0.6/255 안에서 같다',
      async (d, expected) => {
        await renderCard();

        const layers = shadowOf(screen.getByTestId('card'))?.layers ?? [];
        // 바깥 사각형의 반올림 오차를 안쪽 사각형이 메우므로 한 단계(1/255)보다 작다
        expect(Math.abs(compositeAt(layers, d) - expected)).toBeLessThan(
          0.6 / 255,
        );
      },
    );

    it('1/255 보다 옅어 기기에서 안 보이는 바깥 사각형은 만들지 않는다', async () => {
      await renderCard();

      const layers = shadowOf(screen.getByTestId('card'))?.layers ?? [];
      for (const { alpha } of layers) {
        expect(alpha).toBeGreaterThanOrEqual(1 / 255);
      }
      // 3σ(27) 까지 2pt 씩이면 15장이지만, 바깥은 1/255 아래라 빠진다
      expect(layers.length).toBeGreaterThan(1);
      expect(layers.length).toBeLessThan(15);
    });

    it('blur 0 이면 같은 크기의 사각형 하나를 x·y 만큼 옮겨 깐다', async () => {
      await renderCard({
        x: 3,
        y: -2,
        blur: 0,
        color: '#000000',
        opacity: 0.2,
      });

      expect(shadowOf(screen.getByTestId('card'))?.layers).toEqual([
        {
          rgb: '0, 0, 0',
          alpha: 0.2,
          top: -2,
          bottom: 2,
          left: 3,
          right: -3,
          borderRadius: 18,
          inset: [0, 0, 0, 0],
        },
      ]);
    });

    it('너무 옅어 그릴 사각형이 없으면 카드만 그린다', async () => {
      await renderCard({ ...cardShadow, opacity: 0.001 });

      const card = screen.getByTestId('card');
      expect(card).toHaveStyle(cardStyle);
      expect(StyleSheet.flatten(card.props.style).boxShadow).toBeUndefined();
      expect(shadowOf(card)).toBeUndefined();
    });
  });
});
