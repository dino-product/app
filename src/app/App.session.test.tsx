import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import {
  fail,
  networkError,
  noContent,
  ok,
  type FakeResponse,
} from '../shared/testing/fakeServer';
import { createTestApi } from '../shared/testing/renderWithApi';
import { readJson } from '../shared/storage/appStorage';
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

// 세션 (#113): 다시 켜면 저장된 세션으로 프로필을 조회해 가입 단계 화면으로 연다. 만료·로그아웃이면 로그인으로 간다.
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

afterEach(() => {
  jest.restoreAllMocks();
});

describe('App — 세션 복원 (#113)', () => {
  it('저장된 세션이 있으면 프로필을 조회하고, 가입을 마친 계정이면 메인으로 바로 연다', async () => {
    const app = await renderSignedInApp();

    expect(header('내 작업')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: '홈' })).toBeSelected();
    expect(app.server.callsTo('GET', PROFILE_PATH)).toHaveLength(1);
    expect(
      app.server.callsTo('GET', PROFILE_PATH)[0].headers.Authorization,
    ).toBe('Bearer access-1');
  });

  it('프로필을 조회하는 동안에는 로그인 화면도 메인도 아니라 첫 화면 배경만 보인다', async () => {
    const pending = deferred();
    const server = accountServer().on(
      'GET',
      PROFILE_PATH,
      () => pending.response,
    );
    const api = createTestApi({ server, session: signedInSession() });

    await render(<App api={api} />);

    expect(screen.getByTestId('session-restoring')).toBeOnTheScreen();
    expect(header(LOGIN_TITLE)).not.toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: '홈' })).not.toBeOnTheScreen();

    await act(async () => pending.answer(ok(accountProfile('COMPLETED'))));

    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
    expect(header(LOGIN_TITLE)).not.toBeOnTheScreen();
  });

  it('가입 단계가 PROFILE 이면 프로필 등록으로 연다', async () => {
    await renderSignedInApp({ nextStep: 'PROFILE' });

    expect(header('프로필 등록')).toBeOnTheScreen();
    expect(screen.getByLabelText('이름')).toHaveDisplayValue('');
  });

  it('가입 단계가 TERMS 면 약관 동의로 열고, 뒤로 가면 입력해 둔 값이 채워진 프로필 등록이다', async () => {
    await renderSignedInApp({ nextStep: 'TERMS' });

    expect(header('서비스 이용을 위해 동의가 필요해요')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(header('프로필 등록')).toBeOnTheScreen();
    expect(screen.getByLabelText('이름')).toHaveDisplayValue('박기사');
    expect(screen.getByLabelText('연락처')).toHaveDisplayValue('010-1234-5678');
  });

  it('저장된 세션이 없으면 서버를 부르지 않고 로그인 화면으로 연다', async () => {
    const app = await renderApp();

    expect(header(LOGIN_TITLE)).toBeOnTheScreen();
    expect(app.server.calls).toHaveLength(0);
  });

  it('재발급이 AUTH-009 면 기기 세션을 지우고 로그인 화면으로 연다', async () => {
    const server = accountServer().on(
      'POST',
      REFRESH_PATH,
      fail(401, 'AUTH-009'),
    );
    const app = await renderApp({
      server,
      // access token 이 만료돼 프로필 조회 전에 재발급한다
      session: signedInSession({
        accessTokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    });

    expect(header(LOGIN_TITLE)).toBeOnTheScreen();
    expect(app.tokenStore.current).toBeNull();
    expect(app.server.callsTo('GET', PROFILE_PATH)).toHaveLength(0);
  });

  it('복원이 네트워크 오류로 실패하면 연결할 수 없다고 알리고, 다시 시도하면 복원한다', async () => {
    const server = accountServer();
    server.on(
      'GET',
      PROFILE_PATH,
      networkError(),
      ok(accountProfile('COMPLETED')),
    );
    await renderApp({ server, session: signedInSession() });

    expect(header('연결할 수 없어요')).toBeOnTheScreen();
    expect(header(LOGIN_TITLE)).not.toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
  });

  it('서버가 이 계정을 모르면(탈퇴 등 PROFILE-002) 기기 세션을 지우고 로그인 화면으로 연다', async () => {
    const server = accountServer().on(
      'GET',
      PROFILE_PATH,
      fail(404, 'PROFILE-002'),
    );
    const app = await renderApp({ server, session: signedInSession() });

    expect(header(LOGIN_TITLE)).toBeOnTheScreen();
    expect(app.tokenStore.current).toBeNull();
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

  it('약관을 다시 동의하면 회사 찾기 대신 메인으로 돌아간다', async () => {
    const server = accountServer().on(
      'GET',
      '/api/v1/memberships',
      fail(403, 'PROFILE-005'),
    );
    const app = await renderSignedInApp({ server });
    server.on(
      'GET',
      PROFILE_PATH,
      ok({ ...accountProfile('TERMS'), status: 'ACTIVE' }),
    );
    await fetchMemberships(app);
    await screen.findByRole('header', {
      name: '서비스 이용을 위해 동의가 필요해요',
    });

    await userEvent.press(
      screen.getByRole('checkbox', { name: '모든 약관에 동의합니다.' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '가입하기' }));

    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
  });
});

describe('App — 로그아웃 (#113)', () => {
  it('로그아웃 API 에 Bearer 와 refreshToken 을 보내고, 기기 세션·서버 상태 캐시를 지우고 로그인 화면으로 간다', async () => {
    const app = await renderSignedInApp();
    app.queryClient.setQueryData(['notifications'], ['알림']);

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

  it('로그아웃 응답을 기다리는 동안 다시 눌러도 한 번만 보낸다', async () => {
    const pending = deferred();
    const app = await renderSignedInApp();
    app.server.on('POST', LOGOUT_PATH, () => pending.response);

    await logout();
    await userEvent.press(screen.getByRole('button', { name: '로그아웃' }));
    await userEvent.press(screen.getByRole('button', { name: '확인' }));
    await act(async () => pending.answer(noContent()));

    expect(
      await screen.findByRole('header', { name: LOGIN_TITLE }),
    ).toBeOnTheScreen();
    expect(app.server.callsTo('POST', LOGOUT_PATH)).toHaveLength(1);
  });
});
