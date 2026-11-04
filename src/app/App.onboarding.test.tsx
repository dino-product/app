import { appleAuth } from '@invertase/react-native-apple-authentication';
import {
  login as loginWithKakao,
  type KakaoLoginOptions,
  type KakaoOAuthToken,
} from '@react-native-seoul/kakao-login';
import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Alert,
  AppState,
  BackHandler,
  Platform,
  StatusBar,
  type AlertButton,
  type AppStateStatus,
} from 'react-native';
import { escapeFrom } from '../../jest/voiceOver';
import { PARTICIPATION_REQUESTS_PATH } from '../features/my/org/participationApi';
import {
  participationOf,
  REJECT_REASON,
  type FakeDecision,
} from '../features/my/org/testing';
import type { NextStep } from '../features/onboarding/profileApi';
import { fail, networkError, ok } from '../shared/testing/fakeServer';
import {
  accountProfile,
  accountServer,
  loginResponse,
  LOGOUT_PATH,
  PROFILE_PATH,
  relaunch,
  renderApp,
} from './testing';

// 로그인·가입 단계 (#85, #113). 앱을 처음 켜면 로그인부터 시작한다. 로그인·가입 단계는 가짜 서버가 답한다 (src/app/testing).
// "지금 보이는 화면" 은 헤더가 접근성 트리에 있는지로 확인한다.
// 로그인부터 참여 결과까지 한 번에 지나가는 흐름이라 커버리지·병렬 실행에서 기본 5초를 넘을 수 있다
jest.setTimeout(20_000);
const header = (name: string) => screen.queryByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const LOGIN_TITLE = '오늘의 현장, 한눈에. Orbit';
const KAKAO_NONCE_PATH = '/api/v1/auth/kakao/nonces';
const APPLE_NONCE_PATH = '/api/v1/auth/apple/nonces';
const RECENT_LOGIN = '최근에 로그인 했어요!';
// login 은 겹쳐 정의돼(웹·네이티브) 앱이 쓰는 네이티브 모양으로 본다
const kakaoLogin = loginWithKakao as unknown as jest.MockedFunction<
  (options: KakaoLoginOptions) => Promise<KakaoOAuthToken>
>;

// Android 뒤로가기: 등록된 핸들러를 최근 것부터 부른다. 아무도 처리하지 않으면 앱을 나간다
type Handler = Parameters<typeof BackHandler.addEventListener>[1];
let backHandlers: Set<Handler>;
const pressBack = async () => {
  let handled = false;
  await act(() => {
    handled = [...backHandlers]
      .reverse()
      .some(handler => handler(undefined as never) === true);
  });
  return handled;
};

// 프리셋의 Alert 는 네이티브 목으로 이어지므로 띄우지 않게 막는다
const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});

beforeEach(() => {
  backHandlers = new Set();
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, handler) => {
      backHandlers.add(handler);
      return { remove: () => backHandlers.delete(handler) };
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** 로그아웃 상태로 켠다. nextStep 은 로그인하면 서버가 줄 가입 단계 */
const launch = (nextStep: NextStep = 'PROFILE') =>
  renderApp({ server: accountServer({ nextStep }) });

async function login(name: '카카오로 시작하기' | 'Apple로 시작하기') {
  await userEvent.press(button(name));
}

// 글자 단위 입력·서식은 화면 테스트가 확인한다. 여기서는 흐름만 보므로 값을 한 번에 넣는다
async function registerProfile() {
  await fireEvent.changeText(await screen.findByLabelText('이름'), '박기사');
  await fireEvent.changeText(screen.getByLabelText('연락처'), '01012345678');
  await userEvent.press(button('완료'));
}

async function agreeTerms() {
  await userEvent.press(
    await screen.findByRole('checkbox', { name: '모든 약관에 동의합니다.' }),
  );
  await userEvent.press(button('가입하기'));
}

// 회사 찾기로 돌아오면 앞서 넣은 코드가 입력칸에 남아 있어 값을 바꿔 넣는다
async function findCompany(code: string) {
  await fireEvent.changeText(
    await screen.findByLabelText('회사 코드 입력'),
    code,
  );
  await userEvent.press(button('회사 확인'));
}

async function requestAs(type: '기사' | '직원') {
  await userEvent.press(
    await screen.findByRole('radio', { name: new RegExp(`^${type}`) }),
  );
  await userEvent.press(button('참여 요청하기'));
}

/** 로그인부터 승인 대기까지 */
async function requestToJoin(code = '123456', type: '기사' | '직원' = '기사') {
  const app = await launch();
  await login('카카오로 시작하기');
  await registerProfile();
  await agreeTerms();
  await findCompany(code);
  await requestAs(type);
  // 승인 대기는 서버 신청 현황에서 그 요청을 받아 그린다
  await screen.findByRole('header', { name: '참여 요청을 보냈어요' });
  return app;
}

/** 사무실이 마지막 요청을 결정한다 (가짜 서버, features/my/org/testing) */
const decide = (
  app: Awaited<ReturnType<typeof launch>>,
  decision: FakeDecision = { status: 'APPROVED' },
) => participationOf(app.server).decide(decision);

/** 사무실이 승인한 뒤 승인 대기의 확인으로 결과를 확인하고 시작한다 */
async function approveAndStart(app: Awaited<ReturnType<typeof launch>>) {
  decide(app);
  await userEvent.press(button('확인'));
  await userEvent.press(
    await screen.findByRole('button', { name: '시작하기' }),
  );
}

async function logoutFromMyPage() {
  await userEvent.press(screen.getByRole('tab', { name: '마이' }));
  await userEvent.press(button('계정 관리'));
  await userEvent.press(button('로그아웃'));
  await userEvent.press(button('확인'));
  await screen.findByRole('header', { name: LOGIN_TITLE });
}

const recentBubble = (method: 'KAKAO' | 'APPLE') =>
  within(screen.getByTestId(`login-${method}`)).queryByText(RECENT_LOGIN, {
    includeHiddenElements: true,
  });

describe('App — 온보딩', () => {
  it('처음 켜면 하단 탭 없이 로그인 화면이 열리고, iOS 는 카카오·Apple 버튼이 다 보인다', async () => {
    await launch();

    expect(header(LOGIN_TITLE)).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: '홈' })).not.toBeOnTheScreen();
    expect(button('카카오로 시작하기')).toBeOnTheScreen();
    expect(button('Apple로 시작하기')).toBeOnTheScreen();
  });

  it('보라 배경인 로그인 화면이 보이는 동안만 상태 표시줄 글자가 흰색이고, 프로필 등록으로 가면 되돌린다', async () => {
    const push = jest.spyOn(StatusBar, 'pushStackEntry');
    const pop = jest.spyOn(StatusBar, 'popStackEntry');
    await launch();
    const lightEntries = push.mock.results
      .filter(
        (_, index) => push.mock.calls[index][0].barStyle === 'light-content',
      )
      .map(result => result.value);
    expect(lightEntries).toHaveLength(1);
    expect(pop).not.toHaveBeenCalledWith(lightEntries[0]);

    await login('카카오로 시작하기');
    await screen.findByRole('header', { name: '프로필 등록' });

    expect(pop).toHaveBeenCalledWith(lightEntries[0]);
  });

  it('온보딩 화면은 열리면 스크린리더 포커스가 제목으로 간다', async () => {
    const focus = jest
      .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      .mockClear();
    // 네이티브 스택은 전환이 끝나면 화면의 onAppear 를 부른다. 테스트 환경에는 전환이 없어 직접 보낸다
    const appear = async (title: string) =>
      fireEvent(await screen.findByRole('header', { name: title }), 'appear');
    const titleNode = expect.objectContaining({
      props: expect.objectContaining({ accessibilityRole: 'header' }),
    });
    await launch();

    await login('카카오로 시작하기');
    await appear('프로필 등록');
    expect(focus).toHaveBeenLastCalledWith(titleNode, 'focus');

    await registerProfile();
    await appear('서비스 이용을 위해 동의가 필요해요');
    expect(focus).toHaveBeenCalledTimes(2);

    await agreeTerms();
    await appear('회사 참여');
    expect(focus).toHaveBeenCalledTimes(3);
  });

  it('Android 에서는 카카오 버튼만 보인다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await launch();

    expect(button('카카오로 시작하기')).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Apple로 시작하기' }),
    ).not.toBeOnTheScreen();
  });

  it('첫 실행부터 프로필·약관·회사 참여를 지나 메인(홈 탭)까지 한 번에 간다', async () => {
    const app = await launch();

    await login('카카오로 시작하기');
    expect(
      await screen.findByRole('header', { name: '프로필 등록' }),
    ).toBeOnTheScreen();

    await registerProfile();
    expect(
      await screen.findByRole('header', {
        name: '서비스 이용을 위해 동의가 필요해요',
      }),
    ).toBeOnTheScreen();

    await agreeTerms();
    expect(
      await screen.findByRole('header', { name: '회사 참여' }),
    ).toBeOnTheScreen();
    expect(header('회사 찾기')).toBeOnTheScreen();

    await findCompany('123456');
    expect(
      await screen.findByRole('header', { name: '역할을 선택해주세요' }),
    ).toBeOnTheScreen();
    expect(header('참여 요청')).toBeOnTheScreen();
    expect(screen.getByText('Orbit')).toBeOnTheScreen();

    await requestAs('기사');
    expect(
      await screen.findByRole('header', { name: '참여 요청을 보냈어요' }),
    ).toBeOnTheScreen();
    expect(header('승인 대기')).toBeOnTheScreen();
    expect(screen.getByLabelText('요청 경로, 회사 코드')).toBeOnTheScreen();

    // 사무실이 승인했다. 확인을 누르면 서버 신청 현황으로 결과 화면을 정한다
    decide(app);
    await userEvent.press(button('확인'));
    expect(
      await screen.findByRole('header', { name: '참여 완료' }),
    ).toBeOnTheScreen();
    expect(header('Orbit 참여 승인 완료')).toBeOnTheScreen();

    await userEvent.press(button('시작하기'));
    expect(header('내 작업')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: '홈' })).toBeSelected();
  });

  it('메인에 들어간 뒤에는 뒤로 가기로 온보딩이나 로그인에 돌아가지 않는다', async () => {
    const app = await requestToJoin();
    await approveAndStart(app);

    // 메인 첫 화면에서 Android 뒤로가기는 앱을 나간다 (아무도 처리하지 않음)
    expect(await pressBack()).toBe(false);
    expect(header('내 작업')).toBeOnTheScreen();
    expect(header('참여 완료')).not.toBeOnTheScreen();
    expect(header(LOGIN_TITLE)).not.toBeOnTheScreen();
  });

  it('로그아웃하면 로그인으로 가고, 최근 방식에 말풍선이 보이며, 다시 로그인하면 가입을 마친 계정이라 바로 메인으로 간다', async () => {
    const app = await requestToJoin();
    await approveAndStart(app);

    await logoutFromMyPage();
    expect(recentBubble('KAKAO')).toBeOnTheScreen();

    await login('카카오로 시작하기');
    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: '홈' })).toBeSelected();
  });

  it('로그아웃하면 이 기기에 들고 있던 목 상태(작업 시작 등)를 비워, 다시 로그인하면 처음 상태다', async () => {
    const app = await requestToJoin();
    await approveAndStart(app);
    await userEvent.press(button('작업 시작'));
    expect(button('작업 수행중')).toBeOnTheScreen();

    await logoutFromMyPage();
    await login('카카오로 시작하기');

    expect(
      await screen.findByRole('button', { name: '작업 시작' }),
    ).toBeOnTheScreen();
  });

  it('카카오로 가입한 뒤 Apple 로 로그인하면 서버에서 다른 계정이라 프로필 등록부터 한다', async () => {
    const app = await requestToJoin();
    await approveAndStart(app);
    await logoutFromMyPage();
    app.server
      .on(
        'POST',
        '/api/v1/auth/apple/login',
        ok({ ...loginResponse(), accountId: 2 }),
      )
      .on(
        'GET',
        '/api/v1/profiles/2',
        ok({ ...accountProfile('PROFILE'), accountId: 2 }),
      );

    await login('Apple로 시작하기');

    expect(
      await screen.findByRole('header', { name: '프로필 등록' }),
    ).toBeOnTheScreen();
  });

  it('탈퇴하면 로그인으로 가고 최근 로그인 표시를 지우며, 다시 로그인한 새 계정은 프로필 등록부터 한다', async () => {
    const alert = spyAlert();
    const app = await requestToJoin();
    await approveAndStart(app);
    // 응답 필요 요청을 모두 수락해 탈퇴를 막는 사유를 없앤다
    await userEvent.press(screen.getByRole('tab', { name: '내 일정' }));
    await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
    while (screen.queryAllByRole('button', { name: /수락$/ }).length > 0) {
      await userEvent.press(
        screen.getAllByRole('button', { name: /수락$/ })[0],
      );
    }
    await userEvent.press(screen.getByRole('tab', { name: '마이' }));
    await userEvent.press(button('계정 관리'));
    await userEvent.press(button('계정 탈퇴'));
    await userEvent.press(
      await screen.findByRole('button', { name: '탈퇴하기' }),
    );
    const buttons: AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
    await act(() => buttons.find(item => item.text === '탈퇴')?.onPress?.());

    expect(
      await screen.findByRole('header', { name: LOGIN_TITLE }),
    ).toBeOnTheScreen();
    expect(recentBubble('KAKAO')).not.toBeOnTheScreen();

    // 탈퇴한 카카오 계정으로 다시 로그인하면 서버가 새 계정을 만든다
    app.server.on('GET', PROFILE_PATH, ok(accountProfile('PROFILE')));
    await login('카카오로 시작하기');
    expect(
      await screen.findByRole('header', { name: '프로필 등록' }),
    ).toBeOnTheScreen();
  });

  describe('로그인 (#113)', () => {
    it.each([
      ['PROFILE', '프로필 등록'],
      ['TERMS', '서비스 이용을 위해 동의가 필요해요'],
      ['COMPLETED', '내 작업'],
    ] as const)(
      '서버 가입 단계가 %s 면 %s 로 간다',
      async (nextStep, title) => {
        await launch(nextStep);

        await login('카카오로 시작하기');

        expect(
          await screen.findByRole('header', { name: title }),
        ).toBeOnTheScreen();
        expect(header(LOGIN_TITLE)).not.toBeOnTheScreen();
      },
    );

    it('Apple 로도 같은 순서로 로그인해 가입 단계로 간다', async () => {
      const app = await launch('PROFILE');

      await login('Apple로 시작하기');

      expect(
        await screen.findByRole('header', { name: '프로필 등록' }),
      ).toBeOnTheScreen();
      expect(app.server.calls.map(call => call.path)).toEqual([
        APPLE_NONCE_PATH,
        '/api/v1/auth/apple/login',
        PROFILE_PATH,
      ]);
    });

    it('사용자가 SDK 로그인을 취소하면 로그인 화면에 그대로 있고 오류를 띄우지 않는다', async () => {
      const alert = spyAlert();
      const app = await launch();
      jest
        .mocked(loginWithKakao)
        .mockRejectedValueOnce(new Error('ClientFailed(Cancelled)'));

      await login('카카오로 시작하기');

      await waitFor(() =>
        expect(app.server.callsTo('POST', KAKAO_NONCE_PATH)).toHaveLength(1),
      );
      expect(header(LOGIN_TITLE)).toBeOnTheScreen();
      expect(alert).not.toHaveBeenCalled();
      expect(app.tokenStore.current).toBeNull();
    });

    it.each([
      ['AUTH-002', fail(401, 'AUTH-002')],
      ['AUTH-003', fail(401, 'AUTH-003')],
      ['네트워크', networkError()],
    ])(
      '서버 로그인이 실패하면(%s) 로그인하지 못했다고 알리고, 다시 누르면 nonce 부터 다시 받는다',
      async (_, response) => {
        const alert = spyAlert();
        const app = await launch();
        app.server.on(
          'POST',
          '/api/v1/auth/kakao/login',
          response,
          ok(loginResponse()),
        );

        await login('카카오로 시작하기');
        await waitFor(() =>
          expect(alert).toHaveBeenCalledWith(
            '로그인하지 못했어요',
            '잠시 후 다시 시도해 주세요.',
          ),
        );
        expect(header(LOGIN_TITLE)).toBeOnTheScreen();

        await login('카카오로 시작하기');

        expect(
          await screen.findByRole('header', { name: '프로필 등록' }),
        ).toBeOnTheScreen();
        expect(app.server.callsTo('POST', KAKAO_NONCE_PATH)).toHaveLength(2);
      },
    );

    it.each([
      ['AUTH-005', fail(401, 'AUTH-005')],
      ['AUTH-006', fail(502, 'AUTH-006')],
    ])('Apple 서버 로그인이 실패해도(%s) 알린다', async (_, response) => {
      const alert = spyAlert();
      const app = await launch();
      app.server.on('POST', '/api/v1/auth/apple/login', response);

      await login('Apple로 시작하기');

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '로그인하지 못했어요',
          '잠시 후 다시 시도해 주세요.',
        ),
      );
      expect(header(LOGIN_TITLE)).toBeOnTheScreen();
    });

    it('카카오 앱 키가 없는 빌드면 카카오 로그인만 실패 안내를 띄운다', async () => {
      const alert = spyAlert();
      await launch();
      jest
        .mocked(loginWithKakao)
        .mockRejectedValueOnce(
          new Error(
            'ClientFailed(MustInitAppKey): the Kakao SDK was never initialized.',
          ),
        );

      await login('카카오로 시작하기');
      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '로그인하지 못했어요',
          '잠시 후 다시 시도해 주세요.',
        ),
      );

      await login('Apple로 시작하기');
      expect(
        await screen.findByRole('header', { name: '프로필 등록' }),
      ).toBeOnTheScreen();
    });

    it('로그인 중에 다시 누르거나 다른 방식을 눌러도 요청이 겹치지 않고 처음 누른 방식으로 로그인한다', async () => {
      const app = await launch();
      // nonce 응답을 붙잡아 첫 로그인이 진행 중인 채로 다시 누른다
      let answerNonce: () => void = () => {};
      const nonceAnswered = new Promise<void>(resolve => {
        answerNonce = resolve;
      });
      app.server.on('POST', KAKAO_NONCE_PATH, () =>
        nonceAnswered.then(() =>
          ok({ nonce: 'nonce-1', expiresAt: '2026-11-04T00:05:00Z' }),
        ),
      );

      await fireEvent.press(button('카카오로 시작하기'));
      await fireEvent.press(button('카카오로 시작하기'));
      await fireEvent.press(button('Apple로 시작하기'));
      expect(header(LOGIN_TITLE)).toBeOnTheScreen();
      await act(async () => answerNonce());

      expect(
        await screen.findByRole('header', { name: '프로필 등록' }),
      ).toBeOnTheScreen();
      expect(app.server.callsTo('POST', KAKAO_NONCE_PATH)).toHaveLength(1);
      expect(app.server.callsTo('POST', APPLE_NONCE_PATH)).toHaveLength(0);
      expect(loginWithKakao).toHaveBeenCalledTimes(1);
      expect(appleAuth.performRequest).not.toHaveBeenCalled();
    });

    // iOS: 카카오톡으로 넘어갔다가 로그인을 마치지 않고 앱으로 직접 돌아오면 카카오 SDK 가 끝을 알리지 않는다
    describe('카카오톡에서 마치지 않고 돌아온 경우', () => {
      let appStateListeners: Array<(status: AppStateStatus) => void>;
      const changeAppState = (status: AppStateStatus) =>
        act(() => appStateListeners.forEach(listener => listener(status)));
      // 카카오 SDK 가 끝나지 않는다. 테스트가 늦게 끝낼 수 있다
      const hangKakao = () => {
        let finish: () => void = () => {};
        kakaoLogin.mockImplementationOnce(
          () =>
            new Promise(resolve => {
              finish = () =>
                resolve({
                  accessToken: 'kakao-access',
                  refreshToken: 'kakao-refresh',
                  idToken: 'late-id-token',
                  accessTokenExpiresAt: new Date(),
                  refreshTokenExpiresAt: new Date(),
                  scopes: [],
                });
            }),
        );
        return () => act(async () => finish());
      };

      beforeEach(() => {
        appStateListeners = [];
        jest
          .spyOn(AppState, 'addEventListener')
          .mockImplementation((_type, handler) => {
            appStateListeners.push(handler as (status: AppStateStatus) => void);
            return { remove: () => undefined };
          });
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      // 카카오톡으로 넘어갔다가(백그라운드) 돌아온다. Android 는 카카오톡·카카오계정(Custom Tabs) 모두 이렇게 돌아온다
      async function leaveForKakaoTalkAndComeBack() {
        await fireEvent.press(button('카카오로 시작하기'));
        await waitFor(() => expect(loginWithKakao).toHaveBeenCalledTimes(1));
        await changeAppState('inactive');
        await changeAppState('background');
        await changeAppState('active');
      }

      // 돌아온 뒤에도 SDK 는 받은 코드를 토큰으로 바꾸는 네트워크 교환을 마쳐야 끝난다
      it('돌아온 지 3초 뒤에 SDK 가 끝나도(약한 신호의 토큰 교환) 시도를 살려 두어 그대로 로그인한다', async () => {
        const alert = spyAlert();
        const app = await launch();
        const finish = hangKakao();
        jest.useFakeTimers();

        await leaveForKakaoTalkAndComeBack();
        await act(() => jest.advanceTimersByTimeAsync(3000));
        await finish();

        expect(
          await screen.findByRole('header', { name: '프로필 등록' }),
        ).toBeOnTheScreen();
        expect(
          app.server.callsTo('POST', '/api/v1/auth/kakao/login'),
        ).toHaveLength(1);
        expect(alert).not.toHaveBeenCalled();
      });

      it('카카오톡 오류 뒤 라이브러리가 띄운 카카오계정 로그인 창에서 한참 뒤에 마쳐도 그대로 로그인한다', async () => {
        const app = await launch();
        const finish = hangKakao();
        jest.useFakeTimers();

        await leaveForKakaoTalkAndComeBack();
        // 카카오계정 로그인 창(앱 안 시트)이 뜨고, 사용자가 문자 인증을 보러 다른 앱에 다녀온다
        await changeAppState('inactive');
        await changeAppState('active');
        await changeAppState('background');
        await changeAppState('active');
        await act(() => jest.advanceTimersByTimeAsync(60_000));
        await finish();

        expect(
          await screen.findByRole('header', { name: '프로필 등록' }),
        ).toBeOnTheScreen();
        expect(
          app.server.callsTo('POST', '/api/v1/auth/kakao/login'),
        ).toHaveLength(1);
      });

      it('돌아온 뒤 다시 누르면 끝나지 않은 앞 시도를 버리고 새로 하며, 앞 시도가 늦게 끝나도 무시한다', async () => {
        const app = await launch();
        const finishLate = hangKakao();
        jest.useFakeTimers();

        await leaveForKakaoTalkAndComeBack();
        await fireEvent.press(button('카카오로 시작하기'));

        expect(
          await screen.findByRole('header', { name: '프로필 등록' }),
        ).toBeOnTheScreen();
        await finishLate();
        expect(app.server.callsTo('POST', KAKAO_NONCE_PATH)).toHaveLength(2);
        expect(
          app.server.callsTo('POST', '/api/v1/auth/kakao/login'),
        ).toHaveLength(1);
      });

      it('앱을 떠나지 않은 채(카카오계정 로그인 창이 떠 있는 동안) 다시 누르면 겹치지 않게 무시한다', async () => {
        const app = await launch();
        hangKakao();

        await fireEvent.press(button('카카오로 시작하기'));
        await waitFor(() => expect(loginWithKakao).toHaveBeenCalledTimes(1));
        await changeAppState('inactive');
        await changeAppState('active');
        await fireEvent.press(button('카카오로 시작하기'));

        expect(app.server.callsTo('POST', KAKAO_NONCE_PATH)).toHaveLength(1);
        expect(loginWithKakao).toHaveBeenCalledTimes(1);
      });
    });

    it("'최근에 로그인 했어요' 는 마지막으로 성공한 방식이고 앱을 다시 켜도 남는다. 실패한 방식으로 바뀌지 않는다", async () => {
      spyAlert();
      const app = await launch('COMPLETED');
      expect(recentBubble('KAKAO')).not.toBeOnTheScreen();
      expect(recentBubble('APPLE')).not.toBeOnTheScreen();

      await login('Apple로 시작하기');
      await screen.findByRole('header', { name: '내 작업' });
      await logoutFromMyPage();
      expect(recentBubble('APPLE')).toBeOnTheScreen();

      // 카카오는 실패한다
      app.server.on('POST', '/api/v1/auth/kakao/login', fail(401, 'AUTH-002'));
      await login('카카오로 시작하기');
      await waitFor(() => expect(Alert.alert).toHaveBeenCalled());

      await relaunch(app);
      expect(recentBubble('APPLE')).toBeOnTheScreen();
      expect(recentBubble('KAKAO')).not.toBeOnTheScreen();
    });
  });

  describe('가입 단계 저장 (#113)', () => {
    it('프로필 등록은 PUT /profiles/{accountId} 에 성공한 뒤 약관 동의로 간다', async () => {
      const app = await launch();
      await login('카카오로 시작하기');

      await registerProfile();

      expect(
        await screen.findByRole('header', {
          name: '서비스 이용을 위해 동의가 필요해요',
        }),
      ).toBeOnTheScreen();
      expect(app.server.callsTo('PUT', PROFILE_PATH)[0]).toMatchObject({
        headers: expect.objectContaining({ Authorization: 'Bearer access-1' }),
        body: { name: '박기사', phoneNumber: '01012345678' },
      });
    });

    it('서버가 입력 규칙(PROFILE-001)으로 거절하면 화면에 머물고 규칙을 안내한다', async () => {
      const alert = spyAlert();
      const app = await launch();
      await login('카카오로 시작하기');
      await screen.findByRole('header', { name: '프로필 등록' });
      app.server.on('PUT', PROFILE_PATH, fail(400, 'PROFILE-001'));

      await registerProfile();

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '입력한 정보를 확인해 주세요',
          '이름은 한글·영문 2~20자, 연락처는 010으로 시작하는 11자리로 입력해 주세요.',
        ),
      );
      expect(header('프로필 등록')).toBeOnTheScreen();
      expect(button('완료')).toBeEnabled();
    });

    it('프로필 저장이 다른 이유로 실패하면 화면에 머물고 다시 시도하라고 알린다', async () => {
      const alert = spyAlert();
      const app = await launch();
      await login('카카오로 시작하기');
      await screen.findByRole('header', { name: '프로필 등록' });
      app.server.on('PUT', PROFILE_PATH, networkError());

      await registerProfile();

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '프로필을 저장하지 못했어요',
          '잠시 후 다시 시도해 주세요.',
        ),
      );
      expect(header('프로필 등록')).toBeOnTheScreen();
    });

    it("약관 동의 '가입하기' 는 서비스·개인정보·마케팅만 보내고, 성공하면 회사 찾기로 간다", async () => {
      const app = await launch('TERMS');
      await login('카카오로 시작하기');
      await screen.findByRole('header', {
        name: '서비스 이용을 위해 동의가 필요해요',
      });

      // 필수 넷만 켜고 마케팅(선택)은 끈다
      for (const name of [
        '서비스 이용약관 (필수)',
        '개인정보 처리방침 (필수)',
        '제3자 제공 동의 (필수)',
        '위치기반 서비스 이용약관 (필수)',
      ]) {
        await userEvent.press(screen.getByRole('checkbox', { name }));
      }
      await userEvent.press(button('가입하기'));

      expect(
        await screen.findByRole('header', { name: '회사 찾기' }),
      ).toBeOnTheScreen();
      expect(
        app.server.callsTo('POST', `${PROFILE_PATH}/terms-agreements`)[0].body,
      ).toEqual({ serviceTerms: true, privacyPolicy: true, marketing: false });
    });

    it('약관 동의 저장이 실패하면 화면에 머물고 안내한다', async () => {
      const alert = spyAlert();
      const app = await launch('TERMS');
      await login('카카오로 시작하기');
      await screen.findByRole('header', {
        name: '서비스 이용을 위해 동의가 필요해요',
      });
      app.server.on(
        'POST',
        `${PROFILE_PATH}/terms-agreements`,
        fail(409, 'COMMON-409'),
      );

      await agreeTerms();

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '가입하지 못했어요',
          '잠시 후 다시 시도해 주세요.',
        ),
      );
      expect(header('서비스 이용을 위해 동의가 필요해요')).toBeOnTheScreen();
      expect(header('회사 찾기')).not.toBeOnTheScreen();
    });

    it('약관까지 마친 뒤 회사 참여 중에 앱을 다시 켜면 가입을 마친 계정이라 메인으로 연다', async () => {
      const app = await launch();
      await login('카카오로 시작하기');
      await registerProfile();
      await agreeTerms();
      await screen.findByRole('header', { name: '회사 찾기' });

      await relaunch(app);

      expect(header('내 작업')).toBeOnTheScreen();
    });
  });

  describe('회사 참여 결과', () => {
    it('없는 코드면 유효하지 않은 회사 코드로 바뀐다', async () => {
      await launch();
      await login('카카오로 시작하기');
      await registerProfile();
      await agreeTerms();

      await findCompany('999999');

      expect(
        await screen.findByRole('header', {
          name: '유효하지 않은 회사 코드입니다',
        }),
      ).toBeOnTheScreen();
    });

    it('참여를 요청하면 뒤로 가기로 역할 선택에 돌아가지 않고 회사 찾기로 간다', async () => {
      await requestToJoin();

      await escapeFrom('승인 대기');

      expect(header('회사 찾기')).toBeOnTheScreen();
      expect(header('역할을 선택해주세요')).not.toBeOnTheScreen();
    });

    it('회사 찾기로 돌아와 요청한 회사 코드를 다시 넣으면 그 요청의 승인 대기로 간다', async () => {
      await requestToJoin();
      await escapeFrom('승인 대기');

      await findCompany('123456');

      expect(
        await screen.findByRole('header', { name: '승인 대기' }),
      ).toBeOnTheScreen();
    });

    it('승인 대기에서 신청 취소를 확정하면 회사 찾기로 돌아가고, 같은 코드로 다시 요청할 수 있다', async () => {
      await requestToJoin();

      await userEvent.press(button('신청 취소'));
      await userEvent.press(
        within(screen.getByTestId('cancel-request-modal')).getByRole('button', {
          name: '취소',
        }),
      );

      expect(header('회사 찾기')).toBeOnTheScreen();
      await findCompany('123456');
      expect(
        await screen.findByRole('header', { name: '역할을 선택해주세요' }),
      ).toBeOnTheScreen();
    });

    it('참여 요청은 회사 코드·희망 유형·요청 경로(회사 코드 입력)로 서버에 보낸다', async () => {
      const app = await requestToJoin('123456', '직원');

      expect(
        app.server.callsTo('POST', PARTICIPATION_REQUESTS_PATH)[0].body,
      ).toEqual({
        companyCode: '123456',
        desiredType: 'STAFF',
        requestChannel: 'COMPANY_CODE',
      });
      expect(screen.getByLabelText('희망 유형, 직원')).toBeOnTheScreen();
    });

    // 결과는 알림으로 온다 ('사무실에서 요청을 확인하면 알려드릴게요'). 승인 전에도 앱을 쓸 수 있다
    it('사무실이 아직 검토 중이면 승인 대기의 확인으로 가입을 마치고 메인으로 간다', async () => {
      const app = await requestToJoin();

      await userEvent.press(button('확인'));

      expect(
        await screen.findByRole('header', { name: '내 작업' }),
      ).toBeOnTheScreen();
      expect(header('참여 완료')).not.toBeOnTheScreen();
      expect(participationOf(app.server).requests.at(-1)?.status).toBe(
        'PENDING',
      );
    });

    it('참여 완료에서 뒤로 가도 같은 회사 코드를 넣으면 그 참여 완료로 돌아와 시작할 수 있다', async () => {
      const app = await requestToJoin();
      decide(app);
      await userEvent.press(button('확인'));
      expect(
        await screen.findByRole('header', { name: '참여 완료' }),
      ).toBeOnTheScreen();

      await escapeFrom('참여 완료');
      expect(header('회사 찾기')).toBeOnTheScreen();
      await findCompany('123456');

      expect(
        await screen.findByRole('header', { name: 'Orbit 참여 승인 완료' }),
      ).toBeOnTheScreen();
      await userEvent.press(button('시작하기'));
      expect(header('내 작업')).toBeOnTheScreen();
    });

    // 다른 기기에서 같은 회사에 먼저 요청했다. 서버가 승인 대기 요청이 있다고 거절한다 (ORGANIZATION-014)
    it('역할 선택에서 보낸 요청이 승인 대기 요청 때문에 거절되면 안내한 뒤 그 요청의 승인 대기로 간다', async () => {
      const app = await launch();
      await login('카카오로 시작하기');
      await registerProfile();
      await agreeTerms();
      await findCompany('123456');
      await screen.findByRole('header', { name: '역할을 선택해주세요' });
      await app.client.post(PARTICIPATION_REQUESTS_PATH, {
        companyCode: '123456',
        desiredType: 'STAFF',
        requestChannel: 'QR_CODE',
      });

      await requestAs('기사');
      expect(
        await screen.findByRole('header', {
          name: '이미 참여를 요청한 회사예요',
        }),
      ).toBeOnTheScreen();
      await userEvent.press(button('확인'));

      expect(
        await screen.findByRole('header', { name: '참여 요청을 보냈어요' }),
      ).toBeOnTheScreen();
      // 다른 기기가 보낸 요청이라 경로를 모르고, 희망 유형은 그 요청의 것이다
      expect(screen.getByLabelText('희망 유형, 직원')).toBeOnTheScreen();
      expect(screen.queryByLabelText(/^요청 경로/)).toBeNull();
      await escapeFrom('승인 대기');
      expect(header('회사 찾기')).toBeOnTheScreen();
    });

    // 사무실이 그사이 승인했다. 취소할 수 없다고 알린 뒤 서버 상태(승인)로 참여 완료를 연다
    it('승인 대기에서 취소하려던 요청이 이미 처리됐으면(ORGANIZATION-017) 알리고 확인하면 결과 화면으로 간다', async () => {
      const alert = spyAlert();
      const app = await requestToJoin();
      decide(app);

      await userEvent.press(button('신청 취소'));
      await userEvent.press(
        within(screen.getByTestId('cancel-request-modal')).getByRole('button', {
          name: '취소',
        }),
      );
      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '이미 처리된 요청이에요',
          expect.any(String),
          expect.any(Array),
        ),
      );
      const buttons: AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
      await act(() => buttons[0].onPress?.());

      expect(
        await screen.findByRole('header', { name: 'Orbit 참여 승인 완료' }),
      ).toBeOnTheScreen();
    });

    it('승인 대기에서 Android 뒤로가기를 누르면 역할 선택이 아니라 회사 찾기로 간다', async () => {
      await requestToJoin();

      expect(await pressBack()).toBe(true);

      expect(header('회사 찾기')).toBeOnTheScreen();
      expect(header('역할을 선택해주세요')).not.toBeOnTheScreen();
    });

    // 앱의 확정 유형은 서버 confirmedType 이다
    it('사무실이 요청과 다른 유형으로 승인하면 유형 변경 완료가 보이고, 시작하기로 메인에 간다', async () => {
      const app = await requestToJoin('234567', '기사');
      decide(app, { status: 'APPROVED', confirmedType: 'STAFF' });

      await userEvent.press(button('확인'));

      expect(
        await screen.findByRole('header', { name: '직원 참여 승인 완료' }),
      ).toBeOnTheScreen();
      expect(
        screen.getByText('사무실에서 요청하신 유형과 다르게 확정했어요.'),
      ).toBeOnTheScreen();
      await userEvent.press(button('시작하기'));
      expect(header('내 작업')).toBeOnTheScreen();
    });

    it('사무실이 거절하면 서버의 거절 사유가 보이고, 확인을 누르면 회사 찾기로 돌아가 같은 코드로 다시 요청할 수 있다', async () => {
      const app = await requestToJoin('345678');
      decide(app, { status: 'REJECTED', rejectReason: REJECT_REASON });

      await userEvent.press(button('확인'));
      expect(
        await screen.findByRole('header', { name: '참여 요청이 거절되었어요' }),
      ).toBeOnTheScreen();
      expect(screen.getByText(REJECT_REASON)).toBeOnTheScreen();

      await userEvent.press(button('확인'));
      expect(header('회사 찾기')).toBeOnTheScreen();
      await findCompany('345678');
      expect(
        await screen.findByRole('header', { name: '역할을 선택해주세요' }),
      ).toBeOnTheScreen();
    });
  });

  describe('뒤로 가기', () => {
    it('프로필 등록의 뒤로 가기는 가입을 그만두고 로그아웃해 로그인으로 돌아간다', async () => {
      const app = await launch();
      await login('카카오로 시작하기');
      await screen.findByRole('header', { name: '프로필 등록' });

      await userEvent.press(button('뒤로 가기'));

      expect(
        await screen.findByRole('header', { name: LOGIN_TITLE }),
      ).toBeOnTheScreen();
      expect(header('프로필 등록')).not.toBeOnTheScreen();
      expect(app.server.callsTo('POST', LOGOUT_PATH)).toHaveLength(1);
      expect(app.tokenStore.current).toBeNull();
    });

    it('온보딩 하위 화면은 Android 뒤로가기로 이전 단계에 가고, 첫 화면에서는 로그인으로 간다', async () => {
      await launch();
      await login('카카오로 시작하기');
      await registerProfile();
      await agreeTerms();
      await screen.findByRole('header', { name: '회사 찾기' });

      expect(await pressBack()).toBe(true);
      expect(header('서비스 이용을 위해 동의가 필요해요')).toBeOnTheScreen();
      expect(await pressBack()).toBe(true);
      expect(header('프로필 등록')).toBeOnTheScreen();
      expect(await pressBack()).toBe(true);
      expect(
        await screen.findByRole('header', { name: LOGIN_TITLE }),
      ).toBeOnTheScreen();
    });

    it('온보딩 하위 화면은 VoiceOver 두 손가락 Z 로 이전 단계에 가고, 첫 화면에서는 로그인으로 간다', async () => {
      await launch();
      await login('카카오로 시작하기');
      await registerProfile();
      await screen.findByRole('header', {
        name: '서비스 이용을 위해 동의가 필요해요',
      });

      await escapeFrom('서비스 이용을 위해 동의가 필요해요');
      expect(header('프로필 등록')).toBeOnTheScreen();

      await escapeFrom('프로필 등록');
      expect(
        await screen.findByRole('header', { name: LOGIN_TITLE }),
      ).toBeOnTheScreen();
    });
  });
});
