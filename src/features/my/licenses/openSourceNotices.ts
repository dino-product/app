// 오픈소스 고지 (#232). 마이 › 약관 및 앱 정보 › 오픈소스 라이선스 화면이 보이는 내용이다.
// 표(이름·버전·라이선스·저작권)는 사용자가 준 고지 문서 그대로다. 라이선스 전문은 licenseTexts.ts.
// 앱에 실어 네트워크 없이 열린다. 의존성(package.json·Podfile.lock·Gradle)을 바꾸면 이 표도 함께 고친다

/** 라이선스 종류. 표의 '라이선스' 칸 값이자 전문의 키 */
export type LicenseId =
  | 'MIT'
  | 'Apache-2.0'
  | 'BSD-3-Clause'
  | 'Zlib'
  | 'BSL-1.0'
  | 'OFL-1.1'
  | 'MMKV';

/** 전문 차례 (고지 문서 '라이선스 전문' 순서) */
export const LICENSE_IDS: readonly LicenseId[] = [
  'MIT',
  'Apache-2.0',
  'BSD-3-Clause',
  'Zlib',
  'BSL-1.0',
  'OFL-1.1',
  'MMKV',
];

export type OpenSourceComponent = {
  name: string;
  /** 정해진 버전이 없으면 '-' (Android Jetpack 처럼 여러 라이브러리를 묶은 줄) */
  version: string;
  license: LicenseId;
  copyright: string;
};

export type OpenSourceGroup = {
  title: string;
  components: readonly OpenSourceComponent[];
};

export const OPEN_SOURCE_INTRO =
  'Orbit 앱은 아래 오픈소스 소프트웨어를 사용합니다. 각 소프트웨어의 저작권은 표에 적은 저작권자에게 있으며, 라이선스 전문은 이 문서 아래 "라이선스 전문"에서 볼 수 있습니다.';

export const openSourceGroups: readonly OpenSourceGroup[] = [
  {
    title: 'React Native 라이브러리',
    components: [
      {
        name: '@babel/runtime',
        version: '7.29.10',
        license: 'MIT',
        copyright:
          'Copyright (c) 2014-present Sebastian McKenzie and other contributors',
      },
      {
        name: 'base64-js',
        version: '1.5.1',
        license: 'MIT',
        copyright: 'Copyright (c) 2014 Jameson Little',
      },
      {
        name: 'color',
        version: '4.2.3',
        license: 'MIT',
        copyright: 'Copyright (c) 2012 Heather Arthur',
      },
      {
        name: 'color-convert',
        version: '2.0.1',
        license: 'MIT',
        copyright:
          'Copyright (c) 2011-2016 Heather Arthur (fayearthur@gmail.com)',
      },
      {
        name: 'color-name',
        version: '1.1.4',
        license: 'MIT',
        copyright: 'Copyright (c) 2015 Dmitry Ivanov',
      },
      {
        name: 'color-string',
        version: '1.9.1',
        license: 'MIT',
        copyright: 'Copyright (c) 2011 Heather Arthur (fayearthur@gmail.com)',
      },
      {
        name: 'escape-string-regexp',
        version: '4.0.0',
        license: 'MIT',
        copyright:
          'Copyright (c) Sindre Sorhus (sindresorhus@gmail.com) (https://sindresorhus.com)',
      },
      {
        name: 'fast-deep-equal',
        version: '3.1.3',
        license: 'MIT',
        copyright: 'Copyright (c) 2017 Evgeny Poberezkin',
      },
      {
        name: 'invariant',
        version: '2.2.4',
        license: 'MIT',
        copyright: 'Copyright (c) 2013-present, Facebook, Inc.',
      },
      {
        name: '@invertase/react-native-apple-authentication',
        version: '2.5.1',
        license: 'Apache-2.0',
        copyright:
          'Copyright (c) 2016-present Invertase Limited (oss@invertase.io) & Contributors',
      },
      {
        name: 'is-arrayish',
        version: '0.3.4',
        license: 'MIT',
        copyright: 'Copyright (c) 2015 JD Ballard',
      },
      {
        name: 'memoize-one',
        version: '5.2.1',
        license: 'MIT',
        copyright: 'Copyright (c) 2019 Alexander Reardon',
      },
      {
        name: 'metro-runtime',
        version: '0.87.2',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      },
      {
        name: 'nanoid',
        version: '3.3.20',
        license: 'MIT',
        copyright: 'Copyright 2017 Andrey Sitnik (andrey@sitnik.ru)',
      },
      {
        name: 'nullthrows',
        version: '1.1.1',
        license: 'MIT',
        copyright: 'Copyright (c) 2016 Andres Suarez',
      },
      {
        name: 'promise',
        version: '8.3.0',
        license: 'MIT',
        copyright: 'Copyright (c) 2014 Forbes Lindesay',
      },
      {
        name: 'prop-types',
        version: '15.8.1',
        license: 'MIT',
        copyright: 'Copyright (c) 2013-present, Facebook, Inc.',
      },
      {
        name: 'react',
        version: '19.3.0',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      },
      {
        name: 'react-freeze',
        version: '1.0.4',
        license: 'MIT',
        copyright: 'Copyright (c) 2021 Software Mansion',
      },
      {
        name: 'react-is',
        version: '19.3.1',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      },
      {
        name: 'react-native',
        version: '0.88.0',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      },
      {
        name: '@react-native-firebase/app',
        version: '26.4.1',
        license: 'Apache-2.0',
        copyright:
          'Copyright (c) 2016-present Invertase Limited (oss@invertase.io)',
      },
      {
        name: '@react-native-firebase/messaging',
        version: '26.4.1',
        license: 'Apache-2.0',
        copyright:
          'Copyright (c) 2016-present Invertase Limited (oss@invertase.io) & Contributors',
      },
      {
        name: 'react-native-haptic-feedback',
        version: '3.0.0',
        license: 'MIT',
        copyright: 'Copyright (c) 2018 Michael Kuczera',
      },
      {
        name: 'react-native-image-picker',
        version: '8.3.0',
        license: 'MIT',
        copyright: 'Copyright (c) 2015-present, Facebook, Inc.',
      },
      {
        name: 'react-native-keychain',
        version: '10.0.0',
        license: 'MIT',
        copyright: 'Copyright (c) 2015 Joel Arvidsson',
      },
      {
        name: 'react-native-mmkv',
        version: '4.3.2',
        license: 'MIT',
        copyright: 'Copyright (c) 2024 Marc Rousavy',
      },
      {
        name: 'react-native-nitro-image',
        version: '0.15.2',
        license: 'MIT',
        copyright: 'Copyright (c) 2025 Marc Rousavy',
      },
      {
        name: 'react-native-nitro-modules',
        version: '0.37.1',
        license: 'MIT',
        copyright: 'Copyright (c) 2024 Marc Rousavy',
      },
      {
        name: 'react-native-safe-area-context',
        version: '5.10.1',
        license: 'MIT',
        copyright: 'Copyright (c) 2019 Th3rd Wave',
      },
      {
        name: 'react-native-screens',
        version: '4.30.0',
        license: 'MIT',
        copyright: 'Copyright (c) 2018 Software Mansion (swmansion.com)',
      },
      {
        name: '@react-native-seoul/kakao-login',
        version: '6.0.4',
        license: 'MIT',
        copyright: 'Copyright (c) 2018 dooboolab',
      },
      {
        name: 'react-native-svg',
        version: '15.16.0',
        license: 'MIT',
        copyright: 'Copyright (c) [2015-2016] [Horcrux]',
      },
      {
        name: 'react-native-vision-camera',
        version: '5.2.4',
        license: 'MIT',
        copyright: 'Copyright (c) 2025 Marc Rousavy',
      },
      {
        name: 'react-native-vision-camera-barcode-scanner',
        version: '5.2.4',
        license: 'MIT',
        copyright: 'Copyright (c) 2025 Marc Rousavy',
      },
      {
        name: '@react-native/asset-utils',
        version: '0.88.0',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      },
      {
        name: '@react-native/js-polyfills',
        version: '0.88.0',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      },
      {
        name: '@react-native/normalize-colors',
        version: '0.88.0',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      },
      {
        name: '@react-native/virtualized-lists',
        version: '0.88.0',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      },
      {
        name: '@react-navigation/core',
        version: '7.24.0',
        license: 'MIT',
        copyright: 'Copyright (c) 2017 React Navigation Contributors',
      },
      {
        name: '@react-navigation/elements',
        version: '2.9.45',
        license: 'MIT',
        copyright: 'Copyright (c) 2017 React Navigation Contributors',
      },
      {
        name: '@react-navigation/native',
        version: '7.5.1',
        license: 'MIT',
        copyright: 'Copyright (c) 2017 React Navigation Contributors',
      },
      {
        name: '@react-navigation/native-stack',
        version: '7.21.0',
        license: 'MIT',
        copyright: 'Copyright (c) 2017 React Navigation Contributors',
      },
      {
        name: '@react-navigation/routers',
        version: '7.6.5',
        license: 'MIT',
        copyright: 'Copyright (c) 2017 React Navigation Contributors',
      },
      {
        name: 'regenerator-runtime',
        version: '0.13.11',
        license: 'MIT',
        copyright: 'Copyright (c) 2014-present, Facebook, Inc.',
      },
      {
        name: 'scheduler',
        version: '0.28.0',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      },
      {
        name: 'simple-swizzle',
        version: '0.2.4',
        license: 'MIT',
        copyright: 'Copyright (c) 2015 Josh Junon',
      },
      {
        name: 'stacktrace-parser',
        version: '0.1.11',
        license: 'MIT',
        copyright: 'Copyright (c) 2014-2019 Georg Tavonius',
      },
      {
        name: '@tanstack/query-core',
        version: '5.105.3',
        license: 'MIT',
        copyright: 'Copyright (c) 2021-present Tanner Linsley',
      },
      {
        name: '@tanstack/react-query',
        version: '5.105.3',
        license: 'MIT',
        copyright: 'Copyright (c) 2021-present Tanner Linsley',
      },
      {
        name: 'use-latest-callback',
        version: '0.2.6',
        license: 'MIT',
        copyright: 'Copyright (c) 2023 Satyajit Sahoo',
      },
      {
        name: 'use-sync-external-store',
        version: '1.7.0',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      },
      {
        name: 'warn-once',
        version: '0.1.1',
        license: 'MIT',
        copyright: 'Copyright (c) 2022 Satyajit Sahoo',
      },
      {
        name: 'whatwg-fetch',
        version: '3.6.20',
        license: 'MIT',
        copyright: 'Copyright (c) 2014-2023 GitHub, Inc.',
      },
    ],
  },
  {
    title: 'iOS 네이티브',
    components: [
      {
        name: 'Firebase iOS SDK (Core, CoreExtension, CoreInternal, Installations, Messaging)',
        version: '12.19.3',
        license: 'Apache-2.0',
        copyright: 'Google LLC',
      },
      {
        name: 'GoogleUtilities',
        version: '8.1.5',
        license: 'Apache-2.0',
        copyright: 'Google LLC',
      },
      {
        name: 'GoogleDataTransport',
        version: '10.1.1',
        license: 'Apache-2.0',
        copyright: 'Google LLC',
      },
      {
        name: 'Promises (PromisesObjC)',
        version: '2.4.1',
        license: 'Apache-2.0',
        copyright: 'Google LLC',
      },
      {
        name: 'nanopb',
        version: '0.3.9.10',
        license: 'Zlib',
        copyright: 'Copyright (c) 2011 Petteri Aimonen',
      },
      {
        name: 'Kakao SDK for iOS (Common, Auth, User)',
        version: '2.22.7',
        license: 'Apache-2.0',
        copyright: 'Kakao Corp.',
      },
      {
        name: 'Alamofire',
        version: '5.9.1',
        license: 'MIT',
        copyright: 'Copyright (c) 2014-2022 Alamofire Software Foundation',
      },
      {
        name: 'MMKV (MMKVCore)',
        version: '2.4.0',
        license: 'MMKV',
        copyright: 'Copyright (C) 2018 THL A29 Limited, a Tencent company',
      },
      {
        name: 'Hermes',
        version: '0.88.0 (React Native 포함)',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      },
      {
        name: 'Yoga',
        version: '0.88.0 (React Native 포함)',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      },
      {
        name: 'Folly',
        version: '2024.11.18.00',
        license: 'Apache-2.0',
        copyright: 'Meta Platforms, Inc. and affiliates',
      },
      {
        name: 'SocketRocket',
        version: '0.7.1',
        license: 'BSD-3-Clause',
        copyright: 'Copyright (c) 2016-present, Facebook, Inc.',
      },
      {
        name: 'Boost',
        version: '1.84.0',
        license: 'BSL-1.0',
        copyright: 'Boost contributors',
      },
      {
        name: 'double-conversion',
        version: '1.1.6',
        license: 'BSD-3-Clause',
        copyright: 'Copyright 2006-2011, the V8 project authors',
      },
      {
        name: 'fast_float',
        version: '8.0.0',
        license: 'Apache-2.0',
        copyright: 'Copyright 2021 The fast_float authors',
      },
      {
        name: '{fmt}',
        version: '12.1.0',
        license: 'MIT',
        copyright:
          'Copyright (c) 2012 - present, Victor Zverovich and {fmt} contributors',
      },
      {
        name: 'glog',
        version: '0.3.5',
        license: 'BSD-3-Clause',
        copyright: 'Copyright (c) 2008, Google Inc.',
      },
    ],
  },
  {
    title: 'Android 네이티브',
    components: [
      {
        name: 'React Native for Android (react-android), Hermes (hermes-android)',
        version: '0.88.0',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      },
      {
        name: 'fbjni',
        version: '0.7.0',
        license: 'Apache-2.0',
        copyright: 'Meta Platforms, Inc. and affiliates',
      },
      {
        name: 'SoLoader',
        version: '0.12.1',
        license: 'Apache-2.0',
        copyright: 'Meta Platforms, Inc. and affiliates',
      },
      {
        name: 'Fresco',
        version: '3.7.0',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      },
      {
        name: 'OkHttp',
        version: '4.9',
        license: 'Apache-2.0',
        copyright: 'Square, Inc.',
      },
      {
        name: 'Okio',
        version: '2.9',
        license: 'Apache-2.0',
        copyright: 'Square, Inc.',
      },
      {
        name: 'Retrofit',
        version: '2.9.0',
        license: 'Apache-2.0',
        copyright: 'Square, Inc.',
      },
      {
        name: 'Kotlin Serialization Converter for Retrofit',
        version: '1.0.0',
        license: 'Apache-2.0',
        copyright: 'Jake Wharton',
      },
      {
        name: 'Kotlin 표준 라이브러리, kotlinx.serialization',
        version: '2.2.0',
        license: 'Apache-2.0',
        copyright:
          'JetBrains s.r.o. and Kotlin Programming Language contributors',
      },
      {
        name: 'Android Jetpack (AndroidX: appcompat, core, fragment, lifecycle, CameraX, biometric, datastore, browser, constraintlayout, exifinterface 등)',
        version: '-',
        license: 'Apache-2.0',
        copyright: 'The Android Open Source Project',
      },
      {
        name: 'Material Components for Android',
        version: '1.13.0',
        license: 'Apache-2.0',
        copyright: 'Google LLC',
      },
      {
        name: 'Firebase Android SDK (firebase-common, firebase-messaging)',
        version: 'BoM 34.18.0',
        license: 'Apache-2.0',
        copyright: 'Google LLC',
      },
      {
        name: 'Kakao SDK for Android (v2-common, v2-auth, v2-user, v2-network)',
        version: '2.24.0',
        license: 'Apache-2.0',
        copyright: 'Kakao Corp.',
      },
      {
        name: 'MMKV for Android (Tencent MMKV 재배포판)',
        version: '2.4.1',
        license: 'MMKV',
        copyright: 'Copyright (C) 2018 THL A29 Limited, a Tencent company',
      },
      {
        name: 'JSR 305 Annotations',
        version: '3.0.2',
        license: 'Apache-2.0',
        copyright: 'FindBugs',
      },
    ],
  },
  {
    title: '글꼴',
    components: [
      {
        name: 'Pretendard',
        version: '1.3.9',
        license: 'OFL-1.1',
        copyright:
          'Copyright (c) 2021, Kil Hyung-jin, with Reserved Font Name Pretendard',
      },
    ],
  },
];

export { licenseTexts, type LicenseText } from './licenseTexts';
