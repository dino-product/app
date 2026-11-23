import { render, screen, userEvent } from '@testing-library/react-native';
import {
  licenseTexts,
  OPEN_SOURCE_INTRO,
  openSourceGroups,
} from '../licenses/openSourceNotices';
import {
  licenseSections,
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
