const {
  DENSITIES,
  adaptiveLayer,
  buildLauncherIcons,
  legacyIcon,
  placeImage,
  separateBackground,
  toMonochrome,
} = require('../launcher-icon');

const image = (width, height, pixels) => ({
  width,
  height,
  data: Uint8Array.from(pixels.flat()),
});
const solid = (size, rgba) =>
  image(
    size,
    size,
    Array.from({ length: size * size }, () => rgba),
  );
const pixel = ({ width, data }, x, y) => [
  ...data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4),
];

const RED = [255, 0, 0, 255];
const CLEAR = [0, 0, 0, 0];
const WHITE = [255, 255, 255];

// 흰 배경 72×72 가운데에 보라색 24×24 사각형
const SOURCE = image(
  72,
  72,
  Array.from({ length: 72 * 72 }, (_, i) => {
    const [x, y] = [i % 72, Math.floor(i / 72)];
    const inside = x >= 24 && x < 48 && y >= 24 && y < 48;
    return inside ? [107, 90, 254, 255] : [255, 255, 255, 255];
  }),
);

describe('placeImage', () => {
  it('원본을 캔버스 안 정사각 영역에 맞춰 넣고 바깥은 투명하게 둔다', () => {
    const placed = placeImage(solid(4, RED), {
      canvas: 4,
      x: 1,
      y: 1,
      size: 2,
    });

    expect({ width: placed.width, height: placed.height }).toEqual({
      width: 4,
      height: 4,
    });
    expect(pixel(placed, 1, 1)).toEqual(RED);
    expect(pixel(placed, 2, 2)).toEqual(RED);
    expect(pixel(placed, 0, 0)).toEqual(CLEAR);
    expect(pixel(placed, 3, 2)).toEqual(CLEAR);
  });

  it('줄일 때 덮는 원본 픽셀의 넓이 평균을 투명도를 곱한 값으로 낸다', () => {
    // 왼쪽 흰색(불투명), 오른쪽 검은색(투명) — 투명 픽셀의 색이 섞여 회색이 되면 안 된다
    const half = image(2, 2, [
      [255, 255, 255, 255],
      [0, 0, 0, 0],
      [255, 255, 255, 255],
      [0, 0, 0, 0],
    ]);

    expect(
      pixel(placeImage(half, { canvas: 1, x: 0, y: 0, size: 1 }), 0, 0),
    ).toEqual([255, 255, 255, 128]);
  });

  it('영역 경계에 걸친 픽셀은 덮인 부분의 원본으로 채운다 (모양은 마스크가 정한다)', () => {
    const placed = placeImage(solid(1, RED), {
      canvas: 3,
      x: 0.5,
      y: 0.5,
      size: 2,
    });

    expect(pixel(placed, 0, 0)).toEqual(RED);
    expect(pixel(placed, 2, 1)).toEqual(RED);
  });
});

describe('separateBackground', () => {
  const composite = ([r, g, b, a], background) =>
    [r, g, b].map((c, i) =>
      Math.round((c * a) / 255 + background[i] * (1 - a / 255)),
    );

  it('배경색 픽셀은 투명해진다', () => {
    const separated = separateBackground(solid(1, [255, 255, 255, 255]), WHITE);

    expect(pixel(separated, 0, 0)[3]).toBe(0);
  });

  it.each([
    [[107, 90, 254], WHITE],
    [[203, 198, 255], WHITE],
    [[181, 172, 254], WHITE],
    [[0, 0, 0], WHITE],
    [
      [200, 100, 50],
      [100, 100, 100],
    ],
  ])(
    '%j 를 %j 배경에서 떼어 다시 얹으면 원본 색이 된다',
    (color, background) => {
      const separated = pixel(
        separateBackground(solid(1, [...color, 255]), background),
        0,
        0,
      );

      composite(separated, background).forEach((channel, i) =>
        expect(Math.abs(channel - color[i])).toBeLessThanOrEqual(1),
      );
    },
  );

  it('배경에서 가장 멀리 떨어진 채널만큼만 불투명해진다', () => {
    // 흰 배경의 보라(107, 90, 254)는 G 가 165 만큼 멀다
    expect(
      pixel(separateBackground(solid(1, [107, 90, 254, 255]), WHITE), 0, 0)[3],
    ).toBe(165);
  });
});

describe('toMonochrome', () => {
  it('흰색 한 가지로 칠하고, 가장 진한 픽셀이 불투명해지게 알파를 늘린다', () => {
    const mono = toMonochrome(
      image(3, 1, [
        [26, 0, 253, 165],
        [26, 0, 253, 57],
        [0, 0, 0, 0],
      ]),
    );

    expect([0, 1, 2].map(x => pixel(mono, x, 0))).toEqual([
      [255, 255, 255, 255],
      [255, 255, 255, 88],
      [255, 255, 255, 0],
    ]);
  });

  it('완전히 투명한 그림은 그대로 투명하다', () => {
    expect(pixel(toMonochrome(solid(1, CLEAR)), 0, 0)).toEqual([
      255, 255, 255, 0,
    ]);
  });
});

describe('adaptiveLayer', () => {
  it('108dp 층의 가운데 72dp 에 그림을 넣고 둘레 18dp 는 비운다', () => {
    const layer = adaptiveLayer(solid(72, RED), 1);

    expect(layer.width).toBe(108);
    expect(layer.height).toBe(108);
    expect(pixel(layer, 17, 54)).toEqual(CLEAR);
    expect(pixel(layer, 18, 54)).toEqual(RED);
    expect(pixel(layer, 89, 54)).toEqual(RED);
    expect(pixel(layer, 90, 54)).toEqual(CLEAR);
  });
});

describe('legacyIcon', () => {
  it('사각 아이콘은 48dp 가운데 38dp, 모서리 반지름 3dp 의 둥근 사각형이다', () => {
    const icon = legacyIcon(solid(72, RED), 1, 'square');

    expect(icon.width).toBe(48);
    expect(pixel(icon, 24, 24)).toEqual(RED);
    expect(pixel(icon, 5, 24)).toEqual(RED);
    expect(pixel(icon, 42, 24)).toEqual(RED);
    expect(pixel(icon, 4, 24)[3]).toBe(0);
    expect(pixel(icon, 43, 24)[3]).toBe(0);
    // 반지름 3dp 로 깎인 모서리
    expect(pixel(icon, 5, 5)[3]).toBe(0);
  });

  it('원형 아이콘은 48dp 가운데 지름 44dp 원이다', () => {
    const icon = legacyIcon(solid(72, RED), 1, 'round');

    expect(icon.width).toBe(48);
    expect(pixel(icon, 24, 3)).toEqual(RED);
    expect(pixel(icon, 2, 24)[3]).toBeGreaterThan(200);
    expect(pixel(icon, 24, 1)[3]).toBe(0);
    expect(pixel(icon, 6, 6)[3]).toBe(0);
  });

  it('밀도가 높으면 같은 dp 를 그만큼 큰 픽셀로 그린다', () => {
    const icon = legacyIcon(solid(72, RED), 1.5, 'square');

    expect(icon.width).toBe(72);
    // 사각형 왼쪽 끝 5dp = 7.5px 이라 7번 픽셀은 반만 덮인다
    expect(pixel(icon, 7, 36)[3]).toBe(128);
    expect(pixel(icon, 8, 36)).toEqual(RED);
  });
});

describe('buildLauncherIcons', () => {
  const built = buildLauncherIcons(SOURCE);

  it('배경색은 원본 왼쪽 위 픽셀 색이다', () => {
    expect(built.background).toBe('#FFFFFF');
  });

  it.each([
    ['투명한 픽셀이 있는', solid(2, CLEAR)],
    ['정사각이 아닌', image(2, 1, [RED, RED])],
  ])('%s 원본은 iOS 앱 아이콘이 아니므로 거부한다', (_, source) => {
    expect(() => buildLauncherIcons(source)).toThrow(/정사각·불투명/);
  });

  it('밀도마다 8.0 미만용 두 장과 적응형 전경·단색 층을 만든다', () => {
    const expected = Object.entries(DENSITIES).flatMap(([density, scale]) => [
      [`mipmap-${density}/ic_launcher.png`, 48 * scale],
      [`mipmap-${density}/ic_launcher_round.png`, 48 * scale],
      [`mipmap-${density}/ic_launcher_foreground.png`, 108 * scale],
      [`mipmap-${density}/ic_launcher_monochrome.png`, 108 * scale],
    ]);

    expect(
      Object.entries(built.images).map(([file, { width, height }]) => [
        file,
        width,
        height,
      ]),
    ).toEqual(expected.map(([file, size]) => [file, size, size]));
  });

  it('전경 층은 배경을 뺀 그림만 남긴다', () => {
    const foreground = built.images['mipmap-mdpi/ic_launcher_foreground.png'];

    expect(pixel(foreground, 30, 54)[3]).toBe(0);
    expect(pixel(foreground, 54, 54)[3]).toBe(165);
  });

  it('단색 층은 전경 그림과 같은 자리에 흰색 한 가지로 그린다', () => {
    const mono = built.images['mipmap-mdpi/ic_launcher_monochrome.png'];

    expect(pixel(mono, 30, 54)[3]).toBe(0);
    expect(pixel(mono, 54, 54)).toEqual([255, 255, 255, 255]);
  });

  it('8.0 미만용 아이콘은 배경까지 합친 원본 그대로다', () => {
    const icon = built.images['mipmap-mdpi/ic_launcher.png'];

    expect(pixel(icon, 24, 24)).toEqual([107, 90, 254, 255]);
    expect(pixel(icon, 8, 24)).toEqual([255, 255, 255, 255]);
  });
});
