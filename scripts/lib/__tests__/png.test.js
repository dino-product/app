const { Buffer } = require('buffer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { decodePng, encodePng } = require('../png');

// #13 의 iOS 앱 아이콘을 복사해 둔 고정 파일(1024×1024 RGB, IDAT 4개, sRGB·eXIf 청크, Sub·Up·Paeth 필터).
// iOS 아이콘이 바뀌어도 이 파일은 그대로 둔다
const FIXTURE = path.join(__dirname, 'fixtures/rgb-multi-idat.png');

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([length, body, crc]);
};

// 필터 바이트가 붙은 스캔라인을 그대로 담은 PNG. methods = [압축, 필터, 인터레이스]
const rawPng = ({
  width,
  height,
  colorType = 2,
  bitDepth = 8,
  methods = [0, 0, 0],
  extra = [],
  rows,
}) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([bitDepth, colorType, ...methods], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    ...extra.map(([type, data]) => chunk(type, data)),
    chunk('IDAT', zlib.deflateSync(Buffer.from(rows.flat()))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};
const onePixel = options =>
  rawPng({ width: 1, height: 1, rows: [[0, 1, 2, 3]], ...options });
const iccProfile = name =>
  Buffer.concat([
    Buffer.from(`${name}\0\0`, 'latin1'),
    zlib.deflateSync('icc'),
  ]);

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

  it('macOS 가 쓴 PNG(여러 IDAT·부가 청크)를 독립 디코더와 같은 픽셀로 읽는다', () => {
    const { width, height, data } = decodePng(fs.readFileSync(FIXTURE));

    expect({ width, height }).toEqual({ width: 1024, height: 1024 });
    // Python 표준 라이브러리(zlib)로 따로 짠 디코더가 푼 RGBA 바이트의 SHA-256.
    // 고정 파일이라 다시 구할 일은 없다
    expect(crypto.createHash('sha256').update(data).digest('hex')).toBe(
      '2425a34abd410ba997833d15ae8ccd179332e76e22235739a0dc0311f288c869',
    );
  });

  it('IEND 뒤에 붙은 데이터는 읽지 않는다', () => {
    const png = Buffer.concat([onePixel(), Buffer.from('trailing')]);

    expect([...decodePng(png).data]).toEqual([1, 2, 3, 255]);
  });

  it('sRGB 색 프로필(iCCP)은 읽는다', () => {
    const png = onePixel({
      extra: [['iCCP', iccProfile('sRGB IEC61966-2.1')]],
    });

    expect([...decodePng(png).data]).toEqual([1, 2, 3, 255]);
  });

  it('PNG 가 아니면 거부한다', () => {
    expect(() => decodePng(Buffer.from('not a png'))).toThrow(/PNG/);
  });

  it.each([
    ['팔레트', { colorType: 3 }],
    ['16비트', { colorType: 6, bitDepth: 16 }],
    ['인터레이스', { methods: [0, 0, 1] }],
  ])('%s PNG 는 이유를 밝히고 거부한다', (_, format) => {
    expect(() => decodePng(onePixel(format))).toThrow(/8비트 RGB·RGBA/);
  });

  it.each([
    ['압축 방식', [1, 0, 0]],
    ['필터 방식', [0, 1, 0]],
  ])('IHDR 의 %s 이 0 이 아니면 거부한다', (_, methods) => {
    expect(() => decodePng(onePixel({ methods }))).toThrow(/압축·필터 방식/);
  });

  it('첫 청크가 IHDR 가 아니면 거부한다', () => {
    const png = Buffer.concat([
      onePixel().subarray(0, 8),
      chunk('IEND', Buffer.alloc(0)),
    ]);

    expect(() => decodePng(png)).toThrow(/IHDR/);
  });

  it('CRC 가 틀린 청크는 거부한다', () => {
    const png = Buffer.from(onePixel());
    const firstDataByte = png.indexOf('IDAT') + 4;
    png[firstDataByte] = (png[firstDataByte] + 1) % 256;

    expect(() => decodePng(png)).toThrow(/IDAT 청크의 CRC/);
  });

  it.each([
    ['청크 중간에서 잘린', png => png.subarray(0, png.length - 20)],
    ['IEND 가 없는', png => png.subarray(0, png.length - 12)],
  ])('%s 파일은 거부한다', (_, cut) => {
    expect(() => decodePng(cut(onePixel()))).toThrow(/파일 끝|IEND/);
  });

  it('압축을 푼 길이가 이미지 크기와 맞지 않으면 거부한다', () => {
    const png = rawPng({ width: 1, height: 2, rows: [[0, 1, 2, 3]] });

    expect(() => decodePng(png)).toThrow(/길이/);
  });

  it('알 수 없는 스캔라인 필터는 거부한다', () => {
    expect(() => decodePng(onePixel({ rows: [[5, 1, 2, 3]] }))).toThrow(
      /스캔라인 필터 5/,
    );
  });

  it.each([
    ['sRGB 가 아닌 색 프로필(iCCP)', ['iCCP', iccProfile('Display P3')]],
    ['투명색(tRNS)', ['tRNS', Buffer.from([0, 1, 0, 2, 0, 3])]],
  ])('%s 이 있으면 색이 달라지므로 거부한다', (_, extra) => {
    expect(() => decodePng(onePixel({ extra: [extra] }))).toThrow(
      /Display P3|tRNS/,
    );
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
