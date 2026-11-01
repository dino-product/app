// iOS 앱 아이콘 한 장(정사각·불투명)에서 Android 런처 아이콘을 만든다 (#53).
// - 적응형 아이콘(8.0+): 108dp 층의 가운데 72dp 가 보이고, 지름 66dp 원 안은 잘리지 않는다.
//   iOS 아이콘 전체를 보이는 72dp 에 맞춘다. 전경은 배경색을 뺀 그림, 단색 층(13+ 테마 아이콘)은 전경의 알파다.
//   전경은 반투명 색이라 배경 층(같은 배경색) 위에서만 원본 색이 된다. 다른 색 위에 그리는 곳
//   (예: 스플래시의 windowSplashScreenIconBackgroundColor, #21)에서는 색이 달라진다.
// - 8.0 미만: 48dp 안에서 Material 키라인 모양으로 자른다. 템플릿 아이콘과 같은 치수(사각 38dp·모서리 3dp, 원 44dp)다.
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const LAYER_DP = 108;
const VIEWPORT_DP = 72;
const SAFE_ZONE_DP = 66;
const LEGACY_DP = 48;
const LEGACY_SHAPES = {
  square: { size: 38, radius: 3 },
  round: { size: 44, radius: 22 },
};

// 축 하나에서 출력 픽셀마다 덮는 원본 픽셀 구간(first 부터)과, 겹친 길이를 합이 1 이 되게 나눈 가중치
function axisTaps(sourceLength, canvas, start, size) {
  const scale = sourceLength / size;
  return Array.from({ length: canvas }, (_, i) => {
    const from = (Math.max(i, start) - start) * scale;
    const to = Math.min(
      (Math.min(i + 1, start + size) - start) * scale,
      sourceLength,
    );
    const first = Math.floor(from);
    const overlaps = [];
    for (let s = first; s < to; s++) {
      overlaps.push(Math.min(s + 1, to) - Math.max(s, from));
    }
    const total = overlaps.reduce((sum, overlap) => sum + overlap, 0);
    return { first, weights: overlaps.map(overlap => overlap / total) };
  });
}

// 원본을 canvas×canvas 의 정사각 영역 (x, y, size) 에 넓이 평균으로 줄여 넣는다. 영역 밖은 투명하다.
// 영역 경계에 걸친 픽셀은 덮인 부분의 평균으로 채우고, 모양은 legacyIcon 의 마스크가 정한다.
function placeImage(image, { canvas, x, y, size }) {
  const { width, height } = image;
  const columns = axisTaps(width, canvas, x, size);
  const rows = axisTaps(height, canvas, y, size);

  // 가로로 먼저 줄인다. 색에 알파를 곱해 더해야 투명 픽셀의 색이 섞이지 않는다
  const horizontal = new Float64Array(height * canvas * 4);
  for (let ox = 0; ox < canvas; ox++) {
    const { first, weights } = columns[ox];
    for (let sy = 0; sy < height; sy++) {
      const out = (sy * canvas + ox) * 4;
      for (let k = 0; k < weights.length; k++) {
        const from = (sy * width + first + k) * 4;
        const alpha = image.data[from + 3] * weights[k];
        horizontal[out] += (image.data[from] * alpha) / 255;
        horizontal[out + 1] += (image.data[from + 1] * alpha) / 255;
        horizontal[out + 2] += (image.data[from + 2] * alpha) / 255;
        horizontal[out + 3] += alpha;
      }
    }
  }

  const data = new Uint8Array(canvas * canvas * 4);
  for (let oy = 0; oy < canvas; oy++) {
    const { first, weights } = rows[oy];
    for (let ox = 0; ox < canvas; ox++) {
      const pixel = [0, 0, 0, 0];
      for (let k = 0; k < weights.length; k++) {
        const from = ((first + k) * canvas + ox) * 4;
        for (let c = 0; c < 4; c++) {
          pixel[c] += horizontal[from + c] * weights[k];
        }
      }
      const alpha = pixel[3];
      if (alpha > 0) {
        const out = (oy * canvas + ox) * 4;
        for (let c = 0; c < 3; c++) {
          data[out + c] = Math.round((pixel[c] * 255) / alpha);
        }
        data[out + 3] = Math.round(alpha);
      }
    }
  }
  return { width: canvas, height: canvas, data };
}

// 채널 하나가 배경값에서 끝(0 또는 255)까지 가는 길의 몇 할을 갔는지
function reach(value, background) {
  if (value > background) {
    return (value - background) / (255 - background);
  }
  return value < background ? (background - value) / background : 0;
}

// 배경색을 투명으로 바꾼다. 남는 알파는 가장 많이 간 채널만큼이라, 배경 위에 다시 얹으면 원본 색이 된다
function separateBackground(image, background) {
  const data = new Uint8Array(image.data.length);
  for (let i = 0; i < data.length; i += 4) {
    let alpha = 0;
    for (let c = 0; c < 3; c++) {
      alpha = Math.max(alpha, reach(image.data[i + c], background[c]));
    }
    if (alpha > 0) {
      for (let c = 0; c < 3; c++) {
        data[i + c] = Math.round(
          background[c] + (image.data[i + c] - background[c]) / alpha,
        );
      }
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  return { ...image, data };
}

// 흰색 한 가지로 칠하고, 가장 진한 픽셀이 불투명해지게 알파를 늘린다. 테마 아이콘은 알파만 쓴다
function toMonochrome(image) {
  let darkest = 0;
  for (let i = 3; i < image.data.length; i += 4) {
    darkest = Math.max(darkest, image.data[i]);
  }
  const data = new Uint8Array(image.data.length).fill(255);
  for (let i = 3; i < data.length; i += 4) {
    data[i] = darkest ? Math.round((image.data[i] * 255) / darkest) : 0;
  }
  return { ...image, data };
}

function adaptiveLayer(image, scale) {
  const inset = ((LAYER_DP - VIEWPORT_DP) / 2) * scale;
  return placeImage(image, {
    canvas: LAYER_DP * scale,
    x: inset,
    y: inset,
    size: VIEWPORT_DP * scale,
  });
}

function legacyIcon(source, scale, shape) {
  const { size, radius } = LEGACY_SHAPES[shape];
  const canvas = LEGACY_DP * scale;
  const inset = ((LEGACY_DP - size) / 2) * scale;
  const icon = placeImage(source, {
    canvas,
    x: inset,
    y: inset,
    size: size * scale,
  });
  // 둥근 사각형까지의 부호 있는 거리(픽셀 중심 기준)로 가장자리 1px 을 부드럽게 자른다
  const center = canvas / 2;
  const straight = (size / 2 - radius) * scale;
  const corner = radius * scale;
  for (let y = 0; y < canvas; y++) {
    for (let x = 0; x < canvas; x++) {
      const qx = Math.abs(x + 0.5 - center) - straight;
      const qy = Math.abs(y + 0.5 - center) - straight;
      const [ox, oy] = [Math.max(qx, 0), Math.max(qy, 0)];
      const distance =
        Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - corner;
      const coverage = Math.min(Math.max(0.5 - distance, 0), 1);
      const alpha = (y * canvas + x) * 4 + 3;
      icon.data[alpha] = Math.round(icon.data[alpha] * coverage);
    }
  }
  return icon;
}

const toHex = rgb =>
  `#${rgb
    .map(channel => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;

// 안전 영역 밖이 왼쪽 위 픽셀과 정확히 같은 색이어야 한다.
// 1단계만 달라도 배경 분리에서 알파가 남아 단색 층에 안전 영역 밖 점이 생긴다
function assertSolidBackground(source, background) {
  const center = source.width / 2;
  const radius = (SAFE_ZONE_DP / VIEWPORT_DP / 2) * source.width;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const [dx, dy] = [x + 0.5 - center, y + 0.5 - center];
      const i = (y * source.width + x) * 4;
      const differs = background.some(
        (channel, c) => source.data[i + c] !== channel,
      );
      if (differs && dx * dx + dy * dy > radius * radius) {
        throw new Error(
          `원본의 66dp 안전 영역 밖 (${x}, ${y}) 이 배경색과 다릅니다. 배경은 한 가지 색이어야 합니다`,
        );
      }
    }
  }
}

// 반환하는 images 의 키는 android/app/src/main/res 아래 경로다
function buildLauncherIcons(source) {
  let opaque = true;
  for (let i = 3; i < source.data.length; i += 4) {
    opaque = opaque && source.data[i] === 255;
  }
  if (source.width !== source.height || !opaque) {
    throw new Error('원본은 iOS 앱 아이콘처럼 정사각·불투명해야 합니다');
  }
  const background = [...source.data.subarray(0, 3)];
  assertSolidBackground(source, background);
  const logo = separateBackground(source, background);
  const monochrome = toMonochrome(logo);

  const images = {};
  for (const [density, scale] of Object.entries(DENSITIES)) {
    const dir = `mipmap-${density}`;
    images[`${dir}/ic_launcher.png`] = legacyIcon(source, scale, 'square');
    images[`${dir}/ic_launcher_round.png`] = legacyIcon(source, scale, 'round');
    images[`${dir}/ic_launcher_foreground.png`] = adaptiveLayer(logo, scale);
    images[`${dir}/ic_launcher_monochrome.png`] = adaptiveLayer(
      monochrome,
      scale,
    );
  }
  return { background: toHex(background), images };
}

// AppIcon 세트 Contents.json 에서 기본(라이트) 1024 이미지 파일 이름. 다크·틴트 변형은 appearances 가 붙어 있다
function appIconSource({ images }) {
  const entry = images.find(
    ({ filename, size, appearances }) =>
      filename && size === '1024x1024' && !appearances,
  );
  if (!entry) {
    throw new Error('AppIcon 세트에 기본 1024 이미지가 없습니다');
  }
  return entry.filename;
}

module.exports = {
  DENSITIES,
  adaptiveLayer,
  appIconSource,
  buildLauncherIcons,
  legacyIcon,
  placeImage,
  separateBackground,
  toMonochrome,
};
