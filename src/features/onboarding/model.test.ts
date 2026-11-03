import {
  allTermsAgreed,
  canRegisterProfile,
  canSignUp,
  completeOnboarding,
  initialAuthState,
  isRegistered,
  loginMethodsFor,
  noTermsAgreed,
  signedInAuth,
  signIn,
  signOut,
  termsList,
  toggleAllTerms,
  toggleTerm,
  withdraw,
  type AuthState,
  type TermsAgreement,
} from './model';

describe('canRegisterProfile', () => {
  // 서버(SaveProfileRequest)와 같은 규칙: 이름 2~20자 한글·영문, 연락처 010 으로 시작하는 11자리
  it.each([
    ['박기사', '010-1234-5678'],
    ['Kim', '01012345678'],
    [' 박기사 ', '010-1234-5678'],
    ['가'.repeat(20), '010-1234-5678'],
  ])('%s, %s 는 등록할 수 있다', (name, phoneNumber) => {
    expect(canRegisterProfile({ name, phoneNumber })).toBe(true);
  });

  it.each([
    ['', '010-1234-5678'],
    ['박', '010-1234-5678'],
    ['가'.repeat(21), '010-1234-5678'],
    ['박기사1', '010-1234-5678'],
    ['박기사', ''],
    ['박기사', '010-1234-567'],
    ['박기사', '011-1234-5678'],
  ])('%s, %s 는 등록할 수 없다', (name, phoneNumber) => {
    expect(canRegisterProfile({ name, phoneNumber })).toBe(false);
  });
});

describe('약관', () => {
  it('Figma 대로 필수 4개, 선택 1개다', () => {
    expect(termsList.map(terms => [terms.title, terms.required])).toEqual([
      ['서비스 이용약관', true],
      ['개인정보 처리방침', true],
      ['제3자 제공 동의', true],
      ['위치기반 서비스 이용약관', true],
      ['혜택 이벤트 알림 수신동의', false],
    ]);
  });

  const agreeing = (...types: (keyof TermsAgreement)[]): TermsAgreement =>
    types.reduce(
      (agreement, type) => toggleTerm(agreement, type),
      noTermsAgreed,
    );

  it('필수 네 개에 모두 동의하면 가입할 수 있다. 선택은 꺼져 있어도 된다', () => {
    const required = agreeing('SERVICE', 'PRIVACY', 'THIRD_PARTY', 'LOCATION');

    expect(canSignUp(required)).toBe(true);
    expect(allTermsAgreed(required)).toBe(false);
  });

  it('필수 하나라도 빠지면 가입할 수 없다', () => {
    expect(canSignUp(noTermsAgreed)).toBe(false);
    expect(canSignUp(agreeing('SERVICE', 'PRIVACY', 'THIRD_PARTY'))).toBe(
      false,
    );
    expect(canSignUp(agreeing('PRIVACY', 'THIRD_PARTY', 'LOCATION'))).toBe(
      false,
    );
  });

  it('하나를 누르면 그것만 켜지고, 다시 누르면 꺼진다', () => {
    const once = toggleTerm(noTermsAgreed, 'MARKETING');
    expect(once).toEqual({ ...noTermsAgreed, MARKETING: true });
    expect(toggleTerm(once, 'MARKETING')).toEqual(noTermsAgreed);
  });

  it('전체 동의는 하나라도 꺼져 있으면 모두 켜고, 모두 켜져 있으면 모두 끈다', () => {
    const all = toggleAllTerms(agreeing('SERVICE'));

    expect(allTermsAgreed(all)).toBe(true);
    expect(canSignUp(all)).toBe(true);
    expect(toggleAllTerms(all)).toEqual(noTermsAgreed);
  });
});

describe('loginMethodsFor', () => {
  // Apple 로그인은 Apple 기기에서만 보인다 (프로젝트 결정)
  it('iOS 는 카카오와 Apple, Android 는 카카오만', () => {
    expect(loginMethodsFor('ios')).toEqual(['KAKAO', 'APPLE']);
    expect(loginMethodsFor('android')).toEqual(['KAKAO']);
  });
});

describe('더미 로그인', () => {
  it('처음에는 로그아웃 상태이고 가입한 계정도, 최근 로그인도 없다', () => {
    expect(initialAuthState).toEqual({
      signedIn: null,
      registered: [],
      lastMethod: null,
    });
  });

  it('온보딩을 마치기 전에는 신규 사용자다', () => {
    expect(isRegistered(initialAuthState, 'KAKAO')).toBe(false);
  });

  it('온보딩을 마치면 그 방식의 계정이 생기고 로그인 상태가 된다', () => {
    const state = completeOnboarding(initialAuthState, 'KAKAO');

    expect(state).toEqual({
      signedIn: 'KAKAO',
      registered: ['KAKAO'],
      lastMethod: 'KAKAO',
    });
    expect(isRegistered(state, 'KAKAO')).toBe(true);
    // 카카오와 Apple 은 다른 계정이다 (서버도 /auth/kakao, /auth/apple 로 따로 받는다)
    expect(isRegistered(state, 'APPLE')).toBe(false);
  });

  it('로그아웃하면 계정과 마지막 로그인 방식은 남는다', () => {
    const state = signOut(completeOnboarding(initialAuthState, 'APPLE'));

    expect(state).toEqual({
      signedIn: null,
      registered: ['APPLE'],
      lastMethod: 'APPLE',
    });
  });

  it('가입한 계정으로 다시 로그인하면 바로 로그인 상태가 되고 마지막 방식이 바뀐다', () => {
    const both: AuthState = {
      signedIn: null,
      registered: ['KAKAO', 'APPLE'],
      lastMethod: 'APPLE',
    };

    expect(signIn(both, 'KAKAO')).toEqual({
      ...both,
      signedIn: 'KAKAO',
      lastMethod: 'KAKAO',
    });
  });

  it('탈퇴하면 그 계정이 사라져 다시 신규 사용자가 되고, 최근 로그인도 지운다', () => {
    const state = withdraw(completeOnboarding(initialAuthState, 'KAKAO'));

    expect(state).toEqual(initialAuthState);
    expect(isRegistered(state, 'KAKAO')).toBe(false);
  });

  it('테스트는 온보딩을 마친 계정으로 로그인한 상태에서 시작할 수 있다', () => {
    expect(signedInAuth()).toEqual({
      signedIn: 'KAKAO',
      registered: ['KAKAO'],
      lastMethod: 'KAKAO',
    });
    expect(signedInAuth('APPLE').signedIn).toBe('APPLE');
  });
});
