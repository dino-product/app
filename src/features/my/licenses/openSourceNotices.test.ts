import {
  LICENSE_IDS,
  licenseTexts,
  OPEN_SOURCE_INTRO,
  openSourceGroups,
} from './openSourceNotices';

// 마이 › 약관 및 앱 정보 › 오픈소스 라이선스 (#232). 사용자가 준 고지 문서(이름·버전·라이선스·저작권 표와 라이선스 전문)를 앱에 싣는다
describe('오픈소스 고지', () => {
  it('안내 문장은 고지 문서 그대로다', () => {
    expect(OPEN_SOURCE_INTRO).toBe(
      'Orbit 앱은 아래 오픈소스 소프트웨어를 사용합니다. 각 소프트웨어의 저작권은 표에 적은 저작권자에게 있으며, 라이선스 전문은 이 문서 아래 "라이선스 전문"에서 볼 수 있습니다.',
    );
  });

  it('React Native 라이브러리 54 · iOS 네이티브 17 · Android 네이티브 15 · 글꼴 1 순서다', () => {
    expect(
      openSourceGroups.map(group => [group.title, group.components.length]),
    ).toEqual([
      ['React Native 라이브러리', 54],
      ['iOS 네이티브', 17],
      ['Android 네이티브', 15],
      ['글꼴', 1],
    ]);
  });

  it.each([
    [
      'React Native 라이브러리',
      {
        name: '@babel/runtime',
        version: '7.29.10',
        license: 'MIT',
        copyright:
          'Copyright (c) 2014-present Sebastian McKenzie and other contributors',
      },
    ],
    [
      'React Native 라이브러리',
      {
        name: 'react-native',
        version: '0.88.0',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
      },
    ],
    [
      'iOS 네이티브',
      {
        name: 'MMKV (MMKVCore)',
        version: '2.4.0',
        license: 'MMKV',
        copyright: 'Copyright (C) 2018 THL A29 Limited, a Tencent company',
      },
    ],
    [
      'Android 네이티브',
      {
        name: 'Android Jetpack (AndroidX: appcompat, core, fragment, lifecycle, CameraX, biometric, datastore, browser, constraintlayout, exifinterface 등)',
        version: '-',
        license: 'Apache-2.0',
        copyright: 'The Android Open Source Project',
      },
    ],
    [
      '글꼴',
      {
        name: 'Pretendard',
        version: '1.3.9',
        license: 'OFL-1.1',
        copyright:
          'Copyright (c) 2021, Kil Hyung-jin, with Reserved Font Name Pretendard',
      },
    ],
  ])('%s 에 %o 가 있다', (title, component) => {
    const group = openSourceGroups.find(item => item.title === title);

    expect(group?.components).toContainEqual(component);
  });

  // 목록 행 key 가 묶음 안 이름·버전이라 겹치면 안 된다
  it('묶음 안에서 이름·버전이 겹치지 않는다', () => {
    for (const group of openSourceGroups) {
      const keys = group.components.map(
        component => `${component.name}@${component.version}`,
      );
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('라이선스 전문은 MIT · Apache 2.0 · BSD 3-Clause · zlib · BSL 1.0 · OFL 1.1 · MMKV 순서다', () => {
    expect(licenseTexts.map(text => [text.id, text.title])).toEqual([
      ['MIT', 'MIT License'],
      ['Apache-2.0', 'Apache License 2.0'],
      ['BSD-3-Clause', 'BSD 3-Clause License'],
      ['Zlib', 'zlib License'],
      ['BSL-1.0', 'Boost Software License 1.0'],
      ['OFL-1.1', 'SIL Open Font License 1.1'],
      ['MMKV', 'MMKV License'],
    ]);
    expect(licenseTexts.map(text => text.id)).toEqual(LICENSE_IDS);
  });

  it('표에 쓴 라이선스마다 전문이 있고, 쓰지 않는 전문은 없다', () => {
    const used = new Set(
      openSourceGroups.flatMap(group =>
        group.components.map(component => component.license),
      ),
    );

    expect([...used].sort()).toEqual([...LICENSE_IDS].sort());
    for (const text of licenseTexts) {
      expect(text.paragraphs.length).toBeGreaterThan(0);
      for (const paragraph of text.paragraphs) {
        expect(paragraph.trim()).not.toBe('');
      }
    }
  });

  // 전문 원문의 첫 문장으로 그 라이선스 전문인지 본다
  it.each([
    ['MIT', 'Permission is hereby granted, free of charge'],
    [
      'Apache-2.0',
      'TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION',
    ],
    ['BSD-3-Clause', 'Neither the name of the copyright holder'],
    ['Zlib', "This software is provided 'as-is'"],
    ['BSL-1.0', 'Boost Software License - Version 1.0 - August 17th, 2003'],
    ['OFL-1.1', 'Version 1.1 - 26 February 2007'],
    ['MMKV', 'Tencent is pleased to support the open source community'],
  ])('%s 전문은 원문이다 (%s)', (id, phrase) => {
    const text = licenseTexts.find(item => item.id === id);

    expect(text?.paragraphs.join('\n')).toContain(phrase);
  });

  // MMKV 라이선스는 BSD 3-Clause 에 OpenSSL·SSLeay 라이선스가 붙어 있어 이 두 문구가 게시본에 반드시 있어야 한다.
  // 전문 안 조건 글에만 두지 않고 MMKV 전문 맨 앞에 고지로 따로 싣는다
  it('MMKV 전문 맨 앞에 OpenSSL·Eric Young 고지 문구를 따로 싣는다', () => {
    const mmkv = licenseTexts.find(item => item.id === 'MMKV');

    expect(mmkv?.paragraphs.slice(0, 2)).toEqual([
      'This product includes software developed by the OpenSSL Project for use in the OpenSSL Toolkit (http://www.openssl.org/)',
      'This product includes cryptographic software written by Eric Young (eay@cryptsoft.com)',
    ]);
  });
});
