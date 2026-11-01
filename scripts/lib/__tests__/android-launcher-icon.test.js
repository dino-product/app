// Android 홈 화면 아이콘 (#53). iOS 앱 아이콘과 같은 원본에서 `npm run icons:android` 로 만든다.
// 원본(AppIcon 세트의 기본 1024 이미지)을 바꾸면 스크립트를 다시 돌려야 '최신 결과' 테스트가 통과한다.
const { Buffer } = require('buffer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { decodePng } = require('../png');
const { appIconSource, buildLauncherIcons } = require('../launcher-icon');

const root = path.resolve(__dirname, '..', '..', '..');
const RES = path.join(root, 'android/app/src/main/res');
// 생성 스크립트와 같은 방법으로 원본을 찾는다
const ICON_SET = path.join(
  root,
  'ios/DinoApp/Images.xcassets/AppIcon.appiconset',
);
const IOS_ICON = path.join(
  ICON_SET,
  appIconSource(
    JSON.parse(fs.readFileSync(path.join(ICON_SET, 'Contents.json'), 'utf8')),
  ),
);
// 주석 안의 층·색은 세지 않는다
const read = file =>
  fs.readFileSync(path.join(RES, file), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const readPng = file => decodePng(fs.readFileSync(path.join(RES, file)));
const iosIcon = decodePng(fs.readFileSync(IOS_ICON));

const ADAPTIVE_ICONS = ['ic_launcher', 'ic_launcher_round'];
// Android 밀도별 배율. 구현 값을 그대로 믿지 않도록 테스트에 따로 적는다
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const LEGACY_DP = 48;
const LAYER_DP = 108;
const SAFE_ZONE_DIAMETER_DP = 66;

// 초기 커밋(6cfe2d0) 템플릿 로봇 아이콘의 SHA-256. CI 는 얕은 체크아웃이라 git 이력 대신 값으로 둔다
const TEMPLATE_ROBOT_ICONS = [
  'eef20f25fb1477d8c9df15757e764811cc503fb0777f18d0f7fb2d19178b5bf6',
  '520d05f978a15ba0ccf23006a1a5691a054a02478c70cafc5ebafae76e600f0d',
  'ded7aabf6a56b694e486e096efd89e2f0c9067d292b634663898e352c9491f10',
  '21304a0c9b00da6a72cfa31c7229c9528fc17b6e5eb4e68a969bce08c01a2fee',
  'e77c5045bfdb6f4bbe955b3a793bfed3baa369ce4811ae2a9103d5480637cfff',
  '2846e1a703e519791fe22f41bcb243b82f908d12e5ebcb43f020ddf9982780b0',
  'eb3a34b13632e0cb3b1c0f4273035866cbe81b1b17b7178ce29d19c78d394a5e',
  '363a569beb72e8b007bf046454612148d4c9f782b9391352059fe83179f18e30',
  '9ff27328b6916b7f75b99ef36153f154bb4724946e5654635cba2e257352c69f',
  '5bacd97a1b41e4413c6092cdbd83f65112a9124e823cfaa3a219c65e2761647b',
];

const layersOf = name =>
  Object.fromEntries(
    [
      ...read(`mipmap-anydpi-v26/${name}.xml`).matchAll(
        /<(background|foreground|monochrome)\s+android:drawable="@(\w+)\/(\w+)"\s*\/>/g,
      ),
    ].map(([, layer, type, resource]) => [layer, { type, resource }]),
  );
// 두 적응형 아이콘이 가리키는 그 층의 리소스 (서로 달라도 모두 검사한다)
const layerResources = layer => [
  ...new Set(ADAPTIVE_ICONS.map(name => layersOf(name)[layer].resource)),
];
const colorValue = name =>
  fs
    .readdirSync(path.join(RES, 'values'))
    .map(file => read(`values/${file}`))
    .join('\n')
    .match(new RegExp(`<color\\s+name="${name}">([^<]+)</color>`))?.[1];
const densityEntries = Object.entries(DENSITIES);

describe('Android 런처 아이콘 (#53)', () => {
  it('Manifest 의 icon·roundIcon 이 적응형 아이콘 이름을 가리킨다', () => {
    const manifest = fs.readFileSync(
      path.join(root, 'android/app/src/main/AndroidManifest.xml'),
      'utf8',
    );

    expect(manifest).toMatch(/android:icon="@mipmap\/ic_launcher"/);
    expect(manifest).toMatch(/android:roundIcon="@mipmap\/ic_launcher_round"/);
  });

  it.each(ADAPTIVE_ICONS)(
    'mipmap-anydpi-v26/%s.xml 은 배경·전경·단색 세 층의 적응형 아이콘이다',
    name => {
      expect(read(`mipmap-anydpi-v26/${name}.xml`)).toMatch(/<adaptive-icon\b/);
      expect(Object.keys(layersOf(name)).sort()).toEqual([
        'background',
        'foreground',
        'monochrome',
      ]);
    },
  );

  it.each(ADAPTIVE_ICONS)(
    '%s 의 층 리소스가 있다 — mipmap 은 모든 밀도에, color 는 values 에',
    name => {
      Object.values(layersOf(name)).forEach(({ type, resource }) => {
        if (type === 'color') {
          expect(colorValue(resource)).toBeDefined();
        } else {
          expect(type).toBe('mipmap');
          densityEntries.forEach(([density]) =>
            expect(
              fs.existsSync(
                path.join(RES, `mipmap-${density}/${resource}.png`),
              ),
            ).toBe(true),
          );
        }
      });
    },
  );

  it('배경색이 iOS 앱 아이콘 배경과 같다', () => {
    const hex = `#${[...iosIcon.data.subarray(0, 3)]
      .map(channel => channel.toString(16).padStart(2, '0'))
      .join('')}`.toUpperCase();

    expect(layerResources('background').map(colorValue)).toEqual(
      layerResources('background').map(() => hex),
    );
  });

  it.each(densityEntries)(
    '%s 아이콘 크기가 Android 규격이다 — 8.0 미만용 48dp, 적응형 층 108dp',
    (density, scale) => {
      const sizes = [
        ...ADAPTIVE_ICONS.map(name => [name, LEGACY_DP]),
        ...layerResources('foreground').map(name => [name, LAYER_DP]),
        ...layerResources('monochrome').map(name => [name, LAYER_DP]),
      ];

      sizes.forEach(([name, dp]) => {
        const { width, height } = readPng(`mipmap-${density}/${name}.png`);
        expect({ name, width, height }).toEqual({
          name,
          width: dp * scale,
          height: dp * scale,
        });
      });
    },
  );

  it('8.0 미만용 PNG 가 초기 템플릿의 로봇 아이콘이 아니다', () => {
    const hashes = densityEntries.flatMap(([density]) =>
      ADAPTIVE_ICONS.map(name =>
        crypto
          .createHash('sha256')
          .update(
            fs.readFileSync(path.join(RES, `mipmap-${density}/${name}.png`)),
          )
          .digest('hex'),
      ),
    );

    expect(hashes.filter(hash => TEMPLATE_ROBOT_ICONS.includes(hash))).toEqual(
      [],
    );
  });

  it.each(densityEntries)(
    '%s 전경·단색 층의 그림이 지름 66dp 안전 영역 안에 있다',
    (density, scale) => {
      const resources = [
        ...layerResources('foreground'),
        ...layerResources('monochrome'),
      ];
      // 안전 영역 원에 걸친 픽셀은 중심이 원 밖으로 반 픽셀 대각선만큼 나갈 수 있다
      const limit = (SAFE_ZONE_DIAMETER_DP / 2) * scale + Math.SQRT1_2;

      resources.forEach(resource => {
        const { width, height, data } = readPng(
          `mipmap-${density}/${resource}.png`,
        );
        const outside = [];
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const distance = Math.hypot(
              x + 0.5 - width / 2,
              y + 0.5 - height / 2,
            );
            if (data[(y * width + x) * 4 + 3] > 0 && distance > limit) {
              outside.push([x, y]);
            }
          }
        }
        expect({ resource, outside }).toEqual({ resource, outside: [] });
      });
    },
  );

  it.each(densityEntries)('%s 단색 층은 한 가지 색이다', density => {
    const colors = new Set();
    layerResources('monochrome').forEach(resource => {
      const { data } = readPng(`mipmap-${density}/${resource}.png`);
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
          colors.add(data.subarray(i, i + 3).join(','));
        }
      }
    });

    expect([...colors]).toEqual(['255,255,255']);
  });

  it('PNG 가 iOS 앱 아이콘에서 만든 최신 결과다 (원본을 바꿨다면 npm run icons:android)', () => {
    const { images } = buildLauncherIcons(iosIcon);
    const stale = Object.entries(images)
      .filter(([file, image]) => {
        const committed = readPng(file);
        return (
          committed.width !== image.width ||
          !Buffer.from(committed.data).equals(Buffer.from(image.data))
        );
      })
      .map(([file]) => file);

    expect(stale).toEqual([]);
  });
});
