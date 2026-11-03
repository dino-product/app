import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import {
  Alert,
  BackHandler,
  NativeModules,
  Platform,
  type AlertButton,
} from 'react-native';
import { escapeFrom } from '../../jest/voiceOver';
import App from './App';

// 온보딩 (#85). 앱을 처음 켜면 로그인부터 시작한다. "지금 보이는 화면" 은 헤더가 접근성 트리에 있는지로 확인한다
const header = (name: string) => screen.queryByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const LOGIN_TITLE = '오늘의 현장, 한눈에. Orbit';

// 바텀시트 애니메이션(프리셋의 네이티브 애니메이션 목)은 테스트가 끝낸다
let runningAnimations: Array<(result: { finished: boolean }) => void> = [];
const finishAnimations = () =>
  act(() => {
    runningAnimations.splice(0).forEach(end => end({ finished: true }));
  });

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

beforeEach(() => {
  runningAnimations = [];
  jest
    .spyOn(NativeModules.NativeAnimatedModule, 'startAnimatingNode')
    .mockImplementation((...args: unknown[]) => {
      runningAnimations.push(
        args[3] as (result: { finished: boolean }) => void,
      );
    });
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

async function login(name: '카카오로 시작하기' | 'Apple로 시작하기') {
  await userEvent.press(button(name));
}

async function registerProfile() {
  await userEvent.type(screen.getByLabelText('이름'), '박기사');
  await userEvent.type(screen.getByLabelText('연락처'), '01012345678');
  await userEvent.press(button('완료'));
}

async function agreeTerms() {
  await userEvent.press(
    screen.getByRole('checkbox', { name: '모든 약관에 동의합니다.' }),
  );
  await userEvent.press(button('가입하기'));
}

// 회사 찾기로 돌아오면 앞서 넣은 코드가 입력칸에 남아 있다
async function findCompany(code: string) {
  await userEvent.clear(screen.getByLabelText('회사 코드 입력'));
  await userEvent.type(screen.getByLabelText('회사 코드 입력'), code);
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
  await render(<App />);
  await login('카카오로 시작하기');
  await registerProfile();
  await agreeTerms();
  await findCompany(code);
  await requestAs(type);
}

async function approveAndStart() {
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
}

describe('App — 온보딩', () => {
  it('처음 켜면 하단 탭 없이 로그인 화면이 열리고, iOS 는 카카오·Apple 버튼이 다 보인다', async () => {
    await render(<App />);

    expect(header(LOGIN_TITLE)).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: '홈' })).not.toBeOnTheScreen();
    expect(button('카카오로 시작하기')).toBeOnTheScreen();
    expect(button('Apple로 시작하기')).toBeOnTheScreen();
  });

  it('Android 에서는 카카오 버튼만 보인다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await render(<App />);

    expect(button('카카오로 시작하기')).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Apple로 시작하기' }),
    ).not.toBeOnTheScreen();
  });

  it('첫 실행부터 프로필·약관·회사 참여를 지나 메인(홈 탭)까지 한 번에 간다', async () => {
    await render(<App />);

    await login('카카오로 시작하기');
    expect(header('프로필 등록')).toBeOnTheScreen();

    await registerProfile();
    expect(header('서비스 이용을 위해 동의가 필요해요')).toBeOnTheScreen();

    await agreeTerms();
    expect(header('회사 참여')).toBeOnTheScreen();
    expect(header('회사 찾기')).toBeOnTheScreen();

    await findCompany('123456');
    expect(
      await screen.findByRole('header', { name: '역할을 선택해주세요' }),
    ).toBeOnTheScreen();
    expect(header('참여 요청')).toBeOnTheScreen();
    expect(screen.getByText('Orbit')).toBeOnTheScreen();

    await requestAs('기사');
    expect(header('승인 대기')).toBeOnTheScreen();
    expect(header('참여 요청을 보냈어요')).toBeOnTheScreen();

    await userEvent.press(button('확인'));
    expect(header('참여 완료')).toBeOnTheScreen();
    expect(header('Orbit 참여 승인 완료')).toBeOnTheScreen();

    await userEvent.press(button('시작하기'));
    expect(header('내 작업')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: '홈' })).toBeSelected();
  });

  it('메인에 들어간 뒤에는 뒤로 가기로 온보딩이나 로그인에 돌아가지 않는다', async () => {
    await requestToJoin();
    await approveAndStart();

    // 메인 첫 화면에서 Android 뒤로가기는 앱을 나간다 (아무도 처리하지 않음)
    expect(await pressBack()).toBe(false);
    expect(header('내 작업')).toBeOnTheScreen();
    expect(header('참여 완료')).not.toBeOnTheScreen();
    expect(header(LOGIN_TITLE)).not.toBeOnTheScreen();
  });

  it('로그아웃하면 로그인으로 가고, 최근 방식에 말풍선이 보이며, 다시 로그인하면 바로 메인으로 간다', async () => {
    await requestToJoin();
    await approveAndStart();

    await logoutFromMyPage();
    expect(header(LOGIN_TITLE)).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('login-KAKAO')).getByText(
        '최근에 로그인 했어요!',
        { includeHiddenElements: true },
      ),
    ).toBeOnTheScreen();

    await login('카카오로 시작하기');
    expect(header('내 작업')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: '홈' })).toBeSelected();
  });

  it('카카오로 가입한 뒤 Apple 로 로그인하면 다른 계정이라 프로필 등록부터 한다', async () => {
    await requestToJoin();
    await approveAndStart();
    await logoutFromMyPage();

    await login('Apple로 시작하기');

    expect(header('프로필 등록')).toBeOnTheScreen();
  });

  it('탈퇴하면 로그인으로 가고, 다시 로그인하면 신규 사용자로 프로필 등록부터 한다', async () => {
    // 프리셋의 Alert 는 네이티브 목으로 이어지므로 띄우지 않게 막고 버튼을 직접 누른다
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await requestToJoin();
    await approveAndStart();
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

    expect(header(LOGIN_TITLE)).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('login-KAKAO')).queryByText(
        '최근에 로그인 했어요!',
        { includeHiddenElements: true },
      ),
    ).not.toBeOnTheScreen();

    await login('카카오로 시작하기');
    expect(header('프로필 등록')).toBeOnTheScreen();
  });

  describe('회사 참여 결과', () => {
    it('없는 코드면 유효하지 않은 회사 코드로 바뀐다', async () => {
      await render(<App />);
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
      await finishAnimations();
      await userEvent.press(
        within(screen.getByTestId('cancel-request-sheet')).getByRole('button', {
          name: '취소',
        }),
      );
      await finishAnimations();

      expect(header('회사 찾기')).toBeOnTheScreen();
      await findCompany('123456');
      expect(
        await screen.findByRole('header', { name: '역할을 선택해주세요' }),
      ).toBeOnTheScreen();
    });

    it('234567 은 요청과 다른 유형으로 승인돼 유형 변경 완료가 보이고, 시작하기로 메인에 간다', async () => {
      await requestToJoin('234567', '기사');

      await userEvent.press(button('확인'));

      expect(header('직원 참여 승인 완료')).toBeOnTheScreen();
      expect(
        screen.getByText('사무실에서 요청하신 유형과 다르게 확정했어요.'),
      ).toBeOnTheScreen();
      await userEvent.press(button('시작하기'));
      expect(header('내 작업')).toBeOnTheScreen();
    });

    it('345678 은 거절되고, 확인을 누르면 회사 찾기로 돌아가 같은 코드로 다시 요청할 수 있다', async () => {
      await requestToJoin('345678');

      await userEvent.press(button('확인'));
      expect(header('참여 요청이 거절되었어요')).toBeOnTheScreen();
      expect(
        screen.getByText('현재 기사 인원이 충분해 요청을 받지 않고 있어요.'),
      ).toBeOnTheScreen();

      await userEvent.press(button('확인'));
      expect(header('회사 찾기')).toBeOnTheScreen();
      await findCompany('345678');
      expect(
        await screen.findByRole('header', { name: '역할을 선택해주세요' }),
      ).toBeOnTheScreen();
    });
  });

  describe('뒤로 가기', () => {
    it('프로필 등록의 뒤로 가기는 로그인으로 돌아가 더미 로그인을 취소한다', async () => {
      await render(<App />);
      await login('카카오로 시작하기');

      await userEvent.press(button('뒤로 가기'));

      expect(header(LOGIN_TITLE)).toBeOnTheScreen();
      expect(header('프로필 등록')).not.toBeOnTheScreen();
    });

    it('온보딩 하위 화면은 Android 뒤로가기로 이전 단계에 간다', async () => {
      await render(<App />);
      await login('카카오로 시작하기');
      await registerProfile();
      await agreeTerms();

      expect(await pressBack()).toBe(true);
      expect(header('서비스 이용을 위해 동의가 필요해요')).toBeOnTheScreen();
      expect(await pressBack()).toBe(true);
      expect(header('프로필 등록')).toBeOnTheScreen();
      expect(await pressBack()).toBe(true);
      await waitFor(() => expect(header(LOGIN_TITLE)).toBeOnTheScreen());
    });

    it('온보딩 하위 화면은 VoiceOver 두 손가락 Z 로 이전 단계에 간다', async () => {
      await render(<App />);
      await login('카카오로 시작하기');
      await registerProfile();

      await escapeFrom('서비스 이용을 위해 동의가 필요해요');
      expect(header('프로필 등록')).toBeOnTheScreen();

      await escapeFrom('프로필 등록');
      expect(header(LOGIN_TITLE)).toBeOnTheScreen();
    });
  });
});
