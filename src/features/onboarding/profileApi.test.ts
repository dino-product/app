import { ApiErrorMessage, isApiError } from '../../shared/api';
import { createFakeServer, fail, ok } from '../../shared/testing/fakeServer';
import { createTestApi } from '../../shared/testing/renderWithApi';
import { testSession } from '../../shared/testing/session';
import { noTermsAgreed, toggleAllTerms, toggleTerm } from './model';
import {
  agreeToTerms,
  currentAccountId,
  fetchProfile,
  parseProfile,
  profilePath,
  profileQuery,
  profileQueryKey,
  saveProfile,
  toTermsAgreementRequest,
} from './profileApi';

const PATH = '/api/v1/profiles/7';

// 백엔드 ProfileResponse 그대로 (api-spec §2.2)
const pendingProfile = {
  accountId: 7,
  status: 'PENDING_SIGNUP',
  nextStep: 'TERMS',
  name: '홍길동',
  phoneNumber: '01012345678',
  signedUpAt: null,
  marketingAgreed: null,
};

describe('parseProfile', () => {
  it('ProfileResponse 를 그대로 옮긴다', () => {
    expect(parseProfile(pendingProfile)).toEqual(pendingProfile);
  });

  it('프로필 입력 전 계정은 이름·연락처가 null 이다', () => {
    expect(
      parseProfile({
        ...pendingProfile,
        nextStep: 'PROFILE',
        name: null,
        phoneNumber: null,
      }),
    ).toMatchObject({ nextStep: 'PROFILE', name: null, phoneNumber: null });
  });

  it('값이 없는 필드의 키가 빠져 와도 null 로 받는다', () => {
    expect(
      parseProfile({
        accountId: 7,
        status: 'PENDING_SIGNUP',
        nextStep: 'PROFILE',
      }),
    ).toEqual({
      accountId: 7,
      status: 'PENDING_SIGNUP',
      nextStep: 'PROFILE',
      name: null,
      phoneNumber: null,
      signedUpAt: null,
      marketingAgreed: null,
    });
  });

  it('가입을 마친 계정은 가입 시각과 마케팅 동의가 있다', () => {
    expect(
      parseProfile({
        ...pendingProfile,
        status: 'ACTIVE',
        nextStep: 'COMPLETED',
        signedUpAt: '2026-10-21T00:00:00Z',
        marketingAgreed: false,
      }),
    ).toMatchObject({
      status: 'ACTIVE',
      nextStep: 'COMPLETED',
      signedUpAt: '2026-10-21T00:00:00Z',
      marketingAgreed: false,
    });
  });

  it.each([
    ['nextStep 이 모르는 값', { ...pendingProfile, nextStep: 'DONE' }],
    ['status 가 모르는 값', { ...pendingProfile, status: 'WITHDRAWN' }],
    ['accountId 가 숫자가 아님', { ...pendingProfile, accountId: '7' }],
    ['이름이 숫자', { ...pendingProfile, name: 1 }],
    ['마케팅 동의가 문자열', { ...pendingProfile, marketingAgreed: 'Y' }],
    ['객체가 아님', null],
  ])('%s 이면 서버 응답 오류로 던진다', (_, value) => {
    let thrown: unknown;
    try {
      parseProfile(value);
    } catch (error) {
      thrown = error;
    }
    expect(isApiError(thrown)).toBe(true);
    expect((thrown as Error).message).toBe(ApiErrorMessage.invalidResponse);
  });
});

describe('toTermsAgreementRequest', () => {
  it('서비스·개인정보·마케팅만 서버 항목으로 보낸다 (제3자 제공·위치기반은 서버에 없다)', () => {
    expect(toTermsAgreementRequest(toggleAllTerms(noTermsAgreed))).toEqual({
      serviceTerms: true,
      privacyPolicy: true,
      marketing: true,
    });
  });

  it('선택 약관을 끄면 marketing 은 false 다', () => {
    const required = ['SERVICE', 'PRIVACY', 'THIRD_PARTY', 'LOCATION'] as const;
    const agreement = required.reduce(toggleTerm, noTermsAgreed);

    expect(toTermsAgreementRequest(agreement)).toEqual({
      serviceTerms: true,
      privacyPolicy: true,
      marketing: false,
    });
  });
});

describe('프로필 API', () => {
  const signedIn = () => testSession({ accountId: 7 });

  it('본인 accountId 는 기기 세션에서 읽는다', async () => {
    const { client } = createTestApi({ session: signedIn() });

    await expect(currentAccountId(client)).resolves.toBe(7);
  });

  it('세션이 없으면 accountId 를 읽지 못하고 던진다', async () => {
    const { client } = createTestApi();

    await expect(currentAccountId(client)).rejects.toThrow();
  });

  it('경로는 본인 accountId 로 만든다', () => {
    expect(profilePath(7)).toBe(PATH);
  });

  it('GET /profiles/{accountId} 로 프로필과 가입 단계를 받는다', async () => {
    const server = createFakeServer().on('GET', PATH, ok(pendingProfile));
    const { client } = createTestApi({ server, session: signedIn() });

    await expect(fetchProfile(client, 7)).resolves.toEqual(pendingProfile);
    expect(server.callsTo('GET', PATH)[0].headers.Authorization).toBe(
      'Bearer access-1',
    );
  });

  it('PUT /profiles/{accountId} 로 이름과 숫자만 남긴 연락처를 보내고 바뀐 프로필을 받는다', async () => {
    const server = createFakeServer().on('PUT', PATH, ok(pendingProfile));
    const { client } = createTestApi({ server, session: signedIn() });

    await expect(
      saveProfile(client, 7, { name: '홍길동', phoneNumber: '010-1234-5678' }),
    ).resolves.toEqual(pendingProfile);
    expect(server.callsTo('PUT', PATH)[0].body).toEqual({
      name: '홍길동',
      phoneNumber: '01012345678',
    });
  });

  it('POST /profiles/{accountId}/terms-agreements 로 동의를 보내고 바뀐 프로필을 받는다', async () => {
    const active = {
      ...pendingProfile,
      status: 'ACTIVE',
      nextStep: 'COMPLETED',
      signedUpAt: '2026-11-04T00:00:00Z',
      marketingAgreed: true,
    };
    const server = createFakeServer().on(
      'POST',
      `${PATH}/terms-agreements`,
      ok(active),
    );
    const { client } = createTestApi({ server, session: signedIn() });

    await expect(
      agreeToTerms(client, 7, toggleAllTerms(noTermsAgreed)),
    ).resolves.toEqual(active);
    expect(server.callsTo('POST', `${PATH}/terms-agreements`)[0].body).toEqual({
      serviceTerms: true,
      privacyPolicy: true,
      marketing: true,
    });
  });

  // 가입 단계 확인(AuthProvider)과 마이페이지가 같은 캐시를 쓴다
  it('profileQuery 는 내 프로필 키로 기기 세션 계정의 프로필을 받는다', async () => {
    const server = createFakeServer().on('GET', PATH, ok(pendingProfile));
    const { client, queryClient } = createTestApi({
      server,
      session: signedIn(),
    });

    await expect(queryClient.fetchQuery(profileQuery(client))).resolves.toEqual(
      pendingProfile,
    );
    expect(profileQuery(client).queryKey).toEqual(profileQueryKey);
    expect(queryClient.getQueryData(profileQueryKey)).toEqual(pendingProfile);
  });

  it('서버 오류는 코드를 담은 ApiError 로 던진다', async () => {
    const server = createFakeServer().on('PUT', PATH, fail(400, 'PROFILE-001'));
    const { client } = createTestApi({ server, session: signedIn() });

    await expect(
      saveProfile(client, 7, { name: '홍길동', phoneNumber: '01012345678' }),
    ).rejects.toMatchObject({ code: 'PROFILE-001' });
  });
});
