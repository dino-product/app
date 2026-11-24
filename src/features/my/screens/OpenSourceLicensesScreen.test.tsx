import { render, screen, userEvent } from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import {
  licenseTexts,
  OPEN_SOURCE_INTRO,
  openSourceGroups,
} from '../licenses/openSourceNotices';
import {
  ComponentRow,
  licenseSections,
  LicenseSectionHeader,
  OpenSourceLicensesScreen,
} from './OpenSourceLicensesScreen';

const renderScreen = (onBack = jest.fn()) =>
  render(<OpenSourceLicensesScreen onBack={onBack} />);

// 마이 › 약관 및 앱 정보 › 오픈소스 라이선스 (#232)
describe('OpenSourceLicensesScreen', () => {
  it('머리 제목, 안내 문장, 첫 묶음과 그 첫 항목(이름·버전·라이선스·저작권)을 보인다', async () => {
    await renderScreen();

    expect(
      screen.getByRole('header', { name: '오픈소스 라이선스' }),
    ).toBeOnTheScreen();
    expect(screen.getByText(OPEN_SOURCE_INTRO)).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'React Native 라이브러리' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('@babel/runtime')).toBeOnTheScreen();
    expect(screen.getByText('7.29.10 · MIT')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Copyright (c) 2014-present Sebastian McKenzie and other contributors',
      ),
    ).toBeOnTheScreen();
  });

  it('뒤로 가기를 누르면 돌아간다', async () => {
    const onBack = jest.fn();
    await renderScreen(onBack);

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// 목록은 가상화돼 테스트 첫 창에 뒷부분(전문)이 다 그려지지 않는다. 행·머리는 따로 그려 본다
describe('표 항목', () => {
  const jetpack = {
    name: 'Android Jetpack (AndroidX)',
    version: '-',
    license: 'Apache-2.0',
    copyright: 'The Android Open Source Project',
  } as const;

  it('스크린리더는 항목 하나를 이름·버전·라이선스·저작권 한 덩어리로 읽는다', async () => {
    await render(
      <ComponentRow
        component={{
          name: 'react',
          version: '19.3.0',
          license: 'MIT',
          copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
        }}
      />,
    );

    expect(
      screen.getByLabelText(
        'react, 19.3.0 · MIT, Copyright (c) Meta Platforms, Inc. and affiliates.',
      ),
    ).toBeOnTheScreen();
  });

  it("정해진 버전이 없으면('-') 라이선스만 보인다", async () => {
    await render(<ComponentRow component={jetpack} />);

    expect(screen.getByText('Apache-2.0')).toBeOnTheScreen();
    expect(screen.queryByText(/^- ·/)).not.toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Android Jetpack (AndroidX), Apache-2.0, The Android Open Source Project',
      ),
    ).toBeOnTheScreen();
  });

  // 법적 고지라 흰 바탕에서 WCAG AA(4.5:1)를 넘는 Gray600(#767676) 이상으로 쓴다
  it('저작권 줄은 Gray600 이다', async () => {
    await render(<ComponentRow component={jetpack} />);

    expect(screen.getByText('The Android Open Source Project')).toHaveStyle({
      color: colors.gray[600],
    });
  });
});

describe('목록 머리', () => {
  it.each([
    ['group', 'React Native 라이브러리'],
    ['lead', '라이선스 전문'],
    ['license', 'MIT License'],
  ] as const)('%s 머리 %s 는 스크린리더 제목이다', async (kind, title) => {
    await render(<LicenseSectionHeader kind={kind} title={title} />);

    expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
  });
});

// 목록은 길이가 가변이라 SectionList 로 그린다 (docs/performance.md). 화면에 다 그려지지 않는 뒷부분은 목록 자료로 본다
describe('licenseSections — 목록 구성', () => {
  it('네 묶음 표, 그 뒤 "라이선스 전문" 제목, 라이선스 일곱 전문 차례다', () => {
    expect(
      licenseSections.map(section => [section.kind, section.title]),
    ).toEqual([
      ...openSourceGroups.map(group => ['group', group.title]),
      ['lead', '라이선스 전문'],
      ...licenseTexts.map(text => ['license', text.title]),
    ]);
  });

  it('묶음은 그 항목들을, 전문은 그 문단들을 담는다. 제목 줄만 있는 자리는 비어 있다', () => {
    const byTitle = (title: string) =>
      licenseSections.find(section => section.title === title)?.data;

    for (const group of openSourceGroups) {
      expect(byTitle(group.title)).toEqual(
        group.components.map(component => ({ kind: 'component', component })),
      );
    }
    expect(byTitle('라이선스 전문')).toEqual([]);
    for (const text of licenseTexts) {
      expect(byTitle(text.title)).toEqual(
        text.paragraphs.map(paragraph => ({
          kind: 'paragraph',
          text: paragraph,
        })),
      );
    }
  });
});
