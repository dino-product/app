import { render, screen, userEvent } from '@testing-library/react-native';
import { TermsScreen, type TermsLinks } from './TermsScreen';

const noLinks: TermsLinks = { openSource: '' };

const renderTerms = ({
  links = noLinks,
  onOpenLink = jest.fn(),
  onOpenTerms = jest.fn(),
}: {
  links?: TermsLinks;
  onOpenLink?: jest.Mock;
  onOpenTerms?: jest.Mock;
} = {}) =>
  render(
    <TermsScreen
      links={links}
      appVersion="1.0"
      onOpenLink={onOpenLink}
      onOpenTerms={onOpenTerms}
      onBack={jest.fn()}
    />,
  );

describe('TermsScreen', () => {
  it('약관 행 세 개와 앱 버전을 보여준다', async () => {
    await renderTerms();

    expect(
      screen.getByRole('header', { name: '약관 및 앱 정보' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: '약관 및 정책' }),
    ).toBeOnTheScreen();
    for (const name of [
      '서비스 이용약관',
      '개인정보 처리방침',
      '오픈소스 라이선스',
    ]) {
      expect(screen.getByRole('button', { name })).toBeOnTheScreen();
    }
    expect(screen.getByRole('header', { name: '앱 정보' })).toBeOnTheScreen();
    expect(screen.getByText('현재 버전 1.0')).toBeOnTheScreen();
    expect(screen.getByText('최신 버전')).toBeOnTheScreen();
  });

  // 서비스 이용약관·개인정보 처리방침은 원격 전문을 앱 안 약관 상세로 연다 (#192)
  it.each([
    ['서비스 이용약관', 'service'],
    ['개인정보 처리방침', 'privacy'],
  ])('%s 를 누르면 그 약관 상세를 연다', async (name, terms) => {
    const onOpenTerms = jest.fn();
    await renderTerms({ onOpenTerms });

    await userEvent.press(screen.getByRole('button', { name }));

    expect(onOpenTerms).toHaveBeenCalledWith(terms);
  });

  it('오픈소스 라이선스는 주소가 아직 없으면 비활성이다', async () => {
    await renderTerms();

    expect(
      screen.getByRole('button', { name: '오픈소스 라이선스' }),
    ).toBeDisabled();
  });

  it('오픈소스 라이선스 주소가 있으면 누를 때 그 주소를 연다', async () => {
    const onOpenLink = jest.fn();
    await renderTerms({
      links: { openSource: 'https://example.com/oss' },
      onOpenLink,
    });

    await userEvent.press(
      screen.getByRole('button', { name: '오픈소스 라이선스' }),
    );

    expect(onOpenLink).toHaveBeenCalledWith('https://example.com/oss');
  });
});
