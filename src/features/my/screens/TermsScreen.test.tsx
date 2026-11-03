import { render, screen, userEvent } from '@testing-library/react-native';
import { TermsScreen, type TermsLinks } from './TermsScreen';

const noLinks: TermsLinks = { terms: '', privacy: '', openSource: '' };

const renderTerms = (links: TermsLinks = noLinks, onOpenLink = jest.fn()) =>
  render(
    <TermsScreen
      links={links}
      appVersion="1.0"
      onOpenLink={onOpenLink}
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

  it('주소가 아직 없는 약관은 비활성이다', async () => {
    await renderTerms();

    expect(
      screen.getByRole('button', { name: '서비스 이용약관' }),
    ).toBeDisabled();
  });

  it('주소가 있으면 누를 때 그 주소를 연다', async () => {
    const onOpenLink = jest.fn();
    await renderTerms(
      { ...noLinks, privacy: 'https://example.com/privacy' },
      onOpenLink,
    );

    await userEvent.press(
      screen.getByRole('button', { name: '개인정보 처리방침' }),
    );

    expect(onOpenLink).toHaveBeenCalledWith('https://example.com/privacy');
  });
});
