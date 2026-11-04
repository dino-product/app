import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Alert,
  BackHandler,
  Dimensions,
  type AlertButton,
} from 'react-native';
import { escapeFrom, escapeTarget } from '../../jest/voiceOver';
import { formatJoinDate } from '../features/my/model';
import {
  readRecentLoginMethod,
  readSignedInStep,
  saveRecentLoginMethod,
  saveSignedInStep,
} from '../features/onboarding/login';
import { profileQueryKey } from '../features/onboarding/profileApi';
import { saveRejectDraft } from '../features/schedule/rejectDraft';
import { colors } from '../shared/design-system';
import { appStorage } from '../shared/storage/appStorage';
import {
  fail,
  noContent,
  ok,
  type FakeResponse,
} from '../shared/testing/fakeServer';
import {
  accountProfile,
  accountServer,
  ELIGIBILITY_PATH,
  fixAppTestClock,
  LOGOUT_PATH,
  PROFILE_PATH,
  relaunch,
  renderApp,
  renderSignedInApp,
  signedInSession,
  WITHDRAWALS_PATH,
} from './testing';

// 마이 탭(#72). 네이티브 스택은 아래 화면을 스크린리더에서만 숨기므로
// "지금 보이는 화면" 은 헤더가 접근성 트리에 있는지로 확인한다 (App.test 와 같은 방식)
const header = (name: string) => screen.queryByRole('header', { name });
const tab = (name: string) => screen.getByRole('tab', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

// 프리셋의 Alert 는 네이티브 목으로 이어지므로 띄우지 않게 막는다
const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const pressAlertButton = async (
  alert: ReturnType<typeof spyAlert>,
  text: string,
) => {
  const buttons: AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
  await act(() => buttons.find(item => item.text === text)?.onPress?.());
};

// 응답을 테스트가 정한 때에 준다
function deferred() {
  let answer: (response: FakeResponse) => void = () => {};
  const response = new Promise<FakeResponse>(resolve => {
    answer = resolve;
  });
  return { response, answer };
}

// 가입을 마친 계정(박기사)으로 켜서 마이 탭을 열고 프로필·소속을 받을 때까지 기다린다.
// 알림센터·알림 설정은 서버에서 받는다 (#117, 가짜 서버는 accountServer 가 정한다)
async function openMyPage(
  options: Parameters<typeof renderSignedInApp>[0] = {},
) {
  const app = await renderSignedInApp(options);
  await userEvent.press(tab('마이'));
  await screen.findByRole('button', { name: /^박기사/ });
  await screen.findByLabelText('오르빗 설비, 기사, 활성');
  return app;
}

// 마이페이지에서 바로 여는 하위 화면: [누를 버튼, 열린 화면 제목]
const subScreens = [
  ['알림센터', '알림센터'],
  [/^박기사/, '프로필 수정'],
  ['알림 설정', '알림 설정'],
  ['약관 및 앱 정보', '약관 및 앱 정보'],
  ['계정 관리', '계정 관리'],
] as const;

fixAppTestClock();

describe('App — 마이 탭', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('하단 탭 마이를 누르면 마이페이지가 열리고 탭이 활성이다', async () => {
    await openMyPage();

    expect(header('마이페이지')).toBeOnTheScreen();
    expect(tab('마이')).toBeSelected();
    expect(header('내 작업')).not.toBeOnTheScreen();
  });

  it('마이페이지는 회색 배경이라 탭 바 둥근 모서리 뒤도 회색이다', async () => {
    await openMyPage();

    expect(screen.getByTestId('main-tab-bar')).toHaveStyle({
      backgroundColor: colors.background[3],
    });

    await userEvent.press(button('알림 설정'));
    expect(screen.getByTestId('main-tab-bar')).toHaveStyle({
      backgroundColor: colors.white[100],
    });
  });

  it.each(subScreens)(
    '%s 를 누르면 탭 바가 있는 %s 로 가고, 뒤로 가기로 돌아온다',
    async (name, title) => {
      await openMyPage();

      await userEvent.press(button(name));
      expect(header(title)).toBeOnTheScreen();
      expect(header('마이페이지')).not.toBeOnTheScreen();
      expect(tab('마이')).toBeSelected();

      await userEvent.press(button('뒤로 가기'));
      expect(header('마이페이지')).toBeOnTheScreen();
      expect(header(title)).not.toBeOnTheScreen();
    },
  );

  // 신청 현황·조직 참여 화면은 App.org.test (#73)

  describe('프로필·소속 (#115)', () => {
    it('마이페이지는 서버 프로필의 이름·연락처·가입일과 서버 소속 발주사를 보여준다', async () => {
      await openMyPage();

      const card = button(/^박기사/);
      expect(card).toHaveAccessibleName(
        `박기사, 010-1234-5678, 가입일 ${formatJoinDate(
          accountProfile().signedUpAt as string,
        )}`,
      );
      expect(
        screen.getByLabelText('오르빗 설비, 기사, 활성'),
      ).toBeOnTheScreen();
    });

    // 켤 때 가입 단계 확인(AuthProvider)과 마이페이지가 같은 캐시를 쓴다
    it('켤 때 확인한 프로필을 마이페이지가 다시 요청하지 않는다', async () => {
      const app = await openMyPage();

      expect(app.server.callsTo('GET', PROFILE_PATH)).toHaveLength(1);
    });

    it('보던 마이페이지로 다시 켜도 가입 단계 확인과 마이페이지가 프로필을 한 번만 요청한다', async () => {
      const app = await openMyPage();
      const before = app.server.callsTo('GET', PROFILE_PATH).length;

      await relaunch(app);

      expect(
        await screen.findByRole('button', { name: /^박기사/ }),
      ).toBeOnTheScreen();
      expect(app.server.callsTo('GET', PROFILE_PATH)).toHaveLength(before + 1);
    });

    it('프로필을 저장하면 PUT 응답으로 마이페이지와 로그인 상태의 프로필이 바뀌고 돌아온다', async () => {
      const app = await openMyPage();

      await userEvent.press(button(/^박기사/));
      await userEvent.clear(screen.getByLabelText('이름'));
      await userEvent.type(screen.getByLabelText('이름'), '이기사');
      await userEvent.clear(screen.getByLabelText('연락처'));
      await userEvent.type(screen.getByLabelText('연락처'), '01098765432');
      await userEvent.press(button('저장하기'));

      expect(
        await screen.findByRole('header', { name: '마이페이지' }),
      ).toBeOnTheScreen();
      expect(button(/^이기사/)).toHaveAccessibleName(
        /^이기사, 010-9876-5432, 가입일/,
      );
      expect(app.server.callsTo('PUT', PROFILE_PATH)[0].body).toEqual({
        name: '이기사',
        phoneNumber: '01098765432',
      });
      expect(app.queryClient.getQueryData(profileQueryKey)).toMatchObject({
        name: '이기사',
        phoneNumber: '01098765432',
      });
      // 저장 응답으로 바꿨으니 다시 받지 않는다
      expect(app.server.callsTo('GET', PROFILE_PATH)).toHaveLength(1);
    });

    it('저장에 실패하면 프로필 수정에 머물고 마이페이지 값은 그대로다', async () => {
      const alert = spyAlert();
      const app = await openMyPage();
      app.server.on('PUT', PROFILE_PATH, fail(409, 'COMMON-409'));

      await userEvent.press(button(/^박기사/));
      await userEvent.clear(screen.getByLabelText('이름'));
      await userEvent.type(screen.getByLabelText('이름'), '이기사');
      await userEvent.press(button('저장하기'));

      await waitFor(() => expect(alert).toHaveBeenCalled());
      expect(header('프로필 수정')).toBeOnTheScreen();
      expect(app.queryClient.getQueryData(profileQueryKey)).toMatchObject({
        name: '박기사',
      });
    });

    // 저장 결과는 화면을 떠났어도 로그인 상태·프로필 캐시에 반영한다 (TanStack v5 는 떠난 화면의 mutate 콜백을 부르지 않는다)
    it('저장을 기다리는 동안 뒤로 가도, 성공하면 마이페이지에 바로 반영된다', async () => {
      const pending = deferred();
      const app = await openMyPage();
      app.server.on('PUT', PROFILE_PATH, () => pending.response);

      await userEvent.press(button(/^박기사/));
      await userEvent.clear(screen.getByLabelText('이름'));
      await userEvent.type(screen.getByLabelText('이름'), '이기사');
      await userEvent.press(button('저장하기'));
      await userEvent.press(button('뒤로 가기'));
      expect(header('마이페이지')).toBeOnTheScreen();
      await act(async () =>
        pending.answer(ok({ ...accountProfile(), name: '이기사' })),
      );

      expect(
        await screen.findByRole('button', { name: /^이기사/ }),
      ).toBeOnTheScreen();
      expect(app.server.callsTo('PUT', PROFILE_PATH)).toHaveLength(1);
      expect(app.queryClient.getQueryData(profileQueryKey)).toMatchObject({
        name: '이기사',
      });
    });

    // 켤 때 확인(1)이 실패하면 마이페이지를 열 때 한 번 더 묻고(2), 그래도 실패하면 다시 시도(3)로 받는다
    it('켤 때 프로필 확인에 실패했으면 마이페이지가 다시 받고, 또 실패하면 다시 시도로 받아 온다', async () => {
      saveSignedInStep('COMPLETED');
      const app = await renderApp({
        server: accountServer().on(
          'GET',
          PROFILE_PATH,
          fail(503, 'COMMON-503'),
          fail(503, 'COMMON-503'),
          ok(accountProfile()),
        ),
        session: signedInSession(),
      });
      await waitFor(() =>
        expect(app.server.callsTo('GET', PROFILE_PATH)).toHaveLength(1),
      );

      await userEvent.press(tab('마이'));
      expect(
        await screen.findByText('프로필을 불러오지 못했어요.'),
      ).toBeOnTheScreen();
      // 로그인 화면으로 가지 않고 메인에 머문다
      expect(tab('마이')).toBeSelected();
      await userEvent.press(button('다시 시도'));

      expect(
        await screen.findByRole('button', { name: /^박기사/ }),
      ).toBeOnTheScreen();
      expect(app.server.callsTo('GET', PROFILE_PATH)).toHaveLength(3);
    });
  });

  it('알림 설정은 바로 반영되고 서버에 저장돼 다녀와도 남아 있다', async () => {
    const { server } = await openMyPage();

    await userEvent.press(button('알림 설정'));
    await userEvent.press(
      await screen.findByRole('switch', { name: '일정 변경 알림' }),
    );
    await waitFor(() =>
      expect(
        server.callsTo('PUT', '/api/v1/notification-settings'),
      ).toHaveLength(1),
    );
    await userEvent.press(button('뒤로 가기'));
    await userEvent.press(button('알림 설정'));

    expect(
      await screen.findByRole('switch', { name: '일정 변경 알림' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('switch', { name: '작업 배정 알림' }),
    ).toBeChecked();
  });

  // 작업 알림은 홈 탭의 작업 상세를 연다 (참여 거절 알림은 거절 화면을 연다, App.org.test)
  it('알림센터에서 작업 알림을 누르면 홈 탭의 작업 상세가 열리고, 마이 탭에 돌아오면 읽음이다', async () => {
    await openMyPage();

    await userEvent.press(button('알림센터'));
    const unread = () => screen.getAllByRole('button', { name: /^읽지 않음/ });
    await userEvent.press(
      await screen.findByRole('button', { name: /^읽지 않음, 작업 취소/ }),
    );
    expect(
      await screen.findByRole('header', { name: '작업 상세' }),
    ).toBeOnTheScreen();
    expect(tab('홈')).toBeSelected();

    await userEvent.press(tab('마이'));
    expect(header('알림센터')).toBeOnTheScreen();
    expect(button(/^작업 취소/)).toBeOnTheScreen();
    expect(unread()).toHaveLength(3);
  });

  // 수락 대기(배정됨) 작업은 수락·거절하는 요청 상세(탭 바 없는 화면)로 연다. 뒤로 가면 마이 탭의 알림센터다
  it('알림센터에서 배정됨 작업 알림을 누르면 요청 상세가 열리고, 뒤로 가면 알림센터로 돌아온다', async () => {
    await openMyPage();

    await userEvent.press(button('알림센터'));
    await userEvent.press(
      await screen.findByRole('button', {
        name: /^읽지 않음, 신규 배정, \[보일러 점검\]/,
      }),
    );

    expect(
      await screen.findByRole('button', { name: '수락' }),
    ).toBeOnTheScreen();
    await userEvent.press(button('뒤로 가기'));
    expect(header('알림센터')).toBeOnTheScreen();
    expect(tab('마이')).toBeSelected();
  });

  // 서버 신청 현황에 없는 참여 요청(이미 처리돼 사라짐 등)의 거절 알림. 빈 거절 화면을 남기지 않고 알림센터로 돌아온다
  it('참여 거절 알림의 요청을 찾지 못하면 거절 화면 대신 알림센터로 돌아온다', async () => {
    await openMyPage({
      notifications: [
        {
          id: 1,
          type: 'PARTICIPATION_REQUEST_REJECTED',
          organizationId: 2,
          workId: null,
          participationRequestId: 99,
          message: '[사라진 회사] 참여 요청이 거절되었습니다.',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    await userEvent.press(button('알림센터'));
    await userEvent.press(
      await screen.findByRole('button', { name: /참여 요청이 거절되었습니다/ }),
    );

    await waitFor(() => expect(header('알림센터')).toBeOnTheScreen());
    expect(header('참여 요청이 거절되었어요')).not.toBeOnTheScreen();
    expect(tab('마이')).toBeSelected();
  });

  it('약관 주소가 아직 없어 약관 행은 비활성이고 앱 버전을 보여준다', async () => {
    await openMyPage();

    await userEvent.press(button('약관 및 앱 정보'));

    expect(button('서비스 이용약관')).toBeDisabled();
    expect(screen.getByText('현재 버전 1.0')).toBeOnTheScreen();
  });

  // 로그인 흐름(#85): 로그아웃하면 탭 없이 로그인 화면으로 간다
  it('로그아웃을 확인하면 로그인 화면으로 간다', async () => {
    await openMyPage();

    await userEvent.press(button('계정 관리'));
    await userEvent.press(button('로그아웃'));
    await userEvent.press(button('확인'));

    expect(header('오늘의 현장, 한눈에. Orbit')).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: '홈' })).not.toBeOnTheScreen();
    expect(header('계정 관리')).not.toBeOnTheScreen();
  });

  describe('계정 탈퇴 (#115)', () => {
    const NO_REASON =
      '지금은 탈퇴를 막는 사유가 없어요. 계정 관리에서 다시 시도해 주세요.';
    const withdrawable = { withdrawable: true, blocks: [] };
    const blockedBy = (reason: string, count: number) => ({
      withdrawable: false,
      blocks: [{ reason, count }],
    });

    /** 마이페이지 › 계정 관리 › 계정 탈퇴. 가능 여부는 서버가 정한다 */
    async function pressWithdraw(...eligibility: object[]) {
      const app = await openMyPage();
      app.server.on(
        'GET',
        ELIGIBILITY_PATH,
        ...eligibility.map(value => ok(value)),
      );
      await userEvent.press(button('계정 관리'));
      await userEvent.press(button('계정 탈퇴'));
      return app;
    }

    /** 탈퇴하기 → 최종 확인의 탈퇴 */
    async function confirmWithdraw(alert: ReturnType<typeof spyAlert>) {
      await userEvent.press(
        await screen.findByRole('button', { name: '탈퇴하기' }),
      );
      await pressAlertButton(alert, '탈퇴');
    }

    it('가능 여부 API 가 응답 필요 사유를 주면 탈퇴 불가에 그 건수를 보이고, > 를 누르면 내 일정의 응답 필요로 간다', async () => {
      const app = await pressWithdraw(blockedBy('WORK_PENDING_ACCEPT', 2));

      expect(
        await screen.findByRole('header', { name: '계정 탈퇴 불가' }),
      ).toBeOnTheScreen();
      expect(app.server.callsTo('GET', ELIGIBILITY_PATH)).toHaveLength(1);
      // 있는 사유만 카드로 보인다
      expect(
        screen.queryByTestId('withdrawal-block-WORK_IN_PROGRESS'),
      ).toBeNull();
      expect(
        screen.getByText('수락 대기 중인 작업 2건이 있습니다'),
      ).toBeOnTheScreen();
      await userEvent.press(button('미완료 작업 배정 2건 보기'));

      expect(header('내 일정')).toBeOnTheScreen();
      expect(tab('내 일정')).toBeSelected();
      expect(screen.getByRole('tab', { name: /^응답 필요/ })).toBeSelected();
    });

    it('사유를 정리하러 갔다가 돌아오면 가능 여부를 다시 물어 탈퇴 불가 화면의 사유도 바뀐다', async () => {
      const app = await pressWithdraw(
        blockedBy('WORK_PENDING_ACCEPT', 2),
        withdrawable,
      );
      await userEvent.press(
        await screen.findByRole('button', { name: /^미완료 작업 배정/ }),
      );
      expect(header('내 일정')).toBeOnTheScreen();

      await userEvent.press(tab('마이'));

      expect(header('계정 탈퇴 불가')).toBeOnTheScreen();
      expect(await screen.findByText(NO_REASON)).toBeOnTheScreen();
      expect(
        screen.queryByTestId('withdrawal-block-WORK_PENDING_ACCEPT'),
      ).toBeNull();
      expect(app.server.callsTo('GET', ELIGIBILITY_PATH)).toHaveLength(2);
    });

    it('진행 중인 작업이 있으면 그 사유가 보이고, > 를 누르면 홈으로 간다', async () => {
      await pressWithdraw(blockedBy('WORK_IN_PROGRESS', 1));

      await userEvent.press(
        await screen.findByRole('button', {
          name: '진행 중인 작업 1건 보기',
        }),
      );

      expect(header('내 작업')).toBeOnTheScreen();
      expect(tab('홈')).toBeSelected();
    });

    it('유일한 총관리자이면 그 사유와 발주사 수를 보인다', async () => {
      await pressWithdraw(blockedBy('SOLE_OWNER', 2));

      expect(
        await screen.findByText('총관리자가 나 혼자인 발주사 2곳이 있습니다'),
      ).toBeOnTheScreen();
    });

    it('가능 여부를 확인하지 못하면 계정 관리에 머물러 알린다', async () => {
      const alert = spyAlert();
      const app = await openMyPage();
      app.server.on('GET', ELIGIBILITY_PATH, fail(500, 'COMMON-500'));

      await userEvent.press(button('계정 관리'));
      await userEvent.press(button('계정 탈퇴'));

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '탈퇴할 수 있는지 확인하지 못했어요',
          '잠시 후 다시 시도해 주세요.',
        ),
      );
      expect(header('계정 관리')).toBeOnTheScreen();
    });

    it('막는 사유가 없으면 계정 탈퇴로 가고, 사유를 보내 204 면 기기 세션·캐시·표식·초안·최근 로그인 표시를 지우고 로그인 화면으로 간다', async () => {
      const alert = spyAlert();
      saveRecentLoginMethod('KAKAO');
      saveRejectDraft('request-1', { selected: 'other', otherText: '고장' });
      const app = await pressWithdraw(withdrawable);
      app.server.on('POST', WITHDRAWALS_PATH, noContent());
      expect(
        await screen.findByRole('header', {
          name: '정말 Orbit을 탈퇴하시겠습니까?',
        }),
      ).toBeOnTheScreen();
      expect(tab('마이')).toBeSelected();

      await userEvent.type(
        screen.getByLabelText('탈퇴 사유 입력'),
        '더 이상 쓰지 않아요',
      );
      await confirmWithdraw(alert);

      expect(
        await screen.findByRole('header', {
          name: '오늘의 현장, 한눈에. Orbit',
        }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole('tab', { name: '홈' })).not.toBeOnTheScreen();
      expect(app.server.callsTo('POST', WITHDRAWALS_PATH)[0]).toMatchObject({
        headers: expect.objectContaining({ Authorization: 'Bearer access-1' }),
        body: { reason: '더 이상 쓰지 않아요' },
      });
      expect(app.tokenStore.current).toBeNull();
      expect(readSignedInStep()).toBeNull();
      expect(readRecentLoginMethod()).toBeNull();
      expect(screen.queryByText('최근에 로그인 했어요!')).toBeNull();
      expect(app.queryClient.getQueryData(profileQueryKey)).toBeUndefined();
      expect(
        appStorage.getAllKeys().filter(key => key.includes('Draft')),
      ).toEqual([]);
    });

    it('탈퇴가 PROFILE-006 이면 가능 여부를 다시 물어 탈퇴 불가 화면으로 가고, 뒤로 가면 계정 관리다', async () => {
      const alert = spyAlert();
      const app = await pressWithdraw(
        withdrawable,
        blockedBy('WORK_IN_PROGRESS', 1),
      );
      app.server.on('POST', WITHDRAWALS_PATH, fail(409, 'PROFILE-006'));

      await confirmWithdraw(alert);

      expect(
        await screen.findByRole('header', { name: '계정 탈퇴 불가' }),
      ).toBeOnTheScreen();
      expect(
        await screen.findByText('현재 작업 중 상태인 작업 1건이 있습니다'),
      ).toBeOnTheScreen();
      expect(app.server.callsTo('GET', ELIGIBILITY_PATH)).toHaveLength(2);
      expect(app.tokenStore.current).not.toBeNull();

      // 계정 탈퇴 화면을 바꿔 열었으니 뒤로 가면 그 아래 계정 관리다 (두 화면 모두 제목이 계정 관리라 메뉴로 본다)
      await userEvent.press(button('뒤로 가기'));
      expect(header('계정 탈퇴 불가')).not.toBeOnTheScreen();
      expect(header('정말 Orbit을 탈퇴하시겠습니까?')).not.toBeOnTheScreen();
      expect(button('로그아웃')).toBeOnTheScreen();
    });

    it('탈퇴가 다른 이유로 실패하면 계정 탈퇴에 머물러 알리고 로그인해 둔 채다', async () => {
      const alert = spyAlert();
      const app = await pressWithdraw(withdrawable);
      app.server.on('POST', WITHDRAWALS_PATH, fail(500, 'COMMON-500'));

      await confirmWithdraw(alert);

      await waitFor(() =>
        expect(alert).toHaveBeenLastCalledWith(
          '탈퇴하지 못했어요',
          '잠시 후 다시 시도해 주세요.',
        ),
      );
      expect(header('정말 Orbit을 탈퇴하시겠습니까?')).toBeOnTheScreen();
      expect(app.tokenStore.current).not.toBeNull();
    });

    // 보내는 동안 떠나면 204 를 받아도 세션을 끝내지 못한다. 떠나지 못하게 막고, 떠났어도 세션 종료는 화면과 상관없이 한다
    it('보내는 동안 뒤로 가기(머리·Android 뒤로가기·iOS 스와이프)는 막히고, 204 면 로그인 화면으로 가고 최근 로그인 표시를 지운다', async () => {
      const alert = spyAlert();
      type Handler = Parameters<typeof BackHandler.addEventListener>[1];
      const handlers = new Set<Handler>();
      jest
        .spyOn(BackHandler, 'addEventListener')
        .mockImplementation((_event, handler) => {
          handlers.add(handler);
          return { remove: () => handlers.delete(handler) };
        });
      saveRecentLoginMethod('KAKAO');
      const pending = deferred();
      const app = await pressWithdraw(withdrawable);
      app.server.on('POST', WITHDRAWALS_PATH, () => pending.response);

      await confirmWithdraw(alert);
      await userEvent.press(button('뒤로 가기'));
      await act(() => {
        [...handlers]
          .reverse()
          .some(handler => handler(undefined as never) === true);
      });

      const title = '정말 Orbit을 탈퇴하시겠습니까?';
      expect(header(title)).toBeOnTheScreen();
      let nativeScreen = screen.getByRole('header', { name: title }).parent;
      while (nativeScreen && !nativeScreen.props.onNativeDismissCancelled) {
        nativeScreen = nativeScreen.parent;
      }
      expect(nativeScreen?.props.preventNativeDismiss).toBe(true);

      await act(async () => pending.answer(noContent()));

      expect(
        await screen.findByRole('header', {
          name: '오늘의 현장, 한눈에. Orbit',
        }),
      ).toBeOnTheScreen();
      expect(app.server.callsTo('POST', WITHDRAWALS_PATH)).toHaveLength(1);
      expect(readRecentLoginMethod()).toBeNull();
      expect(app.tokenStore.current).toBeNull();
      // 서버가 이미 모든 토큰을 거부하므로 로그아웃 요청은 보내지 않는다
      expect(app.server.callsTo('POST', LOGOUT_PATH)).toHaveLength(0);
    });

    // 동시에 두 번 보내면 늦은 쪽이 COMMON-409(이미 탈퇴됨)를 받는다 (api-spec P6)
    it('탈퇴가 COMMON-409(이미 탈퇴됨)이면 탈퇴를 마친 것으로 보고 로그인 화면으로 간다', async () => {
      const alert = spyAlert();
      const app = await pressWithdraw(withdrawable);
      app.server.on('POST', WITHDRAWALS_PATH, fail(409, 'COMMON-409'));

      await confirmWithdraw(alert);

      expect(
        await screen.findByRole('header', {
          name: '오늘의 현장, 한눈에. Orbit',
        }),
      ).toBeOnTheScreen();
      expect(app.tokenStore.current).toBeNull();
      expect(alert).toHaveBeenCalledTimes(1);
    });
  });

  describe('하위 화면 공통', () => {
    // 네이티브 화면은 받는 영역(start ≤ x ≤ end) 밖의 스와이프를 거절한다
    const swipeArea = (title: string) => {
      let node = screen.getByRole('header', { name: title }).parent;
      while (node && !node.props.gestureResponseDistance) {
        node = node.parent;
      }
      return node?.props.gestureResponseDistance;
    };

    it.each(subScreens)(
      '%s → %s 도 iOS 스와이프는 왼쪽 1/3 에서만 받는다',
      async (name, title) => {
        await openMyPage();

        await userEvent.press(button(name));

        expect(swipeArea(title)).toEqual(
          expect.objectContaining({
            start: -1,
            end: Dimensions.get('window').width / 3,
          }),
        );
      },
    );

    it.each(subScreens)(
      '%s → %s 에서 두 손가락 Z 로 마이페이지에 돌아온다',
      async (name, title) => {
        await openMyPage();
        expect(escapeTarget('마이페이지')).toBeNull();

        await userEvent.press(button(name));
        await escapeFrom(title);

        expect(header('마이페이지')).toBeOnTheScreen();
        expect(header(title)).not.toBeOnTheScreen();
      },
    );

    it.each(subScreens)(
      '%s → %s 가 열리면 전환이 끝난 뒤 스크린리더 포커스가 제목으로 간다',
      async (name, title) => {
        const focus = jest
          .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
          .mockClear();
        await openMyPage();

        await userEvent.press(button(name));
        expect(focus).not.toHaveBeenCalled();
        await fireEvent(screen.getByRole('header', { name: title }), 'appear');

        expect(focus).toHaveBeenCalledWith(
          expect.objectContaining({
            props: expect.objectContaining({ children: title }),
          }),
          'focus',
        );
      },
    );

    it('Android 뒤로가기: 하위 화면은 마이페이지로, 마이페이지는 홈 탭으로 간다', async () => {
      type Handler = Parameters<typeof BackHandler.addEventListener>[1];
      const handlers = new Set<Handler>();
      jest
        .spyOn(BackHandler, 'addEventListener')
        .mockImplementation((_event, handler) => {
          handlers.add(handler);
          return { remove: () => handlers.delete(handler) };
        });
      const pressBack = async () => {
        let handled = false;
        await act(() => {
          handled = [...handlers]
            .reverse()
            .some(handler => handler(undefined as never) === true);
        });
        return handled;
      };
      await openMyPage();
      await userEvent.press(button('계정 관리'));

      expect(await pressBack()).toBe(true);
      expect(header('마이페이지')).toBeOnTheScreen();

      expect(await pressBack()).toBe(true);
      await waitFor(() => expect(tab('홈')).toBeSelected());
      expect(header('내 작업')).toBeOnTheScreen();
    });

    // 계정 관리 아래의 두 화면도 같은 스택 설정을 쓴다
    const deepScreens = [
      ['계정 탈퇴', '정말 Orbit을 탈퇴하시겠습니까?'],
      ['계정 탈퇴 불가', '계정 탈퇴 불가'],
    ] as const;
    // 서버 가능 여부에 따라 계정 탈퇴·탈퇴 불가로 간다
    async function openDeep(name: (typeof deepScreens)[number][0]) {
      const app = await openMyPage();
      app.server.on(
        'GET',
        ELIGIBILITY_PATH,
        ok(
          name === '계정 탈퇴'
            ? { withdrawable: true, blocks: [] }
            : {
                withdrawable: false,
                blocks: [{ reason: 'WORK_IN_PROGRESS', count: 1 }],
              },
        ),
      );
      await userEvent.press(button('계정 관리'));
      await userEvent.press(button('계정 탈퇴'));
    }

    it.each(deepScreens)(
      '%s 도 스와이프는 왼쪽 1/3, 열리면 제목 포커스, 두 손가락 Z 로 계정 관리에 돌아온다',
      async (name, title) => {
        const focus = jest
          .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
          .mockClear();
        await openDeep(name);
        const opened = await screen.findByRole('header', { name: title });

        expect(swipeArea(title)).toEqual(
          expect.objectContaining({
            start: -1,
            end: Dimensions.get('window').width / 3,
          }),
        );
        await fireEvent(opened, 'appear');
        expect(focus).toHaveBeenLastCalledWith(
          expect.objectContaining({
            props: expect.objectContaining({ accessibilityRole: 'header' }),
          }),
          'focus',
        );

        await escapeFrom(title);
        expect(header('계정 관리')).toBeOnTheScreen();
        expect(header(title)).not.toBeOnTheScreen();
      },
    );

    it('하위 화면에서 마이 탭을 다시 누르면 마이페이지로 돌아간다', async () => {
      await openMyPage();

      await userEvent.press(button('계정 관리'));
      await userEvent.press(tab('마이'));

      expect(
        await screen.findByRole('header', { name: '마이페이지' }),
      ).toBeOnTheScreen();
      expect(header('계정 관리')).not.toBeOnTheScreen();
    });
  });
});
