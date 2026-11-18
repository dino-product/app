import { act, renderHook } from '@testing-library/react-native';
import { noTermsAgreed } from './model';
import { useTermsAgreementState } from './termsAgreementState';

// 가입 약관 동의 상태 (#193). 가입 약관 화면과 약관 상세가 함께 쓴다.
// 약관 개정으로 다시 동의하는 계정은 서버에 남은 마케팅(선택) 동의로 시작한다 (#113).
// 서버 값이 늦게 오면 사용자가 마케팅을 고르지 않았을 때만 따른다 (고른 값과 같아도 고른 것이다)
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

  it('약관 하나를 고르면 그 약관만 바뀐다', async () => {
    const { result } = await renderState();

    await act(() => result.current.choose('SERVICE', true));

    expect(result.current.agreement).toEqual({
      ...noTermsAgreed,
      SERVICE: true,
    });
  });

  it('모두 동의·모두 끄기', async () => {
    const { result } = await renderState();

    await act(() => result.current.agreeAll(true));
    expect(Object.values(result.current.agreement)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);

    await act(() => result.current.agreeAll(false));
    expect(result.current.agreement).toEqual(noTermsAgreed);
  });

  it('마케팅을 고르지 않았으면 늦게 온 서버 값을 따른다 (다른 약관만 골랐어도)', async () => {
    const { result, rerender } = await renderState(undefined);
    await act(() => result.current.choose('SERVICE', true));

    await rerender({ marketing: true });

    expect(result.current.agreement).toEqual({
      ...noTermsAgreed,
      SERVICE: true,
      MARKETING: true,
    });
  });

  it("상세에서 마케팅 '동의하지 않습니다'를 고른 뒤 서버 값(true)이 늦게 와도 고른 값(false)을 둔다", async () => {
    const { result, rerender } = await renderState(undefined);
    // 지금 값(false)과 같아도 사용자가 고른 것이다
    await act(() => result.current.choose('MARKETING', false));

    await rerender({ marketing: true });

    expect(result.current.agreement.MARKETING).toBe(false);
  });

  it('모두 동의했다 모두 끈 뒤 서버 값(true)이 늦게 와도 끈 채다', async () => {
    const { result, rerender } = await renderState(undefined);
    await act(() => result.current.agreeAll(true));
    await act(() => result.current.agreeAll(false));

    await rerender({ marketing: true });

    expect(result.current.agreement).toEqual(noTermsAgreed);
  });
});
