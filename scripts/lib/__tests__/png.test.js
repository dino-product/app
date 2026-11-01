const { Buffer } = require('buffer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { decodePng, encodePng } = require('../png');

const IOS_ICON = path.resolve(
  __dirname,
  '../../../ios/DinoApp/Images.xcassets/AppIcon.appiconset/AppIcon.png',
);

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([length, body, crc]);
};

// 필터 바이트가 붙은 스캔라인을 그대로 담은 PNG
const rawPng = ({ width, height, colorType = 2, bitDepth = 8, rows }) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(bitDepth, 8);
  header.writeUInt8(colorType, 9);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(Buffer.from(rows.flat()))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

describe('decodePng', () => {
  it('다섯 가지 스캔라인 필터(None·Sub·Up·Average·Paeth)를 모두 되돌린다', () => {
    const png = rawPng({
      width: 2,
      height: 5,
      rows: [
        [0, 10, 20, 30, 40, 50, 60],
        [1, 11, 22, 33, 33, 33, 33],
        [2, 1, 2, 3, 4, 5, 6],
        [3, 7, 14, 21, 22, 22, 23],
        [4, 1, 2, 3, 4, 5, 6],
      ],
    });

    const { width, height, data } = decodePng(png);

    expect({ width, height }).toEqual({ width: 2, height: 5 });
    expect([...data]).toEqual(
      [
        [10, 20, 30, 40, 50, 60],
        [11, 22, 33, 44, 55, 66],
        [12, 24, 36, 48, 60, 72],
        [13, 26, 39, 52, 65, 78],
        [14, 28, 42, 56, 70, 84],
      ].flatMap(([r1, g1, b1, r2, g2, b2]) => [
        r1,
        g1,
        b1,
        255,
        r2,
        g2,
        b2,
        255,
      ]),
    );
  });

  it('iOS 앱 아이콘(RGB, 여러 IDAT·부가 청크)을 독립 디코더와 같은 픽셀로 읽는다', () => {
    const { width, height, data } = decodePng(fs.readFileSync(IOS_ICON));

    expect({ width, height }).toEqual({ width: 1024, height: 1024 });
    // Python zlib 으로 따로 푼 RGBA 바이트의 SHA-256
    expect(crypto.createHash('sha256').update(data).digest('hex')).toBe(
      '2425a34abd410ba997833d15ae8ccd179332e76e22235739a0dc0311f288c869',
    );
  });

  it('PNG 가 아니면 거부한다', () => {
    expect(() => decodePng(Buffer.from('not a png'))).toThrow(/PNG/);
  });

  it.each([
    ['팔레트', { colorType: 3, bitDepth: 8 }],
    ['16비트', { colorType: 6, bitDepth: 16 }],
  ])('%s PNG 는 이유를 밝히고 거부한다', (_, format) => {
    const png = rawPng({ width: 1, height: 1, ...format, rows: [[0, 0]] });

    expect(() => decodePng(png)).toThrow(/8비트 RGB·RGBA/);
  });
});

describe('encodePng', () => {
  it('RGBA 픽셀을 그대로 되읽을 수 있게 쓴다', () => {
    const image = {
      width: 3,
      height: 2,
      data: Uint8Array.from({ length: 3 * 2 * 4 }, (_, i) => (i * 37) % 256),
    };

    const decoded = decodePng(encodePng(image));

    expect(decoded.width).toBe(3);
    expect(decoded.height).toBe(2);
    expect([...decoded.data]).toEqual([...image.data]);
  });
});
