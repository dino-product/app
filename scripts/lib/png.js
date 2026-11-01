// 의존성 없는 PNG 읽기·쓰기. 앱 아이콘 생성(scripts/generate-android-icons.js)과 아이콘 테스트가 쓴다.
// 이미지는 { width, height, data } 이고 data 는 RGBA 8비트(곱하지 않은 알파)다.
const { Buffer } = require('node:buffer');
const zlib = require('node:zlib');

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 2: 3, 6: 4 }; // 색 형식: 2 = RGB, 6 = RGBA

// IEND 앞까지의 청크. IEND 뒤에 붙은 데이터는 읽지 않는다
function readChunks(buffer) {
  const chunks = [];
  for (let offset = SIGNATURE.length; offset + 12 <= buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) {
      throw new Error('PNG 청크가 파일 끝을 넘습니다');
    }
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const crc = zlib.crc32(buffer.subarray(offset + 4, end - 4));
    if (crc !== buffer.readUInt32BE(end - 4)) {
      throw new Error(`PNG ${type} 청크의 CRC 가 맞지 않습니다`);
    }
    if (type === 'IEND') {
      return chunks;
    }
    chunks.push({ type, data: buffer.subarray(offset + 8, end - 4) });
    offset = end;
  }
  throw new Error('PNG 에 IEND 가 없습니다');
}

// 색이 sRGB 가 아니게 되는 청크는 거부한다. iCCP 데이터는 프로필 이름(널 문자로 끝남)으로 시작한다
function assertSrgb(chunks) {
  const profile = chunks.find(({ type }) => type === 'iCCP');
  const name = profile?.data.toString('latin1', 0, profile.data.indexOf(0));
  if (profile && !name.includes('sRGB')) {
    throw new Error(`sRGB 가 아닌 색 프로필(${name})은 읽지 않습니다`);
  }
  if (chunks.some(({ type }) => type === 'tRNS')) {
    throw new Error('투명색(tRNS) 청크는 읽지 않습니다');
  }
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) {
    return left;
  }
  return toUp <= toUpLeft ? up : upLeft;
}

function predict(filter, left, up, upLeft) {
  switch (filter) {
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return Math.floor((left + up) / 2);
    case 4:
      return paeth(left, up, upLeft);
    default:
      return 0;
  }
}

// 스캔라인 필터를 되돌린다. 바이트 덧셈은 Uint8Array 에 넣을 때 256 으로 나눈 나머지가 된다
function unfilter(raw, { width, height, channels }) {
  const stride = width * channels;
  const pixels = new Uint8Array(stride * height);
  if (raw.length !== (stride + 1) * height) {
    throw new Error('압축을 푼 PNG 데이터 길이가 이미지 크기와 맞지 않습니다');
  }
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) {
      throw new Error(`알 수 없는 스캔라인 필터 ${filter} 입니다`);
    }
    const line = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[row + x - channels] : 0;
      const up = y > 0 ? pixels[row - stride + x] : 0;
      const upLeft =
        x >= channels && y > 0 ? pixels[row - stride + x - channels] : 0;
      pixels[row + x] = raw[line + x] + predict(filter, left, up, upLeft);
    }
  }
  return pixels;
}

function decodePng(buffer) {
  if (!SIGNATURE.equals(buffer.subarray(0, SIGNATURE.length))) {
    throw new Error('PNG 파일이 아닙니다');
  }
  const chunks = readChunks(buffer);
  if (chunks[0]?.type !== 'IHDR') {
    throw new Error('PNG 첫 청크가 IHDR 가 아닙니다');
  }
  const header = chunks[0].data;
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const [bitDepth, colorType, compression, filtering, interlace] =
    header.subarray(8);
  if (compression !== 0 || filtering !== 0) {
    throw new Error('PNG 헤더의 압축·필터 방식이 0 이 아닙니다');
  }
  const channels = CHANNELS[colorType];
  if (bitDepth !== 8 || !channels || interlace !== 0) {
    throw new Error(
      `8비트 RGB·RGBA, 비인터레이스 PNG 만 읽습니다 (비트 ${bitDepth}, 색 형식 ${colorType}, 인터레이스 ${interlace})`,
    );
  }
  assertSrgb(chunks);
  const raw = zlib.inflateSync(
    Buffer.concat(
      chunks.filter(({ type }) => type === 'IDAT').map(({ data }) => data),
    ),
  );
  const pixels = unfilter(raw, { width, height, channels });
  if (channels === 4) {
    return { width, height, data: pixels };
  }
  const data = new Uint8Array(width * height * 4).fill(255);
  for (let i = 0; i < width * height; i++) {
    data.set(pixels.subarray(i * 3, i * 3 + 3), i * 4);
  }
  return { width, height, data };
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([length, body, crc]);
}

// 늘 8비트 RGBA, 스캔라인 필터 없음(0)으로 쓴다. aapt2 가 빌드 때 다시 압축한다
function encodePng({ width, height, data }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { decodePng, encodePng };
