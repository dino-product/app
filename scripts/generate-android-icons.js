#!/usr/bin/env node
// iOS 앱 아이콘으로 Android 런처 아이콘 PNG 와 배경색을 만든다 (#53).
// 두 플랫폼이 같은 원본을 쓰므로, iOS 아이콘을 바꾸면 이 스크립트를 다시 돌린다: npm run icons:android
const fs = require('node:fs');
const path = require('node:path');
const { decodePng, encodePng } = require('./lib/png');
const { buildLauncherIcons } = require('./lib/launcher-icon');

const root = path.resolve(__dirname, '..');
const iconSet = path.join(
  root,
  'ios/DinoApp/Images.xcassets/AppIcon.appiconset',
);
const res = path.join(root, 'android/app/src/main/res');

// AppIcon 세트의 기본(라이트) 1024 이미지. 다크·틴트 변형은 appearances 가 붙어 있다
const { images: entries } = JSON.parse(
  fs.readFileSync(path.join(iconSet, 'Contents.json'), 'utf8'),
);
const entry = entries.find(
  ({ filename, size, appearances }) =>
    filename && size === '1024x1024' && !appearances,
);
if (!entry) {
  throw new Error(`${iconSet}/Contents.json 에 기본 1024 아이콘이 없습니다`);
}
const source = path.join(iconSet, entry.filename);

const { background, images } = buildLauncherIcons(
  decodePng(fs.readFileSync(source)),
);

for (const [file, image] of Object.entries(images)) {
  const target = path.join(res, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, encodePng(image));
  // 같은 이름의 다른 형식이 있으면 aapt2 가 리소스 중복으로 빌드를 멈춘다
  const webp = target.replace(/\.png$/, '.webp');
  if (fs.existsSync(webp)) {
    console.warn(
      `${path.relative(root, webp)} 가 함께 있습니다. 지워야 빌드됩니다`,
    );
  }
}
fs.writeFileSync(
  path.join(res, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<!-- scripts/generate-android-icons.js 가 iOS 앱 아이콘 배경색으로 만든다. 직접 고치지 않는다 -->
<resources>
    <color name="ic_launcher_background">${background}</color>
</resources>
`,
);

console.log(
  `${path.relative(root, source)} → ${path.relative(root, res)}: PNG ${
    Object.keys(images).length
  }장, 배경색 ${background}`,
);
