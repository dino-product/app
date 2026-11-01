#!/usr/bin/env node
// iOS 앱 아이콘(AppIcon.png)으로 Android 런처 아이콘 PNG 와 배경색을 만든다 (#53).
// 두 플랫폼이 같은 원본을 쓰므로, iOS 아이콘을 바꾸면 이 스크립트를 다시 돌린다: npm run icons:android
const fs = require('node:fs');
const path = require('node:path');
const { decodePng, encodePng } = require('./lib/png');
const { buildLauncherIcons } = require('./lib/launcher-icon');

const root = path.resolve(__dirname, '..');
const source = path.join(
  root,
  'ios/DinoApp/Images.xcassets/AppIcon.appiconset/AppIcon.png',
);
const res = path.join(root, 'android/app/src/main/res');

const { background, images } = buildLauncherIcons(
  decodePng(fs.readFileSync(source)),
);

for (const [file, image] of Object.entries(images)) {
  fs.writeFileSync(path.join(res, file), encodePng(image));
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
