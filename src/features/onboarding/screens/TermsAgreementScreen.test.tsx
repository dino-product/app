import { render, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';
import {
  ALL_TERMS_TYPES,
  allTermsAgreedWith,
  noTermsAgreed,
  type TermsAgreement,
  type TermsType,
} from '../model';
import { TermsAgreementScreen } from './TermsAgreementScreen';

// 가입 약관 (Figma 3284:22327 빈 / 3278:19869 전체 체크). 동의 상태는 경로가 들고 있고(약관 상세와 함께 쓴다),
// 화면은 그 상태를 그리고 바꾼다. 여기서는 경로처럼 상태를 들고 있는 틀로 그린다 (#193)
async function renderTerms({
  initial = noTermsAgreed,
  submitting = false,
}: { initial?: TermsAgreement; submitting?: boolean } = {}) {
  const props = {
    onBack: jest.fn(),
    onSignUp: jest.fn(),
    onOpenTerms: jest.fn<void, [readonly TermsType[]]>(),
  };
  function Route() {
    const [agreement, setAgreement] = useState(initial);
    return (
      <TermsAgreementScreen
        agreement={agreement}
        onAgreeAll={agreed => setAgreement(allTermsAgreedWith(agreed))}
        submitting={submitting}
        {...props}
      />
    );
  }
  await render(<Route />);
  return props;
}

const rows = [
  '서비스 이용약관 (필수)',
  '개인정보 처리방침 (필수)',
  '제3자 제공 동의 (필수)',
  '위치기반 서비스 이용약관 (필수)',
  '혜택 이벤트 알림 수신동의 (선택)',
] as const;

const row = (name: string) => screen.getByRole('button', { name });
const AGREED = { text: '동의함' };
const NOT_AGREED = { text: '동의 안 함' };
const allAgree = () =>
  screen.getByRole('checkbox', { name: '모든 약관에 동의합니다.' });
const signUp = () => screen.getByRole('button', { name: '가입하기' });

const allAgreed: TermsAgreement = {
  SERVICE: true,
  PRIVACY: true,
  THIRD_PARTY: true,
  LOCATION: true,
  MARKETING: true,
};

describe('TermsAgreementScreen', () => {
  it('제목과 약관 행 다섯 개(필수 4, 선택 1)를 모두 동의하지 않은 채 보여준다', async () => {
    await renderTerms();

    expect(
      screen.getByRole('header', {
        name: '서비스 이용을 위해 동의가 필요해요',
      }),
    ).toBeOnTheScreen();
    expect(allAgree()).not.toBeChecked();
    for (const name of rows) {
      expect(row(name)).toHaveAccessibilityValue(NOT_AGREED);
    }
    expect(signUp()).toBeDisabled();
  });

  it("'서비스 이용약관 (필수)' 등 항목을 누르면 동의하지 않은 채로 그 약관 상세를 연다", async () => {
    const { onOpenTerms } = await renderTerms();

    await userEvent.press(row('서비스 이용약관 (필수)'));

    expect(onOpenTerms).toHaveBeenCalledWith(['SERVICE']);
    expect(row('서비스 이용약관 (필수)')).toHaveAccessibilityValue(NOT_AGREED);
    expect(signUp()).toBeDisabled();

    await userEvent.press(row('혜택 이벤트 알림 수신동의 (선택)'));
    expect(onOpenTerms).toHaveBeenLastCalledWith(['MARKETING']);
  });

  it("'모든 약관에 동의합니다'를 누르면 모든 약관을 동의한 채로 모든 약관 상세를 연다", async () => {
    const { onOpenTerms } = await renderTerms();

    await userEvent.press(allAgree());

    // 상세에서 모두 동의된 채로 보이는 것은 App.onboarding.test 가 본다
    expect(onOpenTerms).toHaveBeenCalledTimes(1);
    expect(onOpenTerms).toHaveBeenCalledWith(ALL_TERMS_TYPES);
    for (const name of rows) {
      expect(row(name)).toHaveAccessibilityValue(AGREED);
    }
    expect(allAgree()).toBeChecked();
    expect(signUp()).toBeEnabled();
  });

  it('모두 동의한 채 모든 약관에 동의합니다를 누르면 모두 끄고 상세는 열지 않는다', async () => {
    const { onOpenTerms } = await renderTerms({ initial: allAgreed });

    await userEvent.press(allAgree());

    for (const name of rows) {
      expect(row(name)).toHaveAccessibilityValue(NOT_AGREED);
    }
    expect(onOpenTerms).not.toHaveBeenCalled();
    expect(signUp()).toBeDisabled();
  });

  it('(필수) 약관 중 하나라도 동의하지 않으면 가입하기가 비활성이다', async () => {
    await renderTerms({ initial: { ...allAgreed, LOCATION: false } });

    expect(row('위치기반 서비스 이용약관 (필수)')).toHaveAccessibilityValue(
      NOT_AGREED,
    );
    expect(allAgree()).not.toBeChecked();
    expect(signUp()).toBeDisabled();
  });

  it('(필수) 넷에 동의하면 선택이 꺼져 있어도 가입하기가 켜지고, 누르면 동의한 약관을 넘긴다', async () => {
    const agreement = { ...allAgreed, MARKETING: false };
    const { onSignUp } = await renderTerms({ initial: agreement });

    expect(signUp()).toBeEnabled();
    await userEvent.press(signUp());

    expect(onSignUp).toHaveBeenCalledWith(agreement);
  });

  it('서버에 동의를 보내는 동안에는 가입하기가 꺼져 있다 (#113)', async () => {
    await renderTerms({ initial: allAgreed, submitting: true });

    expect(signUp()).toBeDisabled();
  });

  it('뒤로 가기를 누르면 알린다', async () => {
    const { onBack } = await renderTerms();

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onBack).toHaveBeenCalled();
  });
});
