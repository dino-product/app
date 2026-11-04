import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import {
  fail,
  networkError,
  noContent,
  ok,
  type FakeResponse,
} from '../shared/testing/fakeServer';
import {
  readSignedInStep,
  saveSignedInStep,
} from '../features/onboarding/login';
import { saveRejectDraft } from '../features/schedule/rejectDraft';
import { saveReportDraft } from '../features/work/reportDraft';
import { createTestApi } from '../shared/testing/renderWithApi';
import { appStorage, readJson } from '../shared/storage/appStorage';
import App from './App';
import { NAVIGATION_STATE_KEY } from './navigation/persistence';
import {
  accountProfile,
  accountServer,
  LOGOUT_PATH,
  PROFILE_PATH,
  renderApp,
  renderSignedInApp,
  signedInSession,
} from './testing';

// 세션 (#113): 다시 켜면 마지막으로 확인한 가입 단계 화면을 바로 그리고, 뒤에서 저장된 세션으로 프로필을 조회해 맞춘다.
// 만료·로그아웃이면 로그인으로 간다.
// "지금 보이는 화면" 은 헤더가 접근성 트리에 있는지로 확인한다 (App.test 와 같다)
const header = (name: string) => screen.queryByRole('header', { name });
const LOGIN_TITLE = '오늘의 현장, 한눈에. Orbit';
const REFRESH_PATH = '/api/v1/auth/refresh';

// 프리셋의 Alert 는 네이티브 목으로 이어지므로 띄우지 않게 막는다
const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// 응답을 테스트가 정한 때에 준다
function deferred() {
  let answer: (response: FakeResponse) => void = () => {};
  const response = new Promise<FakeResponse>(resolve => {
    answer = resolve;
  });
  return { response, answer };
}

async function logout() {
  await userEvent.press(screen.getByRole('tab', { name: '마이' }));
  await userEvent.press(screen.getByRole('button', { name: '계정 관리' }));
  await userEvent.press(screen.getByRole('button', { name: '로그아웃' }));
  await userEvent.press(screen.getByRole('button', { name: '확인' }));
}

// 앞 계정이 쓰던 완료 보고·거절 사유 초안 (#34)
function seedDrafts() {
  saveReportDraft('work-boiler', {
    beforePhotos: [],
    afterPhotos: [],
    memo: '배관 교체',
    parts: '',
    amount: '',
    paymentMethod: null,
  });
  saveRejectDraft('request-1', { selected: 'other', otherText: '차량 고장' });
}
const draftKeys = () =>
  appStorage.getAllKeys().filter(key => key.includes('Draft'));

// 프로필 입력을 마치고 약관 개정으로 다시 동의해야 하는 계정
const reconsentProfile = (marketingAgreed: boolean) => ({
  ...accountProfile('TERMS'),
  status: 'ACTIVE',
  signedUpAt: '2026-10-21T00:00:00Z',
  marketingAgreed,
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('App — 다시 켜기 (#113 낙관적 복원)', () => {
  it('로그인해 둔 기기는 첫 렌더부터 마지막으로 확인한 단계(메인)를 그리고, 뒤에서 세션으로 프로필을 조회한다', async () => {
    const pending = deferred();
    saveSignedInStep('COMPLETED');
    const server = accountServer().on(
      'GET',
      PROFILE_PATH,
      () => pending.response,
    );
    const api = createTestApi({ server, session: signedInSession() });

    await render(<App api={api} />);

    // 조회가 끝나기 전에도 로그인 화면이 아니라 메인이다
    expect(header('내 작업')).toBeOnTheScreen();
    expect(header(LOGIN_TITLE)).not.toBeOnTheScreen();
    expect(server.callsTo('GET', PROFILE_PATH)).toHaveLength(1);
    expect(server.callsTo('GET', PROFILE_PATH)[0].headers.Authorization).toBe(
      'Bearer access-1',
    );

    await act(async () => pending.answer(ok(accountProfile('COMPLETED'))));

    expect(header('내 작업')).toBeOnTheScreen();
    expect(readSignedInStep()).toBe('COMPLETED');
  });

  it('마지막 단계가 PROFILE 이면 프로필 등록으로 연다', async () => {
    await renderSignedInApp({ nextStep: 'PROFILE' });

    expect(header('프로필 등록')).toBeOnTheScreen();
    expect(screen.getByLabelText('이름')).toHaveDisplayValue('');
  });

  it('마지막 단계가 TERMS 면 약관 동의로 열고, 뒤로 가면 서버에 입력해 둔 값이 채워진 프로필 등록이다', async () => {
    await renderSignedInApp({ nextStep: 'TERMS' });

    expect(header('서비스 이용을 위해 동의가 필요해요')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(header('프로필 등록')).toBeOnTheScreen();
    expect(screen.getByLabelText('이름')).toHaveDisplayValue('박기사');
    expect(screen.getByLabelText('연락처')).toHaveDisplayValue('010-1234-5678');
  });

  it.each([
    ['COMPLETED', 'TERMS', '서비스 이용을 위해 동의가 필요해요'],
    ['PROFILE', 'COMPLETED', '내 작업'],
    ['TERMS', 'PROFILE', '프로필 등록'],
    ['PROFILE', 'TERMS', '서비스 이용을 위해 동의가 필요해요'],
  ] as const)(
    '마지막 단계(%s)와 서버 단계(%s)가 다르면 서버 단계 화면(%s)으로 보내고 표식을 바꾼다',
    async (last, current, title) => {
      saveSignedInStep(last);
      await renderApp({
        server: accountServer({ nextStep: current }),
        session: signedInSession(),
      });

      expect(
        await screen.findByRole('header', { name: title }),
      ).toBeOnTheScreen();
      expect(readSignedInStep()).toBe(current);
    },
  );

  it('로그인 표식이 없으면 Keychain 에 세션이 남아 있어도 서버를 부르지 않고 로그인 화면으로 연다', async () => {
    const app = await renderApp({ session: signedInSession() });

    expect(header(LOGIN_TITLE)).toBeOnTheScreen();
    expect(app.server.calls).toHaveLength(0);
  });

  it('표식은 있는데 저장된 세션이 없으면 표식을 지우고 로그인 화면으로 간다', async () => {
    saveSignedInStep('COMPLETED');
    const app = await renderApp();

    expect(
      await screen.findByRole('header', { name: LOGIN_TITLE }),
    ).toBeOnTheScreen();
    expect(readSignedInStep()).toBeNull();
    expect(app.server.calls).toHaveLength(0);
  });

  it('재발급이 AUTH-009 면 로그인 화면으로 가 다시 로그인해 달라고 알리고, 기기 세션과 표식을 지운다', async () => {
    const alert = spyAlert();
    saveSignedInStep('COMPLETED');
    const app = await renderApp({
      server: accountServer().on('POST', REFRESH_PATH, fail(401, 'AUTH-009')),
      // access token 이 만료돼 프로필 조회 전에 재발급한다
      session: signedInSession({
        accessTokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    });

    expect(
      await screen.findByRole('header', { name: LOGIN_TITLE }),
    ).toBeOnTheScreen();
    expect(alert).toHaveBeenCalledWith(
      '다시 로그인해 주세요',
      expect.any(String),
    );
    expect(app.tokenStore.current).toBeNull();
    expect(readSignedInStep()).toBeNull();
    expect(app.server.callsTo('GET', PROFILE_PATH)).toHaveLength(0);
  });

  it('확인이 네트워크 오류면 마지막으로 확인한 화면(메인)에 머물고 알림을 띄우지 않는다', async () => {
    const alert = spyAlert();
    saveSignedInStep('COMPLETED');
    const app = await renderApp({
      server: accountServer().on('GET', PROFILE_PATH, networkError()),
      session: signedInSession(),
    });

    await waitFor(() =>
      expect(app.server.callsTo('GET', PROFILE_PATH)).toHaveLength(1),
    );
    expect(header('내 작업')).toBeOnTheScreen();
    expect(alert).not.toHaveBeenCalled();
    expect(readSignedInStep()).toBe('COMPLETED');
    expect(app.tokenStore.current).not.toBeNull();
  });

  it('확인이 네트워크 오류여도 가입 단계 화면에 머물러, 그 화면에서 다시 저장하면 이어 간다', async () => {
    const alert = spyAlert();
    saveSignedInStep('PROFILE');
    const app = await renderApp({
      server: accountServer({ nextStep: 'PROFILE' }),
      session: signedInSession(),
    });
    app.server.on('GET', PROFILE_PATH, networkError());
    app.server.on(
      'PUT',
      PROFILE_PATH,
      networkError(),
      ok(accountProfile('TERMS')),
    );
    await fireEvent.changeText(screen.getByLabelText('이름'), '박기사');
    await fireEvent.changeText(screen.getByLabelText('연락처'), '01012345678');

    await userEvent.press(screen.getByRole('button', { name: '완료' }));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        '프로필을 저장하지 못했어요',
        '잠시 후 다시 시도해 주세요.',
      ),
    );
    expect(header('프로필 등록')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '완료' }));

    expect(
      await screen.findByRole('header', {
        name: '서비스 이용을 위해 동의가 필요해요',
      }),
    ).toBeOnTheScreen();
    expect(readSignedInStep()).toBe('TERMS');
  });

  it('서버가 이 계정을 모르면(탈퇴 등 PROFILE-002) 기기 세션과 표식을 지우고 로그인 화면으로 가 다시 로그인해 달라고 알린다', async () => {
    const alert = spyAlert();
    saveSignedInStep('COMPLETED');
    const app = await renderApp({
      server: accountServer().on('GET', PROFILE_PATH, fail(404, 'PROFILE-002')),
      session: signedInSession(),
    });

    expect(
      await screen.findByRole('header', { name: LOGIN_TITLE }),
    ).toBeOnTheScreen();
    expect(alert).toHaveBeenCalledWith(
      '다시 로그인해 주세요',
      expect.any(String),
    );
    expect(app.tokenStore.current).toBeNull();
    expect(readSignedInStep()).toBeNull();
  });

  it('Keychain 을 잠시 읽지 못하면 로그아웃하지 않고 마지막으로 확인한 화면에 머문다', async () => {
    saveSignedInStep('COMPLETED');
    const api = createTestApi({
      server: accountServer(),
      session: signedInSession(),
    });
    api.tokenStore.read = async () => {
      throw new Error('Keychain 을 읽지 못했다');
    };

    await render(<App api={api} />);
    await act(async () => undefined);

    expect(header('내 작업')).toBeOnTheScreen();
    expect(readSignedInStep()).toBe('COMPLETED');
    expect(api.server.calls).toHaveLength(0);
  });

  it('확인을 기다리는 동안 로그아웃했으면 늦게 온 프로필로 메인에 돌아가지 않는다', async () => {
    const pending = deferred();
    saveSignedInStep('COMPLETED');
    const app = await renderApp({
      server: accountServer().on('GET', PROFILE_PATH, () => pending.response),
      session: signedInSession(),
    });

    await logout();
    await screen.findByRole('header', { name: LOGIN_TITLE });
    await act(async () => pending.answer(ok(accountProfile('COMPLETED'))));

    expect(header(LOGIN_TITLE)).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: '홈' })).not.toBeOnTheScreen();
    expect(readSignedInStep()).toBeNull();
    expect(app.tokenStore.current).toBeNull();
  });

  it('확인을 기다리는 동안 프로필을 저장해 약관 단계로 갔으면 늦게 온 옛 단계(PROFILE)로 끌려가지 않는다', async () => {
    const pending = deferred();
    saveSignedInStep('PROFILE');
    await renderApp({
      server: accountServer({ nextStep: 'PROFILE' }).on(
        'GET',
        PROFILE_PATH,
        () => pending.response,
      ),
      session: signedInSession(),
    });
    await fireEvent.changeText(screen.getByLabelText('이름'), '박기사');
    await fireEvent.changeText(screen.getByLabelText('연락처'), '01012345678');
    await userEvent.press(screen.getByRole('button', { name: '완료' }));
    await screen.findByRole('header', {
      name: '서비스 이용을 위해 동의가 필요해요',
    });

    await act(async () => pending.answer(ok(accountProfile('PROFILE'))));

    expect(header('서비스 이용을 위해 동의가 필요해요')).toBeOnTheScreen();
    expect(readSignedInStep()).toBe('TERMS');
  });
});

describe('App — 쓰는 중 세션 만료 (#113)', () => {
  // 다른 화면의 요청처럼 서버 상태 캐시로 보호 자원을 부른다
  const fetchMemberships = (app: Awaited<ReturnType<typeof renderApp>>) =>
    act(() =>
      app.queryClient
        .fetchQuery({
          queryKey: ['memberships'],
          queryFn: () => app.client.get('/api/v1/memberships'),
        })
        .catch(() => undefined),
    );

  it('재발급이 AUTH-009 면 로그인 화면으로 돌아가 다시 로그인해 달라고 알리고, 저장한 화면과 서버 상태 캐시를 비운다', async () => {
    const alert = spyAlert();
    let now = Date.now();
    const server = accountServer().on(
      'POST',
      REFRESH_PATH,
      fail(401, 'AUTH-009'),
    );
    saveSignedInStep('COMPLETED');
    const app = await renderApp({
      server,
      session: signedInSession({
        accessTokenExpiresAt: new Date(now + 60 * 60 * 1000).toISOString(),
      }),
      now: () => now,
    });
    await userEvent.press(
      screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
    );
    app.queryClient.setQueryData(['notifications'], ['알림']);
    seedDrafts();

    // 1시간이 지나 access token 이 만료됐다
    now += 2 * 60 * 60 * 1000;
    await fetchMemberships(app);

    expect(
      await screen.findByRole('header', { name: LOGIN_TITLE }),
    ).toBeOnTheScreen();
    expect(alert).toHaveBeenCalledWith(
      '다시 로그인해 주세요',
      expect.any(String),
    );
    expect(app.tokenStore.current).toBeNull();
    expect(readSignedInStep()).toBeNull();
    expect(draftKeys()).toEqual([]);
    expect(app.queryClient.getQueryData(['notifications'])).toBeUndefined();
    // 저장한 화면은 로그인 화면뿐이라 다시 켜도 앞 계정의 작업 상세가 열리지 않는다
    const saved = readJson(NAVIGATION_STATE_KEY, value => value);
    expect(JSON.stringify(saved ?? null)).not.toContain('WorkDetail');
  });

  it('다른 API 가 PROFILE-005 를 주면 프로필을 다시 조회해 그 가입 단계(약관 재동의) 화면으로 보낸다', async () => {
    const server = accountServer().on(
      'GET',
      '/api/v1/memberships',
      fail(403, 'PROFILE-005'),
    );
    const app = await renderSignedInApp({ server });
    // 필수 약관 버전이 올라 재동의가 필요해졌다
    server.on('GET', PROFILE_PATH, ok(accountProfile('TERMS')));

    await fetchMemberships(app);

    expect(
      await screen.findByRole('header', {
        name: '서비스 이용을 위해 동의가 필요해요',
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: '홈' })).not.toBeOnTheScreen();
  });

  it('PROFILE-005 뒤 프로필을 다시 받지 못하면 지금 화면에 머문다', async () => {
    const server = accountServer().on(
      'GET',
      '/api/v1/memberships',
      fail(403, 'PROFILE-005'),
    );
    const app = await renderSignedInApp({ server });
    server.on('GET', PROFILE_PATH, networkError());

    await fetchMemberships(app);

    await waitFor(() =>
      expect(app.server.callsTo('GET', PROFILE_PATH)).toHaveLength(2),
    );
    expect(header('내 작업')).toBeOnTheScreen();
  });

  it('PROFILE-005 재조회를 기다리는 동안 로그아웃했으면 늦게 온 프로필로 가입 단계에 가지 않는다', async () => {
    const pending = deferred();
    const server = accountServer().on(
      'GET',
      '/api/v1/memberships',
      fail(403, 'PROFILE-005'),
    );
    const app = await renderSignedInApp({ server });
    server.on('GET', PROFILE_PATH, () => pending.response);
    await fetchMemberships(app);
    await waitFor(() =>
      expect(app.server.callsTo('GET', PROFILE_PATH)).toHaveLength(2),
    );

    await logout();
    await screen.findByRole('header', { name: LOGIN_TITLE });
    await act(async () => pending.answer(ok(accountProfile('TERMS'))));

    expect(header(LOGIN_TITLE)).toBeOnTheScreen();
    expect(readSignedInStep()).toBeNull();
  });

  // 재동의: 필수 약관만 다시 켜고 마케팅(선택)은 건드리지 않는다
  async function agreeRequiredTerms() {
    for (const name of [
      '서비스 이용약관 (필수)',
      '개인정보 처리방침 (필수)',
      '제3자 제공 동의 (필수)',
      '위치기반 서비스 이용약관 (필수)',
    ]) {
      await userEvent.press(screen.getByRole('checkbox', { name }));
    }
    await userEvent.press(screen.getByRole('button', { name: '가입하기' }));
  }

  it('약관을 다시 동의하면 회사 찾기 대신 메인으로 돌아가고, 건드리지 않은 마케팅 동의는 서버 값 그대로 보낸다', async () => {
    const server = accountServer().on(
      'GET',
      '/api/v1/memberships',
      fail(403, 'PROFILE-005'),
    );
    const app = await renderSignedInApp({ server });
    server.on('GET', PROFILE_PATH, ok(reconsentProfile(true)));
    await fetchMemberships(app);
    await screen.findByRole('header', {
      name: '서비스 이용을 위해 동의가 필요해요',
    });
    expect(
      screen.getByRole('checkbox', {
        name: '혜택 이벤트 알림 수신동의 (선택)',
      }),
    ).toBeChecked();

    await agreeRequiredTerms();

    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
    expect(header('회사 찾기')).not.toBeOnTheScreen();
    expect(
      app.server.callsTo('POST', `${PROFILE_PATH}/terms-agreements`)[0].body,
    ).toEqual({ serviceTerms: true, privacyPolicy: true, marketing: true });
  });

  it('켠 직후 프로필 확인에 실패해 모르는 채로 재동의해도, 서버 가입 시각으로 재동의인지 보고 메인으로 간다', async () => {
    saveSignedInStep('TERMS');
    const server = accountServer();
    server.on('GET', PROFILE_PATH, networkError(), ok(reconsentProfile(false)));
    const app = await renderApp({ server, session: signedInSession() });
    await waitFor(() =>
      expect(app.server.callsTo('GET', PROFILE_PATH)).toHaveLength(1),
    );
    expect(header('서비스 이용을 위해 동의가 필요해요')).toBeOnTheScreen();

    await agreeRequiredTerms();

    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
    expect(header('회사 찾기')).not.toBeOnTheScreen();
  });
});

describe('App — 로그아웃 (#113)', () => {
  it('로그아웃 API 에 Bearer 와 refreshToken 을 보내고, 기기 세션·서버 상태 캐시를 지우고 로그인 화면으로 간다', async () => {
    const app = await renderSignedInApp();
    app.queryClient.setQueryData(['notifications'], ['알림']);
    seedDrafts();

    await logout();

    expect(
      await screen.findByRole('header', { name: LOGIN_TITLE }),
    ).toBeOnTheScreen();
    expect(app.server.callsTo('POST', LOGOUT_PATH)).toEqual([
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-1' }),
        body: { refreshToken: 'refresh-1' },
      }),
    ]);
    expect(app.tokenStore.current).toBeNull();
    expect(app.queryClient.getQueryData(['notifications'])).toBeUndefined();
    expect(readSignedInStep()).toBeNull();
    expect(draftKeys()).toEqual([]);
  });

  it('로그아웃 API 가 실패해도 기기 세션을 지우고 로그인 화면으로 간다', async () => {
    const app = await renderSignedInApp();
    app.server.on('POST', LOGOUT_PATH, networkError());

    await logout();

    expect(
      await screen.findByRole('header', { name: LOGIN_TITLE }),
    ).toBeOnTheScreen();
    expect(app.tokenStore.current).toBeNull();
  });

  it('로그아웃한 뒤 다시 켜면 로그인 화면으로 연다', async () => {
    const app = await renderSignedInApp();
    await logout();
    await screen.findByRole('header', { name: LOGIN_TITLE });
    await app.unmount();

    await renderApp({ server: app.server, session: app.tokenStore.current });

    expect(header(LOGIN_TITLE)).toBeOnTheScreen();
  });

  it('서버 응답을 기다리지 않고 바로 로그인 화면으로 가고, 늦게 온 응답은 아무것도 바꾸지 않는다', async () => {
    const pending = deferred();
    const app = await renderSignedInApp();
    app.server.on('POST', LOGOUT_PATH, () => pending.response);

    await logout();

    expect(
      await screen.findByRole('header', { name: LOGIN_TITLE }),
    ).toBeOnTheScreen();
    expect(app.tokenStore.current).toBeNull();
    expect(app.server.callsTo('POST', LOGOUT_PATH)).toHaveLength(1);

    await act(async () => pending.answer(noContent()));
    expect(header(LOGIN_TITLE)).toBeOnTheScreen();
    expect(app.server.callsTo('POST', LOGOUT_PATH)).toHaveLength(1);
  });

  it('로그아웃한 뒤 끝난 재발급이 거절(AUTH-009)돼도 다시 로그인해 달라고 알리지 않는다', async () => {
    const alert = spyAlert();
    const refresh = deferred();
    saveSignedInStep('COMPLETED');
    const app = await renderApp({
      // access token 이 곧 만료돼 켤 때 프로필 조회 전에 재발급한다
      server: accountServer().on('POST', REFRESH_PATH, () => refresh.response),
      session: signedInSession({
        accessTokenExpiresAt: new Date(Date.now() + 30 * 1000).toISOString(),
      }),
    });
    await waitFor(() =>
      expect(app.server.callsTo('POST', REFRESH_PATH)).toHaveLength(1),
    );

    await logout();
    await screen.findByRole('header', { name: LOGIN_TITLE });
    await act(async () => refresh.answer(fail(401, 'AUTH-009')));

    expect(header(LOGIN_TITLE)).toBeOnTheScreen();
    expect(alert).not.toHaveBeenCalled();
  });
});
