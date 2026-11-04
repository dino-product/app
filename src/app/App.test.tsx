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
  ActionSheetIOS,
  Alert,
  BackHandler,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  Linking,
  Platform,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { hideKeyboard, showKeyboard } from '../../jest/keyboard';
import {
  pickOnePhotoFromLibrary,
  resetPhotoLibrary,
} from '../../jest/photoPicker';
import { escapeFrom, escapeTarget } from '../../jest/voiceOver';
import type { NotificationResponse } from '../features/my/notificationApi';
import { createHttpWorkRepository } from '../features/work/data/HttpWorkRepository';
import { colors } from '../shared/design-system';
import { createFakeServer, fail } from '../shared/testing/fakeServer';
import { createTestApi } from '../shared/testing/renderWithApi';
import {
  findHomeLoaded,
  findWorkDetailLoaded,
  fixAppTestClock,
  openStartedWorkDetail,
  renderSignedInHome,
  signedInSession,
  testWorkRepository,
} from './testing';

// 네이티브 스택은 아래 화면을 그대로 두고 스크린리더에서만 숨긴다 (aria-hidden).
// 그래서 "지금 보이는 화면" 은 헤더가 접근성 트리에 있는지로 확인한다.
const header = (name: string) => screen.queryByRole('header', { name });
const tab = (name: string) => screen.getByRole('tab', { name });
// 탭 바(tablist)는 accessible 요소가 아니라 역할로 못 찾으므로 탭 버튼으로 확인한다
const tabBar = () => screen.queryByRole('tab', { name: '홈' });

// Android 뒤로가기: RN BackHandler 처럼 나중에 등록한 핸들러부터 부르고, 하나가 처리(true)하면 멈춘다.
// 아무도 처리하지 않으면(false) RN 은 앱을 나간다.
async function renderWithBackButton() {
  type Handler = Parameters<typeof BackHandler.addEventListener>[1];
  const handlers = new Set<Handler>();
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, handler) => {
      handlers.add(handler);
      return { remove: () => handlers.delete(handler) };
    });
  await renderSignedInHome();

  return async () => {
    let handled = false;
    await act(() => {
      // 이벤트 인자는 쓰지 않는다
      handled = [...handlers]
        .reverse()
        .some(handler => handler(undefined as never) === true);
    });
    return handled;
  };
}

// 프리셋의 Alert 는 네이티브 목으로 이어지므로 띄우지 않게 막는다
const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// 진행할 작업을 시작하고 상세에서 완료 보고를 채워 제출한다. 결제 금액·방식은 계획값으로 미리 채워져 있다.
// 결과 모달이 열린 채로 끝난다
async function submitReport() {
  await userEvent.press(screen.getByRole('button', { name: '작업 시작' }));
  await userEvent.press(
    await screen.findByRole('button', { name: '작업 수행중' }),
  );
  await findWorkDetailLoaded();
  await userEvent.press(
    screen.getByRole('button', { name: '작업 전 사진 추가' }),
  );
  await userEvent.press(
    screen.getByRole('button', { name: '작업 후 사진 추가' }),
  );
  await userEvent.press(screen.getByRole('button', { name: '완료보고 제출' }));
  await screen.findByRole('header', { name: '제출 완료' });
}

// 알림센터의 작업 알림 한 줄 (서버 응답 모양)
const workNotification = (
  overrides: Partial<NotificationResponse> = {},
): NotificationResponse => ({
  id: 1,
  type: 'WORK_ASSIGNED',
  organizationId: 1,
  workId: 104,
  participationRequestId: null,
  message: '[에어컨 필터 교체] 작업이 배정되었습니다.',
  read: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

fixAppTestClock();

describe('App', () => {
  beforeEach(pickOnePhotoFromLibrary);

  afterEach(() => {
    jest.restoreAllMocks();
    resetPhotoLibrary();
  });

  it('첫 화면은 작업 수행 메인화면(내 작업)이고 하단 탭은 홈이다', async () => {
    await renderSignedInHome();

    expect(header('내 작업')).toBeOnTheScreen();
    expect(tab('홈')).toBeSelected();
  });

  it('작업을 열면 탭 바가 있는 작업 상세로, 뒤로 가기로 메인화면으로 돌아온다', async () => {
    await renderSignedInHome();

    await openStartedWorkDetail();
    expect(header('작업 상세')).toBeOnTheScreen();
    expect(header('내 작업')).not.toBeOnTheScreen();
    expect(tab('홈')).toBeSelected();

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(header('내 작업')).toBeOnTheScreen();
    expect(header('작업 상세')).not.toBeOnTheScreen();
  });

  it('전환 중에 작업 카드를 한 번 더 눌러도 상세는 하나만 쌓인다', async () => {
    await renderSignedInHome();
    const card = screen.getByRole('button', { name: '보일러 점검 상세 보기' });

    await fireEvent.press(card);
    // 상세가 올라오는 동안 아래 카드가 한 번 더 눌린 경우
    await fireEvent.press(card);
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(header('내 작업')).toBeOnTheScreen();
  });

  // #111 사진 추가 칸은 시스템 선택지를 거쳐 기기의 사진을 붙인다 (회색 자리 목 사진을 넣지 않는다)
  it('완료 보고 사진 추가 칸은 선택지에서 앨범을 골라 남은 칸 수만큼 고른 사진을 붙인다', async () => {
    await renderSignedInHome();
    await openStartedWorkDetail();

    const add = screen.getByRole('button', { name: '작업 전 사진 추가' });
    await userEvent.press(add);

    expect(ActionSheetIOS.showActionSheetWithOptions).toHaveBeenCalledTimes(1);
    expect(launchImageLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ selectionLimit: 6 }),
    );
    expect(add).toHaveAccessibilityValue({ text: '1/6' });
    expect(within(add.parent!).getByTestId('photo-thumb')).toHaveProp(
      'source',
      { uri: 'file:///tmp/photo-1.jpg' },
    );
  });

  it('작업을 시작하고 상세에 다녀와도 "작업 수행중" 이 유지된다', async () => {
    await renderSignedInHome();

    await userEvent.press(screen.getByRole('button', { name: '작업 시작' }));
    await userEvent.press(
      await screen.findByRole('button', { name: '작업 수행중' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(
      screen.getByRole('button', { name: '작업 수행중' }),
    ).toBeOnTheScreen();
  });

  // #96: 탭 화면의 종은 알림센터로 가는 버튼이다. 알림 목록은 서버에서 받는다 (#117)
  describe('내 작업 홈의 종', () => {
    it('누르면 알림센터가 열리고, 뒤로 가면 내 작업 홈으로 돌아온다', async () => {
      await renderSignedInHome();

      await userEvent.press(screen.getByRole('button', { name: '알림센터' }));
      expect(header('알림센터')).toBeOnTheScreen();
      expect(header('내 작업')).not.toBeOnTheScreen();
      expect(tab('홈')).toBeSelected();

      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(header('내 작업')).toBeOnTheScreen();
      expect(header('알림센터')).not.toBeOnTheScreen();
    });

    it('Android 뒤로가기로도 내 작업 홈으로 돌아온다', async () => {
      const pressBack = await renderWithBackButton();

      await userEvent.press(screen.getByRole('button', { name: '알림센터' }));

      expect(await pressBack()).toBe(true);
      expect(header('내 작업')).toBeOnTheScreen();
      expect(header('알림센터')).not.toBeOnTheScreen();
    });

    it('홈에서 읽은 알림은 마이페이지 알림센터에서도 읽음이다 (같은 알림 목록)', async () => {
      await renderSignedInHome();
      const unread = () =>
        screen.getAllByRole('button', { name: /^읽지 않음/ }).length;

      await userEvent.press(screen.getByRole('button', { name: '알림센터' }));
      await screen.findByRole('button', { name: /^읽지 않음, 작업 취소/ });
      const before = unread();
      // 작업 알림은 작업 상세를 연다. 닫고 알림센터·홈으로 돌아온다
      await userEvent.press(
        screen.getByRole('button', { name: /^읽지 않음, 작업 취소/ }),
      );
      await userEvent.press(
        await screen.findByRole('button', { name: '뒤로 가기' }),
      );
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

      await userEvent.press(tab('마이'));
      await userEvent.press(screen.getByRole('button', { name: '알림센터' }));
      expect(header('알림센터')).toBeOnTheScreen();
      await waitFor(() => expect(unread()).toBe(before - 1));
    });

    it('작업 알림을 누르면 그 작업 상세가 열리고, 뒤로 가면 알림센터로 돌아온다', async () => {
      await renderSignedInHome();

      await userEvent.press(screen.getByRole('button', { name: '알림센터' }));
      await userEvent.press(
        await screen.findByRole('button', { name: /^읽지 않음, 작업 취소/ }),
      );

      expect(
        await screen.findByRole('header', { name: '작업 상세' }),
      ).toBeOnTheScreen();
      expect(tab('홈')).toBeSelected();
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(header('알림센터')).toBeOnTheScreen();
      expect(
        await screen.findByRole('button', { name: /^작업 취소/ }),
      ).toBeOnTheScreen();
    });

    // 작업 알림만으로는 작업 상태를 모른다. 상세를 받아 수락 대기(배정됨)면 수락·거절하는 요청 상세로 연다
    it('배정됨(수락 대기) 작업 알림을 누르면 수락·거절하는 요청 상세가 열리고, 뒤로 가면 알림센터로 돌아온다', async () => {
      await renderSignedInHome({
        notifications: [workNotification({ workId: 104 })],
      });

      await userEvent.press(screen.getByRole('button', { name: '알림센터' }));
      await userEvent.press(
        await screen.findByRole('button', { name: /^읽지 않음, 신규 배정/ }),
      );

      expect(
        await screen.findByRole('button', { name: '수락' }),
      ).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: '거절' })).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(header('알림센터')).toBeOnTheScreen();
    });

    // 작업 상세를 미리 받는 동안(어느 화면을 열지 고르는 중)을 시험하려고, 처음 한 번의 상세 조회만 붙잡는다
    function holdFirstDetail() {
      const local = testWorkRepository();
      let release: () => void = () => {};
      const getWorkDetail = jest.fn(
        async (...args: Parameters<typeof local.getWorkDetail>) => {
          if (getWorkDetail.mock.calls.length === 1) {
            await new Promise<void>(resolve => (release = resolve));
          }
          return local.getWorkDetail(...args);
        },
      );
      return {
        workRepository: { ...local, getWorkDetail },
        getWorkDetail,
        release: () => act(() => release()),
      };
    }

    // 고르는 동안 누른 다른 알림은 무시한다 (먼저 누른 알림만 연다)
    it('작업을 받는 동안 다른 작업 알림을 눌러도 먼저 누른 알림만 연다', async () => {
      const held = holdFirstDetail();
      await renderSignedInHome({
        workRepository: held.workRepository,
        notifications: [
          workNotification({ id: 1, workId: 104 }),
          workNotification({
            id: 2,
            type: 'WORK_CANCELED',
            workId: 102,
            message: '[세탁기 설치] 작업이 취소되었습니다.',
          }),
        ],
      });
      await userEvent.press(screen.getByRole('button', { name: '알림센터' }));
      await userEvent.press(
        await screen.findByRole('button', { name: /신규 배정/ }),
      );

      await userEvent.press(screen.getByRole('button', { name: /작업 취소/ }));
      expect(held.getWorkDetail).toHaveBeenCalledTimes(1);
      await held.release();

      expect(
        await screen.findByRole('button', { name: '수락' }),
      ).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(header('알림센터')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
    });

    it('작업을 받는 사이 알림센터를 떠났으면 받은 뒤에도 열지 않는다', async () => {
      const held = holdFirstDetail();
      await renderSignedInHome({
        workRepository: held.workRepository,
        notifications: [workNotification({ workId: 104 })],
      });
      await userEvent.press(screen.getByRole('button', { name: '알림센터' }));
      await userEvent.press(
        await screen.findByRole('button', { name: /신규 배정/ }),
      );

      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      await held.release();

      expect(header('내 작업')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: '수락' })).toBeNull();
      expect(header('작업 상세')).not.toBeOnTheScreen();
    });

    // 다른 기사에게 넘어간 작업(WORK_REASSIGNED_AWAY)은 서버 상세가 SCHEDULE-001(404)이다
    it('다른 기사에게 넘어간 작업 알림을 누르면 작업 상세가 볼 수 없는 작업이라고 알린다', async () => {
      const server = createFakeServer().on(
        'GET',
        '/api/v1/organizations/1/works/150',
        fail(404, 'SCHEDULE-001', { message: '작업을 찾을 수 없습니다.' }),
      );
      // 작업 상세만 실제 서버(HTTP 저장소)로 받고, 홈의 일정은 로컬 저장소 그대로 둔다
      const http = createHttpWorkRepository({
        api: createTestApi({ server, session: signedInSession() }).client,
        organizationId: async () => 1,
      });
      await renderSignedInHome({
        server,
        workRepository: {
          ...testWorkRepository(),
          getWorkDetail: http.getWorkDetail,
        },
        notifications: [
          workNotification({
            type: 'WORK_REASSIGNED_AWAY',
            workId: 150,
            message: '[누수 점검] 작업이 다른 기사에게 배정되었습니다.',
          }),
        ],
      });

      await userEvent.press(screen.getByRole('button', { name: '알림센터' }));
      await userEvent.press(
        await screen.findByRole('button', { name: /^읽지 않음, 배정 변경/ }),
      );

      expect(
        await screen.findByText('볼 수 없는 작업이에요'),
      ).toBeOnTheScreen();
      expect(tab('홈')).toBeSelected();
    });

    it('참여 거절 알림을 누르면 마이 탭의 거절 화면을 연다', async () => {
      await renderSignedInHome();

      await userEvent.press(screen.getByRole('button', { name: '알림센터' }));
      await userEvent.press(
        await screen.findByRole('button', {
          name: /참여 요청이 거절되었습니다/,
        }),
      );

      expect(
        await screen.findByRole('header', { name: '참여 요청이 거절되었어요' }),
      ).toBeOnTheScreen();
      expect(tab('마이')).toBeSelected();
    });
  });

  describe('Android 뒤로가기', () => {
    it('상세에서 누르면 메인화면으로 돌아온다', async () => {
      const pressBack = await renderWithBackButton();

      await openStartedWorkDetail();

      expect(await pressBack()).toBe(true);
      expect(header('내 작업')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
    });

    it('요청 상세(탭 위 루트 스택)에서 누르면 내 일정으로 돌아온다', async () => {
      const pressBack = await renderWithBackButton();

      await userEvent.press(tab('내 일정'));
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );

      expect(await pressBack()).toBe(true);
      expect(header('내 일정')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
    });

    it('다른 탭 첫 화면에서는 홈 탭으로, 홈 첫 화면에서는 앱이 처리하지 않는다(앱 나감)', async () => {
      const pressBack = await renderWithBackButton();

      await userEvent.press(tab('내 일정'));
      expect(await pressBack()).toBe(true);
      expect(tab('홈')).toBeSelected();
      expect(header('내 작업')).toBeOnTheScreen();

      expect(await pressBack()).toBe(false);
      expect(header('내 작업')).toBeOnTheScreen();
    });
  });

  // 로컬 저장소 처음 데이터: 오늘(지금 오후 2시) 보일러 점검 13:40~14:40, 세탁기 설치 15:40~16:40
  it('완료 보고 결제 금액·방식은 작업의 계획값으로 미리 채워져 있다', async () => {
    await renderSignedInHome();

    await openStartedWorkDetail();

    expect(screen.getByLabelText('결제 금액 입력')).toHaveDisplayValue(
      '75,000',
    );
    expect(
      screen.getByRole('button', { name: '결제 방식 선택' }),
    ).toHaveAccessibilityValue({ text: '현장 카드' });
  });

  it('완료 보고를 제출하고 메인으로 돌아오면 다음 작업이 "작업 시작" 으로 온다', async () => {
    const alert = spyAlert();
    await renderSignedInHome();

    await submitReport();
    await userEvent.press(
      screen.getByRole('button', { name: '메인 화면으로' }),
    );

    expect(header('내 작업')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: '세탁기 설치 상세 보기' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '작업 시작' })).toBeOnTheScreen();
    // 제출을 마친 보고는 잃을 입력이 아니라 나갈 때 묻지 않는다
    expect(alert).not.toHaveBeenCalled();
  });

  it('제출한 작업은 이번 주 일정에 완료로 남고, 다시 열면 읽기 전용 제출 완료 상태다', async () => {
    await renderSignedInHome();

    await submitReport();
    await userEvent.press(
      screen.getByRole('button', { name: '메인 화면으로' }),
    );
    expect(
      screen.queryByRole('button', { name: '보일러 점검 상세 보기' }),
    ).not.toBeOnTheScreen();
    await userEvent.press(
      screen.getByRole('button', { name: /^보일러 점검, 완료,/ }),
    );

    expect(
      await screen.findByRole('button', { name: '제출 완료' }),
    ).toBeDisabled();
    expect(header('작업 상세')).toBeOnTheScreen();
    expect(
      screen.getByText(/^제출 시각 \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('결제 금액 입력')).toHaveDisplayValue(
      '75,000',
    );
  });

  describe('작업 시작은 예정 시작 10분 전부터 예정 종료까지만', () => {
    it.each([
      [
        '이르면',
        new Date(2026, 9, 21, 13, 29),
        '아직 시작할 수 없어요. 예정 시작 10분 전부터 시작할 수 있어요.',
      ],
      [
        '예정 종료가 지났으면',
        new Date(2026, 9, 21, 14, 41),
        '예정 종료 시각이 지나 시작할 수 없어요. 사무실에 일정 변경을 요청해 주세요.',
      ],
    ])('%s 그 문구로 알리고 "작업 시작" 그대로다', async (_, at, message) => {
      const alert = spyAlert();
      await renderSignedInHome();
      jest.setSystemTime(at);

      await userEvent.press(screen.getByRole('button', { name: '작업 시작' }));

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith('작업을 시작하지 못했어요', message),
      );
      expect(screen.getByRole('button', { name: '작업 시작' })).toBeEnabled();
      expect(
        screen.queryByRole('button', { name: '작업 수행중' }),
      ).not.toBeOnTheScreen();
    });
  });

  // #114 리뷰: 서버는 작업중인 작업의 완료 보고만 받는다 (그 밖은 -002)
  describe('작업중이 아닌 작업 상세', () => {
    it('작업전이면 보고 영역 대신 시작 안내를 보이고, 입력이 없어 묻지 않고 나간다', async () => {
      const alert = spyAlert();
      await renderSignedInHome();

      await userEvent.press(
        screen.getAllByRole('button', { name: /^세탁기 설치,/ })[0],
      );

      expect(
        await screen.findByText('작업을 시작하면 완료 보고를 쓸 수 있어요'),
      ).toBeOnTheScreen();
      expect(
        screen.queryByRole('button', { name: '완료보고 제출' }),
      ).not.toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(header('내 작업')).toBeOnTheScreen();
      expect(alert).not.toHaveBeenCalled();
    });

    it('상세에서 "작업 시작" 을 누르면 작업중이 되어 계획값으로 채운 보고 영역이 열리고, 홈도 "작업 수행중" 이다', async () => {
      await renderSignedInHome();
      await userEvent.press(
        screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
      );

      await userEvent.press(
        await screen.findByRole('button', { name: '작업 시작' }),
      );

      expect(await findWorkDetailLoaded()).toBeOnTheScreen();
      expect(screen.getByLabelText('결제 금액 입력')).toHaveDisplayValue(
        '75,000',
      );
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(
        await screen.findByRole('button', { name: '작업 수행중' }),
      ).toBeOnTheScreen();
    });

    it('시작 시각 전이면 상세의 "작업 시작" 도 그 문구로 알리고 보고 영역은 잠긴 그대로다', async () => {
      const alert = spyAlert();
      await renderSignedInHome();
      // 세탁기 설치는 15:40 시작이라 지금(14:00)은 이르다
      await userEvent.press(
        screen.getAllByRole('button', { name: /^세탁기 설치,/ })[0],
      );

      await userEvent.press(
        await screen.findByRole('button', { name: '작업 시작' }),
      );

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '작업을 시작하지 못했어요',
          '아직 시작할 수 없어요. 예정 시작 10분 전부터 시작할 수 있어요.',
        ),
      );
      expect(
        screen.getByText('작업을 시작하면 완료 보고를 쓸 수 있어요'),
      ).toBeOnTheScreen();
      expect(
        screen.queryByRole('button', { name: '작업 전 사진 추가' }),
      ).not.toBeOnTheScreen();
    });

    it('예정 종료가 지난 뒤 상세의 "작업 시작" 은 -018 문구로 알리고 보고 영역은 잠긴 그대로다', async () => {
      const alert = spyAlert();
      await renderSignedInHome();
      await userEvent.press(
        screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
      );
      const start = await screen.findByRole('button', { name: '작업 시작' });
      // 보일러 점검은 14:40 에 끝난다
      jest.setSystemTime(new Date(2026, 9, 21, 14, 41));

      await userEvent.press(start);

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '작업을 시작하지 못했어요',
          '예정 종료 시각이 지나 시작할 수 없어요. 사무실에 일정 변경을 요청해 주세요.',
        ),
      );
      expect(
        screen.getByText('작업을 시작하면 완료 보고를 쓸 수 있어요'),
      ).toBeOnTheScreen();
    });

    // 변경 뒤 작업 조회를 새로 받는 일은 useMutation 옵션에 있다. 호출별 콜백(mutate(v, { onSuccess }))은
    // 보낸 화면이 사라지면 불리지 않아, 서버는 받았는데 앱이 옛 상태로 남는다 (#114 리뷰)
    it('상세에서 "작업 시작" 을 보내는 중 뒤로 가도, 서버가 받으면 홈의 진행할 작업이 작업중이 된다', async () => {
      const { workRepository } = await renderSignedInHome();
      const startWork = workRepository.startWork.bind(workRepository);
      let respond = () => {};
      jest.spyOn(workRepository, 'startWork').mockImplementation(
        command =>
          new Promise((resolve, reject) => {
            respond = () => {
              startWork(command).then(resolve, reject);
            };
          }),
      );
      await userEvent.press(
        screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
      );
      await userEvent.press(
        await screen.findByRole('button', { name: '작업 시작' }),
      );

      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      await findHomeLoaded();
      expect(
        screen.getByRole('button', { name: '작업 시작' }),
      ).toBeOnTheScreen();
      await act(async () => respond());

      expect(
        await screen.findByRole('button', { name: '작업 수행중' }),
      ).toBeOnTheScreen();
    });

    it('이번 주 일정의 수락 대기 작업은 수락·거절하는 요청 상세(탭 바 없음)로 연다', async () => {
      await renderSignedInHome();

      await userEvent.press(
        screen.getByRole('button', { name: /^도어록 교체, 배정됨,/ }),
      );

      expect(
        await screen.findByRole('button', { name: '수락' }),
      ).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: '거절' })).toBeOnTheScreen();
      expect(tabBar()).not.toBeOnTheScreen();
      expect(
        screen.queryByText('수락하고 작업을 시작하면 완료 보고를 쓸 수 있어요'),
      ).not.toBeOnTheScreen();
    });
  });

  it('상세에서 지금 탭("홈")을 다시 누르면 그 탭의 첫 화면으로 돌아간다', async () => {
    await renderSignedInHome();

    await openStartedWorkDetail();
    await userEvent.press(tab('홈'));

    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
    expect(header('작업 상세')).not.toBeOnTheScreen();
  });

  it('다른 탭에 다녀와도 탭마다 보던 화면이 남아 있다', async () => {
    await renderSignedInHome();

    await openStartedWorkDetail();
    await userEvent.press(tab('내 일정'));
    expect(header('내 일정')).toBeOnTheScreen();
    expect(header('작업 상세')).not.toBeOnTheScreen();

    await userEvent.press(tab('홈'));
    expect(header('작업 상세')).toBeOnTheScreen();
    expect(header('내 일정')).not.toBeOnTheScreen();
  });

  it('탭을 오가도 작성하던 완료 보고 입력이 남아 있다', async () => {
    await renderSignedInHome();

    await openStartedWorkDetail();
    await userEvent.type(screen.getByLabelText('수행 메모 입력'), '배관 교체');
    await userEvent.press(tab('내 일정'));
    await userEvent.press(tab('홈'));

    expect(screen.getByLabelText('수행 메모 입력')).toHaveDisplayValue(
      '배관 교체',
    );
  });

  // 탭 화면은 떠나도 마운트된 채로 남는다 (예전 수작업 탭 전환은 다른 탭을 언마운트해 날짜·하위 탭·달력 상태가 초기화됐다)
  it('홈에 다녀와도 내 일정에서 고른 하위 탭이 남아 있다', async () => {
    await renderSignedInHome();

    await userEvent.press(tab('내 일정'));
    await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
    await userEvent.press(tab('홈'));
    await userEvent.press(tab('내 일정'));

    expect(screen.getByRole('tab', { name: /^응답 필요/ })).toBeSelected();
  });

  // 가려진 화면도 마운트된 채로 남으므로, 다른 화면에서 키보드를 쓸 때 다시 그리지 않게 구독을 푼다
  describe('Android 키보드 회피는 지금 보이는 화면만 키보드를 듣는다', () => {
    const keyboardListeners = () =>
      DeviceEventEmitter.listenerCount('keyboardDidShow') +
      DeviceEventEmitter.listenerCount('keyboardDidHide');
    // 탭을 옮기면 가려진 화면은 스크린리더에서 숨는다
    const detailBody = () =>
      screen.getByTestId('work-detail-body', { includeHiddenElements: true });

    async function openDetail() {
      jest.replaceProperty(Platform, 'OS', 'android');
      await renderSignedInHome();
      const before = keyboardListeners();
      await openStartedWorkDetail();
      return before;
    }

    afterEach(async () => {
      // Keyboard 모듈은 마지막 키보드 상태를 들고 있어 다음 테스트로 넘어가지 않게 내린다
      await hideKeyboard();
    });

    it('다른 탭에 가면 구독을 풀고, 돌아오면 떠 있는 키보드를 반영한다', async () => {
      const before = await openDetail();
      expect(keyboardListeners()).toBe(before + 2);
      // 스크롤 영역이 화면 위 100 ~ 800 이고 키보드 윗변이 500 이면 300 을 가린다
      await fireEvent(detailBody(), 'layout', {
        nativeEvent: { layout: { x: 0, y: 100, width: 360, height: 700 } },
      });
      await showKeyboard(500);
      expect(detailBody()).toHaveStyle({ paddingBottom: 300 });

      await userEvent.press(tab('내 일정'));
      expect(keyboardListeners()).toBe(before);
      expect(detailBody()).toHaveStyle({ paddingBottom: 0 });
      await showKeyboard(450);
      expect(detailBody()).toHaveStyle({ paddingBottom: 0 });

      await userEvent.press(tab('홈'));
      expect(keyboardListeners()).toBe(before + 2);
      expect(detailBody()).toHaveStyle({ paddingBottom: 350 });
    });

    it('탭 위 루트 스택의 거절 사유는 그 화면만 듣고, 닫고 홈에 오면 작업 상세가 다시 듣는다', async () => {
      const before = await openDetail();
      await userEvent.press(tab('내 일정'));
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );
      await userEvent.press(screen.getByRole('button', { name: '거절' }));
      expect(keyboardListeners()).toBe(before + 2);

      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(keyboardListeners()).toBe(before);

      await userEvent.press(tab('홈'));
      expect(keyboardListeners()).toBe(before + 2);
    });
  });

  it('홈 첫 화면에서 홈 탭을 다시 눌러도 그대로다', async () => {
    await renderSignedInHome();

    await userEvent.press(tab('홈'));

    expect(header('내 작업')).toBeOnTheScreen();
    expect(tab('홈')).toBeSelected();
  });

  describe('지금 탭을 다시 누르면 리스트를 맨 위로', () => {
    // 탭 다시 누름 처리(첫 화면으로·맨 위로)는 다음 프레임에 돈다
    const nextFrame = () =>
      act(() => new Promise(resolve => requestAnimationFrame(resolve)));
    // 테스트 환경의 리스트는 스크롤 위치가 없어 맨 위로 보내는 호출로 확인한다
    const spyScroll = () => jest.spyOn(FlatList.prototype, 'scrollToOffset');
    const toTop = expect.objectContaining({ offset: 0 });

    it('홈 첫 화면에서 홈 탭을 다시 누르면 맨 위로 간다', async () => {
      const scroll = spyScroll();
      await renderSignedInHome();

      await userEvent.press(tab('홈'));
      await nextFrame();

      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll).toHaveBeenCalledWith(toTop);
    });

    it('상세가 열려 있으면 첫 화면으로만 돌아가고, 한 번 더 누르면 맨 위로 간다', async () => {
      const scroll = spyScroll();
      await renderSignedInHome();

      await openStartedWorkDetail();
      await userEvent.press(tab('홈'));
      await nextFrame();
      expect(header('내 작업')).toBeOnTheScreen();
      expect(scroll).not.toHaveBeenCalled();

      await userEvent.press(tab('홈'));
      await nextFrame();
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll).toHaveBeenCalledWith(toTop);
    });

    it('내 일정 탭을 다시 누르면 보이는 리스트(확정 일정·응답 필요)가 맨 위로 간다', async () => {
      const scroll = spyScroll();
      await renderSignedInHome();

      await userEvent.press(tab('내 일정'));
      await userEvent.press(tab('내 일정'));
      await nextFrame();
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll).toHaveBeenLastCalledWith(toTop);

      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      await userEvent.press(tab('내 일정'));
      await nextFrame();
      expect(scroll).toHaveBeenCalledTimes(2);
      expect(scroll).toHaveBeenLastCalledWith(toTop);
    });

    it('다른 탭으로 옮길 때는 스크롤하지 않는다', async () => {
      const scroll = spyScroll();
      await renderSignedInHome();

      // 탭은 처음 열 때 마운트되므로, 두 탭을 모두 연 뒤에 오가야 양쪽 리스너가 걸린 상태다
      for (const name of ['내 일정', '홈', '내 일정', '홈']) {
        await userEvent.press(tab(name));
        await nextFrame();
      }

      expect(scroll).not.toHaveBeenCalled();
    });
  });

  // iOS 26 은 화면 어디서든 오른쪽으로 밀면 뒤로 간다.
  // 화면 안 가로 제스처(달력 넘기기 등)와 겹치지 않게 왼쪽 1/3 에서 시작한 스와이프만 받는다
  describe('뒤로 가기 스와이프', () => {
    // 네이티브 화면은 받는 영역(start ≤ x ≤ end) 밖의 스와이프를 거절한다. 지정하지 않은 값은 -1(제한 없음)
    const swipeArea = (title: string) => {
      let node = screen.getByRole('header', { name: title }).parent;
      while (node && !node.props.gestureResponseDistance) {
        node = node.parent;
      }
      return node?.props.gestureResponseDistance;
    };
    // 왼쪽 가장자리부터(start 제한 없음) 화면 폭의 1/3 까지
    const leftThird = () =>
      expect.objectContaining({
        start: -1,
        end: Dimensions.get('window').width / 3,
      });

    it('작업 상세는 화면 왼쪽 1/3 에서 시작한 스와이프만 받는다', async () => {
      await renderSignedInHome();

      await openStartedWorkDetail();

      expect(swipeArea('작업 상세')).toEqual(leftThird());
    });

    it('요청 상세·거절 사유(탭 위 루트 스택)도 왼쪽 1/3 에서만 받는다', async () => {
      await renderSignedInHome();
      await userEvent.press(tab('내 일정'));
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));

      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );
      expect(swipeArea('작업 상세')).toEqual(leftThird());

      await userEvent.press(screen.getByRole('button', { name: '거절' }));
      expect(swipeArea('거절 사유')).toEqual(leftThird());
    });
  });

  describe('VoiceOver', () => {
    // 네이티브 스택은 전환이 끝나면 화면의 onAppear 를 부른다. 테스트 환경에는 전환이 없어 직접 보낸다
    const finishTransition = (title: string) =>
      fireEvent(screen.getByRole('header', { name: title }), 'appear');
    // jest 프리셋이 이미 목으로 둬서 spyOn 이 같은 목을 돌려준다. 앞 테스트의 호출을 지운다
    const spyFocus = () =>
      jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear();
    // 테스트 환경의 Text ref 는 목 컴포넌트 인스턴스라 props 로 어떤 제목인지 확인한다
    const titleNode = (name: string) =>
      expect.objectContaining({
        props: expect.objectContaining({
          accessibilityRole: 'header',
          children: name,
        }),
      });

    it('작업 상세는 전환이 끝나면 포커스가 제목으로 간다', async () => {
      const focus = spyFocus();
      await renderSignedInHome();

      await openStartedWorkDetail();
      // 전환 중에 옮기면 전환이 끝날 때 플랫폼이 포커스를 다시 잡는다
      expect(focus).not.toHaveBeenCalled();

      await finishTransition('작업 상세');
      expect(focus).toHaveBeenCalledTimes(1);
      expect(focus).toHaveBeenCalledWith(titleNode('작업 상세'), 'focus');
    });

    // 열리는 중에 위 화면이 또 열리면 이 화면은 보이기 전에 닫힘 전환부터 받는다
    it('닫힘 전환으로는 포커스를 옮기지 않고, 그 뒤 처음 보일 때 옮긴다', async () => {
      const focus = spyFocus();
      await renderSignedInHome();

      await openStartedWorkDetail();
      await fireEvent(
        screen.getByRole('header', { name: '작업 상세' }),
        'disappear',
      );
      expect(focus).not.toHaveBeenCalled();

      await finishTransition('작업 상세');
      expect(focus).toHaveBeenCalledTimes(1);
    });

    it('요청 상세·거절 사유도 열릴 때 제목으로 가고, 돌아온 화면에서는 다시 옮기지 않는다', async () => {
      const focus = spyFocus();
      await renderSignedInHome();
      await userEvent.press(tab('내 일정'));
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));

      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );
      await finishTransition('작업 상세');
      await userEvent.press(screen.getByRole('button', { name: '거절' }));
      await finishTransition('거절 사유');
      expect(focus).toHaveBeenNthCalledWith(1, titleNode('작업 상세'), 'focus');
      expect(focus).toHaveBeenNthCalledWith(2, titleNode('거절 사유'), 'focus');

      // 돌아온 화면은 플랫폼의 포커스 복원(열었던 버튼)에 맡긴다
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      await finishTransition('작업 상세');
      expect(focus).toHaveBeenCalledTimes(2);
    });

    it('작업 상세에서 두 손가락 Z 로 메인화면으로 돌아온다', async () => {
      await renderSignedInHome();

      await openStartedWorkDetail();
      await escapeFrom('작업 상세');

      expect(header('내 작업')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
    });

    it('거절 사유 → 요청 상세 → 내 일정 순서로 두 손가락 Z 로 돌아온다', async () => {
      await renderSignedInHome();
      await userEvent.press(tab('내 일정'));
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );
      await userEvent.press(screen.getByRole('button', { name: '거절' }));

      await escapeFrom('거절 사유');
      expect(header('작업 상세')).toBeOnTheScreen();
      expect(header('거절 사유')).not.toBeOnTheScreen();

      await escapeFrom('작업 상세');
      expect(header('내 일정')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
    });

    // Android 뒤로가기(다른 탭 첫 화면 → 홈 탭)와 달리 탭을 바꾸지 않는다.
    // 아무도 받지 않아야 VoiceOver 가 돌아갈 곳이 없다고 처리한다
    it('탭 첫 화면은 두 손가락 Z 를 받지 않는다', async () => {
      await renderSignedInHome();
      expect(escapeTarget('내 작업')).toBeNull();

      await userEvent.press(tab('내 일정'));
      expect(escapeTarget('내 일정')).toBeNull();
    });

    it('escape 를 받는 뷰는 iOS 뷰 평탄화로 사라지지 않는다', async () => {
      await renderSignedInHome();

      await openStartedWorkDetail();

      // Fabric 은 escape 핸들러만 있는 View 를 평탄화해 네이티브 뷰로 만들지 않는다
      expect(escapeTarget('작업 상세')?.props.collapsable).toBe(false);
    });

    // 홈은 포커스를 잃은 동안 조회를 멈췄다가 돌아오면 새로 받아 다음 작업을 보인다
    it('완료 보고 제출 뒤 결과 모달에서 두 손가락 Z 로 메인화면과 다음 작업의 "작업 시작" 으로 돌아온다', async () => {
      await renderSignedInHome();

      await submitReport();
      await escapeFrom('제출 완료');

      expect(header('제출 완료')).not.toBeOnTheScreen();
      expect(header('내 작업')).toBeOnTheScreen();
      expect(
        await screen.findByRole('button', { name: '세탁기 설치 상세 보기' }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: '작업 시작' }),
      ).toBeOnTheScreen();
    });
  });

  describe('작성 중인 완료 보고가 있으면 화면을 닫기 전에 묻는다', () => {
    // 넘긴 버튼을 꺼내 직접 누른다
    const pressAlertButton = (
      alert: ReturnType<typeof spyAlert>,
      text: string,
    ) => {
      const button = alert.mock.lastCall?.[2]?.find(item => item.text === text);
      if (!button) {
        throw new Error(`대화상자에 "${text}" 버튼이 없다`);
      }
      return act(() => button.onPress?.());
    };
    // iOS 스와이프: 막는 동안 native-stack 은 화면에 preventNativeDismiss 를 켠다.
    // 끝까지 밀면 react-native-screens 가 빠진 화면을 다시 밀어 넣고 onNativeDismissCancelled 로,
    // 막지 않을 때는 onDismissed 로 알린다. 테스트 환경에는 제스처가 없어 그 네이티브 이벤트를 직접 보낸다
    const nativeScreen = (title: string) => {
      let node = screen.getByRole('header', { name: title }).parent;
      while (node && !node.props.onNativeDismissCancelled) {
        node = node.parent;
      }
      if (!node) {
        throw new Error(`"${title}" 화면이 네이티브 스택 화면 안에 없다`);
      }
      return node;
    };
    const swipeBack = (
      title: string,
      event: 'dismissed' | 'nativeDismissCancelled',
    ) =>
      fireEvent(nativeScreen(title), event, {
        nativeEvent: { dismissCount: 1 },
      });

    // 완료 보고는 작업중인 작업만 쓸 수 있어 진행할 작업을 시작하고 연다
    const openDetail = openStartedWorkDetail;
    async function openDetailWithMemo() {
      await openDetail();
      await userEvent.type(
        screen.getByLabelText('수행 메모 입력'),
        '배관 교체',
      );
    }
    const expectBackHome = () => {
      expect(header('내 작업')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
    };

    it('뒤로 가기 버튼: 묻고, "계속 작성" 이면 입력을 둔 채 머문다', async () => {
      const alert = spyAlert();
      await renderSignedInHome();
      await openDetailWithMemo();

      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(alert).toHaveBeenCalledTimes(1);
      expect(alert).toHaveBeenCalledWith(
        '작성 중인 완료 보고가 있어요',
        '나가면 입력한 사진·메모·결제 정보가 사라집니다.',
        [
          expect.objectContaining({ text: '계속 작성', style: 'cancel' }),
          expect.objectContaining({ text: '나가기', style: 'destructive' }),
        ],
        // Android 는 뒤로가기·바깥 탭으로 닫을 수 있고, 그러면 '계속 작성' 과 같다
        { cancelable: true },
      );
      expect(header('작업 상세')).toBeOnTheScreen();

      await pressAlertButton(alert, '계속 작성');
      expect(header('작업 상세')).toBeOnTheScreen();
      expect(screen.getByLabelText('수행 메모 입력')).toHaveDisplayValue(
        '배관 교체',
      );

      // 한 번 머물렀어도 다시 나가려 하면 또 묻는다
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(alert).toHaveBeenCalledTimes(2);
      expect(header('작업 상세')).toBeOnTheScreen();
    });

    it('뒤로 가기 버튼: "나가기" 면 메인화면으로 돌아가고, 다시 열면 빈 보고다', async () => {
      const alert = spyAlert();
      await renderSignedInHome();
      await openDetailWithMemo();

      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      await pressAlertButton(alert, '나가기');
      expectBackHome();

      await openDetail();
      expect(screen.getByLabelText('수행 메모 입력')).toHaveDisplayValue('');
    });

    it('iOS 스와이프: 입력이 있는 동안 네이티브 닫기를 막고, 끝까지 밀면 묻는다', async () => {
      const alert = spyAlert();
      await renderSignedInHome();
      await openDetail();
      expect(nativeScreen('작업 상세').props.preventNativeDismiss).toBeFalsy();

      await userEvent.type(
        screen.getByLabelText('수행 메모 입력'),
        '배관 교체',
      );
      expect(nativeScreen('작업 상세').props.preventNativeDismiss).toBe(true);

      await swipeBack('작업 상세', 'nativeDismissCancelled');
      expect(alert).toHaveBeenCalledTimes(1);
      expect(header('작업 상세')).toBeOnTheScreen();

      await pressAlertButton(alert, '나가기');
      expectBackHome();
    });

    it('Android 뒤로가기: 앱이 처리해(앱을 나가지 않고) 묻는다 — 사진만 넣은 경우', async () => {
      const alert = spyAlert();
      const pressBack = await renderWithBackButton();
      await openDetail();
      await userEvent.press(
        screen.getByRole('button', { name: '작업 전 사진 추가' }),
      );

      expect(await pressBack()).toBe(true);
      expect(alert).toHaveBeenCalledTimes(1);
      expect(header('작업 상세')).toBeOnTheScreen();

      await pressAlertButton(alert, '나가기');
      expectBackHome();
    });

    it('VoiceOver 두 손가락 Z: 묻고, "나가기" 면 메인화면으로 돌아간다', async () => {
      const alert = spyAlert();
      await renderSignedInHome();
      await openDetailWithMemo();

      await escapeFrom('작업 상세');
      expect(alert).toHaveBeenCalledTimes(1);
      expect(header('작업 상세')).toBeOnTheScreen();

      await pressAlertButton(alert, '나가기');
      expectBackHome();
    });

    // 지금 탭을 다시 누르면 상세를 스택에서 빼므로 화면을 닫는 경우다
    it('상세에서 지금 탭("홈")을 다시 눌러도 묻는다', async () => {
      const alert = spyAlert();
      await renderSignedInHome();
      await openDetailWithMemo();

      await userEvent.press(tab('홈'));
      await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
      expect(header('작업 상세')).toBeOnTheScreen();

      await pressAlertButton(alert, '나가기');
      expectBackHome();
    });

    it('입력이 없거나 입력했다 지우면 묻지 않고 닫는다', async () => {
      const alert = spyAlert();
      await renderSignedInHome();

      await openDetail();
      await swipeBack('작업 상세', 'dismissed');
      expectBackHome();

      await openDetailWithMemo();
      await userEvent.clear(screen.getByLabelText('수행 메모 입력'));
      expect(nativeScreen('작업 상세').props.preventNativeDismiss).toBeFalsy();
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expectBackHome();
      expect(alert).not.toHaveBeenCalled();
    });

    // 제출을 마친 뒤 '메인 화면으로' 는 위 '완료 보고를 제출하고 메인으로 돌아오면…' 에서 확인한다.
    // 결과 모달의 두 손가락 Z 도 '메인 화면으로' 와 같은 동작이라 묻지 않는다
    it('제출 뒤 결과 모달에서 두 손가락 Z 로 나가도 묻지 않는다', async () => {
      const alert = spyAlert();
      await renderSignedInHome();

      await submitReport();
      await escapeFrom('제출 완료');

      expectBackHome();
      expect(alert).not.toHaveBeenCalled();
    });

    it('다른 탭으로 옮길 때는 묻지 않는다', async () => {
      const alert = spyAlert();
      await renderSignedInHome();
      await openDetailWithMemo();

      await userEvent.press(tab('내 일정'));

      expect(header('내 일정')).toBeOnTheScreen();
      expect(alert).not.toHaveBeenCalled();
    });
  });

  // 마이페이지도 회색이다 (App.my.test)
  it('탭 바 둥근 모서리 뒤는 지금 화면의 배경색이다 (홈 메인은 회색)', async () => {
    await renderSignedInHome();
    const backdrop = () => screen.getByTestId('main-tab-bar');

    expect(backdrop()).toHaveStyle({ backgroundColor: colors.background[3] });

    await openStartedWorkDetail();
    expect(backdrop()).toHaveStyle({ backgroundColor: colors.white[100] });

    await userEvent.press(tab('내 일정'));
    expect(backdrop()).toHaveStyle({ backgroundColor: colors.white[100] });
  });

  it('전화·길찾기 링크를 열지 못해도 앱이 처리되지 않은 오류를 내지 않는다', async () => {
    const openURL = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValue(new Error('no handler'));
    await renderSignedInHome();

    await openStartedWorkDetail();
    await userEvent.press(
      screen.getByRole('button', { name: '이수연 고객에게 전화' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '길찾기' }));

    expect(openURL).toHaveBeenCalledWith('tel:010-2345-6789');
    expect(openURL).toHaveBeenLastCalledWith(
      expect.stringMatching(/^(https:\/\/maps\.apple\.com\/\?q=|geo:0,0\?q=)/),
    );
  });

  describe('내 일정', () => {
    async function openPending() {
      await renderSignedInHome();
      await userEvent.press(tab('내 일정'));
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
    }

    it('하단 탭으로 내 일정과 홈을 오간다', async () => {
      await renderSignedInHome();

      await userEvent.press(tab('내 일정'));
      expect(header('내 일정')).toBeOnTheScreen();
      expect(tab('내 일정')).toBeSelected();

      await userEvent.press(tab('홈'));
      expect(header('내 작업')).toBeOnTheScreen();
      expect(tab('홈')).toBeSelected();
    });

    it('응답 필요 요청을 수락하면 목록에서 빠진다', async () => {
      await openPending();
      const before = screen.getAllByRole('button', { name: /수락$/ }).length;

      await userEvent.press(
        screen.getAllByRole('button', { name: /수락$/ })[0],
      );

      expect(screen.queryAllByRole('button', { name: /수락$/ })).toHaveLength(
        before - 1,
      );
    });

    it('거절하면 탭 바 없는 거절 사유를 받고 요청을 목록에서 뺀다', async () => {
      await openPending();
      const before = screen.getAllByRole('button', { name: /거절$/ }).length;

      await userEvent.press(
        screen.getAllByRole('button', { name: /거절$/ })[0],
      );
      expect(header('거절 사유')).toBeOnTheScreen();
      expect(tabBar()).not.toBeOnTheScreen();

      await userEvent.press(
        screen.getByRole('radio', { name: '일정이 맞지 않습니다' }),
      );
      await userEvent.press(screen.getByRole('button', { name: '거절 제출' }));

      expect(header('내 일정')).toBeOnTheScreen();
      expect(header('거절 사유')).not.toBeOnTheScreen();
      expect(screen.queryAllByRole('button', { name: /거절$/ })).toHaveLength(
        before - 1,
      );
    });

    it('요청 상세(탭 바 없음)에서 수락하면 내 일정으로 돌아오고 요청이 빠진다', async () => {
      await openPending();
      const before = screen.getAllByRole('button', { name: /수락$/ }).length;

      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );
      expect(header('작업 상세')).toBeOnTheScreen();
      expect(tabBar()).not.toBeOnTheScreen();

      await userEvent.press(screen.getByRole('button', { name: '수락' }));

      expect(header('내 일정')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
      expect(tabBar()).toBeOnTheScreen();
      expect(screen.queryAllByRole('button', { name: /수락$/ })).toHaveLength(
        before - 1,
      );
    });

    it('요청 상세에서 뒤로 가면 내 일정으로 돌아온다', async () => {
      await openPending();

      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

      expect(header('내 일정')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
    });

    it('요청 상세 → 거절 사유에서 뒤로 가면 상세로, 제출하면 내 일정까지 돌아온다', async () => {
      await openPending();
      const before = screen.getAllByRole('button', { name: /거절$/ }).length;

      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );
      await userEvent.press(screen.getByRole('button', { name: '거절' }));
      expect(header('거절 사유')).toBeOnTheScreen();

      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(header('작업 상세')).toBeOnTheScreen();
      expect(header('거절 사유')).not.toBeOnTheScreen();

      await userEvent.press(screen.getByRole('button', { name: '거절' }));
      await userEvent.press(
        screen.getByRole('radio', { name: '일정이 맞지 않습니다' }),
      );
      await userEvent.press(screen.getByRole('button', { name: '거절 제출' }));

      expect(header('내 일정')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
      expect(screen.queryAllByRole('button', { name: /거절$/ })).toHaveLength(
        before - 1,
      );
    });
  });
});
