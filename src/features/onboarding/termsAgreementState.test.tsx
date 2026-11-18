import { act, renderHook } from '@testing-library/react-native';
import { noTermsAgreed } from './model';
import { useTermsAgreementState } from './termsAgreementState';

// 가입 약관 동의 상태 (#193). 가입 약관 화면과 약관 상세가 함께 쓴다.
// 약관 개정으로 다시 동의하는 계정은 서버에 남은 마케팅(선택) 동의로 시작한다 (#113)
const renderState = (initialMarketing?: boolean) =>
  renderHook(
    ({ marketing }: { marketing?: boolean }) =>
      useTermsAgreementState(marketing),
    { initialProps: { marketing: initialMarketing } },
  );

describe('useTermsAgreementState', () => {
  it('처음에는 모두 동의하지 않은 상태다', async () => {
    const { result } = await renderState();

    expect(result.current.agreement).toEqual(noTermsAgreed);
  });

  it('서버의 마케팅 동의로 선택 약관을 미리 켠다', async () => {
    const { result } = await renderState(true);

    expect(result.current.agreement).toEqual({
      ...noTermsAgreed,
      MARKETING: true,
    });
  });

  it('마케팅 동의 값이 늦게 오면 선택 약관을 건드리지 않았을 때만 반영한다', async () => {
    const { result, rerender } = await renderState(undefined);

    await rerender({ marketing: true });
    expect(result.current.agreement.MARKETING).toBe(true);

    await act(() =>
      result.current.setAgreement(current => ({
        ...current,
        MARKETING: false,
      })),
    );
    await rerender({ marketing: true });
    expect(result.current.agreement.MARKETING).toBe(false);
  });
});
