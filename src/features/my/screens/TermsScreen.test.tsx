import { render, screen, userEvent } from '@testing-library/react-native';
import { TermsScreen } from './TermsScreen';

const renderTerms = ({
  onOpenTerms = jest.fn(),
  onOpenLicenses = jest.fn(),
}: {
  onOpenTerms?: jest.Mock;
  onOpenLicenses?: jest.Mock;
} = {}) =>
  render(
    <TermsScreen
      appVersion="1.0"
      onOpenTerms={onOpenTerms}
      onOpenLicenses={onOpenLicenses}
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

  // 앱에 싣는 고지 문서를 앱 안 화면으로 연다 (#232)
  it('오픈소스 라이선스는 켜져 있고, 누르면 오픈소스 라이선스 화면을 연다', async () => {
    const onOpenLicenses = jest.fn();
    await renderTerms({ onOpenLicenses });

    const row = screen.getByRole('button', { name: '오픈소스 라이선스' });
    expect(row).toBeEnabled();
    await userEvent.press(row);

    expect(onOpenLicenses).toHaveBeenCalledTimes(1);
  });
});
