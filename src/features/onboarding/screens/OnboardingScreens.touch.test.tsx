import {
  act,
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { NativeModules } from 'react-native';
import {
  expectIconButtonTouchTarget,
  expectMinTouchTarget,
} from '../../../shared/testing/touchTarget';
import { LoginScreen } from './LoginScreen';
import { TermsAgreementScreen } from './TermsAgreementScreen';

// 새 버튼·체크박스의 터치 영역 (iOS 44pt, Android 48dp). 보이는 크기는 Figma 그대로 두고 hitSlop 으로 넓힌다
describe('온보딩 터치 영역', () => {
  it('로그인 시작 버튼은 높이 56 이라 그대로 충분하다', async () => {
    await render(
      <LoginScreen
        methods={['KAKAO', 'APPLE']}
        recentMethod={null}
        onLogin={jest.fn()}
      />,
    );

    for (const name of ['카카오로 시작하기', 'Apple로 시작하기']) {
      expectMinTouchTarget(screen.getByRole('button', { name }), {
        height: 56,
      });
    }
  });

  describe('약관 동의', () => {
    beforeEach(() => {
      // 바텀시트 애니메이션은 바로 끝낸다
      jest
        .spyOn(NativeModules.NativeAnimatedModule, 'startAnimatingNode')
        .mockImplementation((...args: unknown[]) =>
          (args[3] as (result: { finished: boolean }) => void)({
            finished: true,
          }),
        );
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const renderTerms = () =>
      render(<TermsAgreementScreen onBack={jest.fn()} onSignUp={jest.fn()} />);

    // 상자(22)·체크 표시(24)가 글자 줄보다 높아 보이는 높이가 된다
    it('전체 동의 체크박스는 상자 22 를 위아래로 넓힌다', async () => {
      await renderTerms();

      expectMinTouchTarget(
        screen.getByRole('checkbox', { name: '모든 약관에 동의합니다.' }),
        { height: 22 },
      );
    });

    it('약관 행의 체크는 체크 표시 24 를 위아래로 넓히고, > 는 아이콘 버튼 기준을 따른다', async () => {
      await renderTerms();

      for (const checkbox of screen
        .getAllByRole('checkbox')
        .filter(item => item.props.accessibilityLabel !== undefined)) {
        expectMinTouchTarget(checkbox, { height: 24 });
      }
      for (const more of screen.getAllByRole('button', { name: / 보기$/ })) {
        expectIconButtonTouchTarget(more);
      }
    });

    it('약관 시트의 체크박스도 같은 기준이다', async () => {
      await renderTerms();
      await userEvent.press(
        screen.getByRole('button', { name: '서비스 이용약관 (필수) 보기' }),
      );
      await act(async () => {});
      const sheet = within(screen.getByTestId('terms-sheet'));

      expectMinTouchTarget(sheet.getByRole('checkbox', { name: '전체 동의' }), {
        height: 22,
      });
      expectMinTouchTarget(
        sheet.getByRole('checkbox', { name: '서비스 이용약관 동의 (필수)' }),
        { height: 24 },
      );
    });
  });
});
