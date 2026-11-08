import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import {
  pickOnePhotoFromLibrary,
  resetPhotoLibrary,
} from '../../jest/photoPicker';
import { NoTechnicianOrganizationError } from '../features/work/data/errors';
import { emptyReport } from '../features/work/model';
import { saveReportDraft } from '../features/work/reportDraft';
import { ApiError, ApiErrorMessage } from '../shared/api';
import { LOADING_LABEL } from '../shared/layout/LoadStateView';
import { appStorage, writeJson } from '../shared/storage/appStorage';
import { ok } from '../shared/testing/fakeServer';
import {
  accountServer,
  ELIGIBILITY_PATH,
  findHomeLoaded,
  findWorkDetailLoaded,
  fixAppTestClock,
  openStartedWorkDetail,
  relaunch as relaunchApp,
  renderApp,
  renderSignedInApp,
  testWorkRepository,
} from './testing';
import { NAVIGATION_STATE_KEY } from './navigation/persistence';

// #34 앱이 백그라운드에서 종료됐다가 다시 열려도 보던 화면과 작성 중인 입력을 복원한다.
// 테스트의 저장소는 react-native-mmkv 의 메모리 목이라, 앱을 언마운트하고 다시 렌더하면 '종료 후 다시 열기' 와 같다.
// Android 의 Activity 재생성(글꼴 크기 변경 등)도 JS 런타임은 남고 화면만 다시 마운트되므로 같은 경우다.
// 네이티브 스택은 아래 화면을 스크린리더에서만 숨기므로 "지금 보이는 화면" 은 헤더로 확인한다 (App.test 와 같다)
const header = (name: string) => screen.queryByRole('header', { name });
const tab = (name: string) => screen.getByRole('tab', { name });
const tabBar = () => screen.queryByRole('tab', { name: '홈' });

// 지금을 먼저 고정한다: 작업 저장소의 처음 데이터가 지금 기준이다
fixAppTestClock();

// 작업 상태는 서버에 있어 앱을 다시 열어도 그대로다. 테스트마다 저장소 하나를 두고 다시 열 때도 같은 저장소를 준다
let workRepository: ReturnType<typeof testWorkRepository>;
beforeEach(() => {
  workRepository = testWorkRepository();
});

// 메인 화면 복원은 가입을 마친 계정의 세션이 기기에 남아 있는 채로 다시 연 경우를 본다 (#113: 켜면 세션을 복원한다)
async function launch() {
  const { unmount } = await renderSignedInApp({ workRepository });
  // 테스트 환경에서는 언마운트가 OS 의 앱 종료와 같다. 정리 코드만 돌고 내비게이션 동작은 일어나지 않는다
  return () => unmount();
}

async function relaunch(kill: () => Promise<void>) {
  await kill();
  return launch();
}

const openWorkDetail = openStartedWorkDetail;

// 결제 금액은 계획값(75,000원)으로 미리 채워져 있어 다른 값으로 바꾸고, 결제 방식은 고른다 (#150 계획값으로 채우지 않는다)
async function writeReport() {
  await openWorkDetail();
  await userEvent.press(
    screen.getByRole('button', { name: '작업 전 사진 추가' }),
  );
  await userEvent.type(screen.getByLabelText('수행 메모 입력'), '배관 교체');
  await userEvent.clear(screen.getByLabelText('결제 금액 입력'));
  await userEvent.type(screen.getByLabelText('결제 금액 입력'), '80000');
  await userEvent.press(screen.getByRole('button', { name: '결제 방식 선택' }));
  await userEvent.press(screen.getByRole('button', { name: '현장 현금' }));
}

// 응답 필요 첫 요청의 상세를 연다 (상세를 불러올 때까지 기다린다)
async function openFirstRequest() {
  await userEvent.press(
    (
      await screen.findAllByRole('button', { name: / 상세,/ })
    )[0],
  );
  await screen.findByRole('button', { name: '수락' });
}

async function openRejectFromRequestDetail() {
  await userEvent.press(tab('내 일정'));
  await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
  await openFirstRequest();
  await userEvent.press(screen.getByRole('button', { name: '거절' }));
}

// 저장소에 화면 상태를 직접 넣는다 (지금 막 저장한 것으로)
const seedNavigation = (state: unknown) =>
  writeJson(NAVIGATION_STATE_KEY, { savedAt: Date.now(), state });
const HOUR = 60 * 60 * 1000;

const homeStackAt = (params: unknown) => ({
  index: 0,
  routes: [
    {
      name: 'Main',
      state: {
        index: 0,
        routes: [
          {
            name: 'home',
            state: {
              index: 1,
              routes: [{ name: 'WorkHome' }, { name: 'WorkDetail', params }],
            },
          },
        ],
      },
    },
  ],
});

const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const pressAlertButton = (alert: ReturnType<typeof spyAlert>, text: string) =>
  act(() =>
    alert.mock.lastCall?.[2]?.find(item => item.text === text)?.onPress?.(),
  );

describe('App — 종료 후 다시 열기 (#34)', () => {
  beforeEach(pickOnePhotoFromLibrary);

  afterEach(() => {
    jest.restoreAllMocks();
    resetPhotoLibrary();
  });

  describe('로그인 상태 (#85, #113)', () => {
    it('로그아웃 상태로 다시 열면 저장한 메인 화면 대신 로그인 화면부터 연다', async () => {
      const kill = await launch();
      await openWorkDetail();
      await kill();

      await renderApp();

      expect(header('오늘의 현장, 한눈에. Orbit')).toBeOnTheScreen();
      expect(tabBar()).not.toBeOnTheScreen();
    });

    it('가입 단계 도중 종료되면 다시 열 때 보던 화면이 아니라 서버의 가입 단계부터 연다', async () => {
      const app = await renderApp({
        server: accountServer({ nextStep: 'PROFILE' }),
      });
      await userEvent.press(
        screen.getByRole('button', { name: '카카오로 시작하기' }),
      );
      await fireEvent.changeText(
        await screen.findByLabelText('이름'),
        '박기사',
      );
      await fireEvent.changeText(
        screen.getByLabelText('연락처'),
        '01012345678',
      );
      await userEvent.press(screen.getByRole('button', { name: '완료' }));
      await screen.findByRole('header', {
        name: '서비스 이용을 위해 동의가 필요해요',
      });
      // 약관 시트를 열어 둔 채 종료된다
      await userEvent.press(
        screen.getByRole('button', { name: '서비스 이용약관 (필수) 보기' }),
      );

      await relaunchApp(app);

      expect(header('서비스 이용을 위해 동의가 필요해요')).toBeOnTheScreen();
      expect(header('오늘의 현장, 한눈에. Orbit')).not.toBeOnTheScreen();
    });
  });

  it('처음 실행이면 첫 화면(홈)에서 시작한다', async () => {
    await launch();

    expect(header('내 작업')).toBeOnTheScreen();
    expect(tab('홈')).toBeSelected();
  });

  // #147: 홈 일정 보기는 블록 보기가 기본이고, 마지막으로 고른 보기로 다시 연다
  describe('홈 일정 보기 (#147)', () => {
    const viewToggle = (name: '목록 보기' | '블록 보기') =>
      screen.getByRole('button', { name });

    it('처음 실행이면 블록 보기다', async () => {
      await launch();
      await findHomeLoaded();

      expect(viewToggle('블록 보기')).toBeSelected();
      expect(viewToggle('목록 보기')).not.toBeSelected();
    });

    it.each(['목록 보기', '블록 보기'] as const)(
      '%s 를 고르고 종료했다 다시 열면 그 보기로 연다',
      async name => {
        const kill = await launch();
        await findHomeLoaded();
        // 블록 보기는 기본이라 목록 보기를 거쳐 다시 고른다
        await userEvent.press(viewToggle('목록 보기'));
        await userEvent.press(viewToggle(name));

        await relaunch(kill);
        await findHomeLoaded();

        expect(viewToggle(name)).toBeSelected();
      },
    );
  });

  describe('작업 상세에서 완료 보고를 작성하던 중', () => {
    it('다시 열면 같은 작업 상세가 열리고 사진·메모·결제 정보가 남아 있다', async () => {
      const kill = await launch();
      await writeReport();

      await relaunch(kill);
      await findWorkDetailLoaded();

      expect(header('작업 상세')).toBeOnTheScreen();
      expect(tab('홈')).toBeSelected();
      expect(screen.getByLabelText('수행 메모 입력')).toHaveDisplayValue(
        '배관 교체',
      );
      expect(screen.getByLabelText('결제 금액 입력')).toHaveDisplayValue(
        '80,000',
      );
      expect(
        screen.getByRole('button', { name: '결제 방식 선택' }),
      ).toHaveAccessibilityValue({ text: '현장 현금' });
      expect(
        screen.getByRole('button', { name: '작업 전 사진 추가' }),
      ).toHaveAccessibilityValue({ text: '1/6' });
    });

    // #150 결제 방식을 고르지 않은 초안을 다시 열어도 계획값(현장 카드)으로 채우지 않는다
    it('결제 방식을 고르지 않은 채 쓰던 보고는 다시 열어도 결제 방식이 비어 있다', async () => {
      const kill = await launch();
      await openWorkDetail();
      await userEvent.type(
        screen.getByLabelText('수행 메모 입력'),
        '배관 교체',
      );

      await relaunch(kill);
      await findWorkDetailLoaded();

      expect(screen.getByLabelText('수행 메모 입력')).toHaveDisplayValue(
        '배관 교체',
      );
      expect(
        screen.getByRole('button', { name: '결제 방식 선택' }),
      ).not.toHaveAccessibilityValue({ text: '현장 카드' });
    });

    it('이어 쓰는 보고도 나갈 때 묻고, 화면 스택도 남아 뒤로 가면 메인화면이다', async () => {
      const alert = spyAlert();
      const kill = await launch();
      await writeReport();
      await relaunch(kill);
      await findWorkDetailLoaded();

      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(alert).toHaveBeenCalledTimes(1);

      await pressAlertButton(alert, '나가기');
      expect(header('내 작업')).toBeOnTheScreen();
      expect(header('작업 상세')).not.toBeOnTheScreen();
      // 돌아온 홈은 포커스를 받으며 작업을 불러온다
      await findHomeLoaded();
    });

    it('"나가기" 로 버린 초안은 다시 열어도 없다', async () => {
      const alert = spyAlert();
      const kill = await launch();
      await writeReport();
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      await pressAlertButton(alert, '나가기');

      await relaunch(kill);
      expect(header('내 작업')).toBeOnTheScreen();
      await openWorkDetail();
      expect(screen.getByLabelText('수행 메모 입력')).toHaveDisplayValue('');
    });

    it('제출한 보고는 초안에서 지운다', async () => {
      const kill = await launch();
      await writeReport();
      expect(appStorage.contains('work.reportDraft.101')).toBe(true);
      await userEvent.press(
        screen.getByRole('button', { name: '작업 후 사진 추가' }),
      );
      await userEvent.press(
        screen.getByRole('button', { name: '완료보고 제출' }),
      );
      await screen.findByRole('header', { name: '제출 완료' });

      await relaunch(kill);
      // 다시 연 상세는 서버가 준 제출 내용으로 읽기 전용이고, 기기의 초안은 남지 않는다
      expect(
        await screen.findByRole('button', { name: '제출 완료' }),
      ).toBeDisabled();
      expect(appStorage.contains('work.reportDraft.101')).toBe(false);
    });
  });

  describe('내 일정 › 요청 상세 › 거절 사유에서 사유를 고르던 중', () => {
    it('다시 열면 같은 화면과 선택이 복원되고, 뒤로 가면 요청 상세 → 내 일정이다', async () => {
      const kill = await launch();
      await openRejectFromRequestDetail();
      await userEvent.press(
        screen.getByRole('radio', { name: '작업 위치가 너무 멉니다' }),
      );

      await relaunch(kill);

      expect(header('거절 사유')).toBeOnTheScreen();
      expect(tabBar()).not.toBeOnTheScreen();
      expect(
        screen.getByRole('radio', { name: '작업 위치가 너무 멉니다' }),
      ).toBeChecked();

      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(header('작업 상세')).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(header('내 일정')).toBeOnTheScreen();
      expect(tab('내 일정')).toBeSelected();
    });

    it('기타에 쓰던 글도 펼친 채로 복원한다', async () => {
      const kill = await launch();
      await openRejectFromRequestDetail();
      await userEvent.press(
        screen.getByRole('radio', { name: '기타 (직접 입력)' }),
      );
      await userEvent.type(
        screen.getByLabelText('기타 거절 사유 입력'),
        '차량 고장',
      );

      await relaunch(kill);

      expect(
        screen.getByRole('radio', { name: '기타 (직접 입력)' }),
      ).toBeChecked();
      expect(screen.getByLabelText('기타 거절 사유 입력')).toHaveDisplayValue(
        '차량 고장',
      );
    });

    it('화면을 나가면 고르던 사유를 지운다', async () => {
      const kill = await launch();
      await openRejectFromRequestDetail();
      await userEvent.press(
        screen.getByRole('radio', { name: '작업 위치가 너무 멉니다' }),
      );
      await userEvent.press(screen.getByRole('button', { name: '취소' }));

      await relaunch(kill);
      expect(header('작업 상세')).toBeOnTheScreen();
      await userEvent.press(
        await screen.findByRole('button', { name: '거절' }),
      );
      expect(
        screen.getByRole('radio', { name: '작업 위치가 너무 멉니다' }),
      ).not.toBeChecked();
    });

    it('제출하면 고르던 사유를 지운다', async () => {
      const kill = await launch();
      await openRejectFromRequestDetail();
      await userEvent.press(
        screen.getByRole('radio', { name: '작업 위치가 너무 멉니다' }),
      );
      await userEvent.press(screen.getByRole('button', { name: '거절 제출' }));
      expect(
        await screen.findByRole('header', { name: '내 일정' }),
      ).toBeOnTheScreen();

      // 로컬 작업 저장소는 메모리에만 있어 다시 연 앱에는 같은 요청이 남아 있다
      await relaunch(kill);
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      await openFirstRequest();
      await userEvent.press(screen.getByRole('button', { name: '거절' }));
      expect(
        screen.getByRole('radio', { name: '작업 위치가 너무 멉니다' }),
      ).not.toBeChecked();
    });
  });

  it('고른 탭과 탭마다 보던 화면을 복원한다', async () => {
    const kill = await launch();
    await openWorkDetail();
    await userEvent.press(tab('작업 이력'));

    await relaunch(kill);

    expect(tab('작업 이력')).toBeSelected();
    expect(header('작업 이력')).toBeOnTheScreen();
    await userEvent.press(tab('홈'));
    expect(header('작업 상세')).toBeOnTheScreen();
  });

  // 시작할 때 읽은 상태는 저장소에서 빼고(그리다 죽으면 다음엔 첫 화면), 다 그린 뒤 다시 남긴다
  it('복원한 화면에서 아무것도 하지 않고 또 종료돼도 다시 복원한다', async () => {
    let kill = await launch();
    await openWorkDetail();

    kill = await relaunch(kill);
    await relaunch(kill);

    expect(header('작업 상세')).toBeOnTheScreen();
  });

  it(`마지막으로 화면이 바뀐 지 12시간이 지났으면 첫 화면으로 시작하고, 작성하던 보고는 남아 있다`, async () => {
    const start = Date.now();
    const now = jest.spyOn(Date, 'now').mockReturnValue(start);
    const kill = await launch();
    await writeReport();

    now.mockReturnValue(start + 12 * HOUR + 1);
    await relaunch(kill);

    expect(header('내 작업')).toBeOnTheScreen();
    await openWorkDetail();
    expect(screen.getByLabelText('수행 메모 입력')).toHaveDisplayValue(
      '배관 교체',
    );
  });

  // 다시 열기만 하고 화면을 바꾸지 않았으면 12시간은 처음 저장한 때부터 센다. 열 때마다 늘어나지 않는다
  it('복원만 하고 화면을 바꾸지 않았으면 12시간은 마지막으로 화면이 바뀐 때부터 센다', async () => {
    const start = Date.now();
    const now = jest.spyOn(Date, 'now').mockReturnValue(start);
    let kill = await launch();
    await openWorkDetail();

    now.mockReturnValue(start + 11 * HOUR);
    kill = await relaunch(kill);
    expect(header('작업 상세')).toBeOnTheScreen();

    now.mockReturnValue(start + 13 * HOUR);
    await relaunch(kill);
    expect(header('내 작업')).toBeOnTheScreen();
  });

  // 하위 내비게이터는 남아 있는 하위 이동 파라미터(screen)를 저장한 하위 상태보다 먼저 쓴다 (useNavigationBuilder)
  it('바깥에서 하위 화면을 골라 옮긴 뒤(탈퇴 불가 › 진행 중인 작업 보기)에도 보던 하위 화면을 복원한다', async () => {
    const app = await renderSignedInApp({ workRepository });
    const kill = () => app.unmount();
    app.server.on(
      'GET',
      ELIGIBILITY_PATH,
      ok({
        withdrawable: false,
        blocks: [{ reason: 'WORK_IN_PROGRESS', count: 1 }],
      }),
    );
    await userEvent.press(
      await screen.findByRole('button', { name: '작업 시작' }),
    );
    await screen.findByRole('button', { name: '작업 수행중' });
    await userEvent.press(tab('마이'));
    await userEvent.press(screen.getByRole('button', { name: '계정 관리' }));
    await userEvent.press(screen.getByRole('button', { name: '계정 탈퇴' }));
    await userEvent.press(
      await screen.findByRole('button', { name: '진행 중인 작업 1건 보기' }),
    );
    await openWorkDetail();
    await userEvent.type(screen.getByLabelText('수행 메모 입력'), '배관 교체');

    await relaunch(kill);
    await findWorkDetailLoaded();

    expect(header('작업 상세')).toBeOnTheScreen();
    expect(screen.getByLabelText('수행 메모 입력')).toHaveDisplayValue(
      '배관 교체',
    );
  });

  it('하위 이동 파라미터가 남은 상태도 저장한 탭과 하위 화면으로 연다', async () => {
    seedNavigation({
      index: 0,
      routes: [
        {
          name: 'Main',
          params: { screen: 'schedule', params: { tab: 'pending' } },
          state: {
            index: 3,
            routes: [
              { name: 'home' },
              { name: 'schedule', params: {} },
              { name: 'history' },
              {
                name: 'my',
                state: {
                  index: 2,
                  routes: [
                    { name: 'MyPage' },
                    { name: 'OrgJoin' },
                    {
                      name: 'OrgRoleSelect',
                      params: {
                        organizationId: '9',
                        organizationName: 'Orbit',
                        companyCode: 'RBT124',
                        requestChannel: 'COMPANY_CODE',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    });

    await launch();

    expect(tab('마이')).toBeSelected();
    expect(header('역할을 선택해주세요')).toBeOnTheScreen();
  });

  it('복원한 거절 사유의 요청이 없으면(이미 처리됨) 이전 화면으로 돌아가고 고르던 사유도 지운다', async () => {
    seedNavigation({
      index: 1,
      routes: [
        { name: 'Main' },
        { name: 'RejectReason', params: { id: 'gone' } },
      ],
    });
    writeJson('schedule.rejectDraft.gone', {
      selected: 'schedule',
      otherText: '',
    });

    await launch();

    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
    expect(appStorage.contains('schedule.rejectDraft.gone')).toBe(false);
  });

  // 작업 id 가 숫자가 된 뒤 앞 버전이 저장한 목 작업 id(work-boiler) 로 열린 경우
  it('저장한 작업 상세의 id 가 작업 id 가 아니면 저장소를 부르지 않고 "볼 수 없는 작업이에요" 를 보인다', async () => {
    const read = jest.spyOn(workRepository, 'getWorkDetail');
    seedNavigation(homeStackAt({ id: 'work-boiler' }));

    await launch();

    expect(await screen.findByText('볼 수 없는 작업이에요')).toBeOnTheScreen();
    expect(read).not.toHaveBeenCalled();
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(header('내 작업')).toBeOnTheScreen();
  });

  // #117: 알림에서 연 작업 상세는 알림이 생긴 발주사를 들고 있다
  it('작업 상세 경로에 발주사가 있으면 그 발주사로 상세를 부르고 다시 열어도 복원한다', async () => {
    const read = jest.spyOn(workRepository, 'getWorkDetail');
    seedNavigation(homeStackAt({ id: '101', organizationId: '7' }));

    await launch();

    expect(
      await screen.findByRole('button', { name: '작업 시작' }),
    ).toBeOnTheScreen();
    expect(header('작업 상세')).toBeOnTheScreen();
    expect(read).toHaveBeenCalledWith(
      101,
      expect.objectContaining({ organizationId: 7 }),
    );
  });

  it('작업 상세 경로의 발주사가 숫자가 아니면 볼 수 없는 작업이다', async () => {
    seedNavigation(homeStackAt({ id: '101', organizationId: 'org-7' }));

    await launch();

    expect(await screen.findByText('볼 수 없는 작업이에요')).toBeOnTheScreen();
  });

  // #136 남은 초안은 작업이 확실히 없을 때만 지운다: 작업 id 가 아니거나 없는 작업(404 SCHEDULE-001, 로컬 저장소도 같은 오류).
  // 불러오는 중·불러오지 못함(네트워크·5xx)은 이어 쓸 수 있어 그대로 묻고, 소속 문제(403 SCHEDULE-004·기사 소속 없음)와
  // 경로의 발주사만 잘못된 경우는 볼 수 없는 작업이라 묻지 않되 잠시일 수 있어 초안은 남긴다
  describe('복원한 작업 상세의 작성 중 보고 초안 (#136)', () => {
    const REPORT_KEY = 'work.reportDraft.101';
    const httpError = (status: number, code?: string) =>
      new ApiError({ kind: 'http', status, code, message: '서버 문구' });

    function restoreReport(params: { id: string; organizationId?: string }) {
      seedNavigation(homeStackAt(params));
      saveReportDraft(params.id, { ...emptyReport, memo: '배관 교체' });
    }

    async function expectAsksOnLeave(alert: ReturnType<typeof spyAlert>) {
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(alert).toHaveBeenCalledWith(
        '작성 중인 완료 보고가 있어요',
        expect.any(String),
        expect.any(Array),
        expect.anything(),
      );
      expect(header('작업 상세')).toBeOnTheScreen();
    }

    async function expectLeavesWithoutAsking(
      alert: ReturnType<typeof spyAlert>,
    ) {
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(alert).not.toHaveBeenCalled();
      expect(header('내 작업')).toBeOnTheScreen();
    }

    it.each([
      [
        '네트워크 오류',
        new ApiError({ kind: 'network', message: ApiErrorMessage.network }),
      ],
      ['5xx', httpError(503)],
    ])(
      '상세를 불러오지 못하면(%s) 초안을 남기고 나갈 때 묻는다',
      async (_, error) => {
        const alert = spyAlert();
        jest.spyOn(workRepository, 'getWorkDetail').mockRejectedValue(error);
        restoreReport({ id: '101' });

        await launch();

        expect(
          await screen.findByRole('button', { name: '다시 시도' }),
        ).toBeOnTheScreen();
        expect(appStorage.contains(REPORT_KEY)).toBe(true);
        await expectAsksOnLeave(alert);
        expect(appStorage.contains(REPORT_KEY)).toBe(true);
      },
    );

    it('상세를 불러오는 중이면 초안을 남기고 나갈 때 묻는다', async () => {
      const alert = spyAlert();
      jest
        .spyOn(workRepository, 'getWorkDetail')
        .mockReturnValue(new Promise(() => {}));
      restoreReport({ id: '101' });

      await launch();

      expect(screen.getByLabelText(LOADING_LABEL)).toBeOnTheScreen();
      expect(appStorage.contains(REPORT_KEY)).toBe(true);
      await expectAsksOnLeave(alert);
    });

    it.each([
      ['403 SCHEDULE-004', httpError(403, 'SCHEDULE-004')],
      ['기사 소속 없음', new NoTechnicianOrganizationError()],
    ])(
      '소속 문제로 볼 수 없으면(%s) 초안은 남기고 나갈 때 묻지 않는다',
      async (_, error) => {
        const alert = spyAlert();
        jest.spyOn(workRepository, 'getWorkDetail').mockRejectedValue(error);
        restoreReport({ id: '101' });

        await launch();

        expect(
          await screen.findByText('볼 수 없는 작업이에요'),
        ).toBeOnTheScreen();
        await expectLeavesWithoutAsking(alert);
        expect(appStorage.contains(REPORT_KEY)).toBe(true);
      },
    );

    it('경로의 발주사만 잘못됐으면 초안은 남기고 나갈 때 묻지 않는다', async () => {
      const alert = spyAlert();
      restoreReport({ id: '101', organizationId: 'org-7' });

      await launch();

      expect(
        await screen.findByText('볼 수 없는 작업이에요'),
      ).toBeOnTheScreen();
      await expectLeavesWithoutAsking(alert);
      expect(appStorage.contains(REPORT_KEY)).toBe(true);
    });

    it.each([
      ['없는 작업(404 SCHEDULE-001)', '101', httpError(404, 'SCHEDULE-001')],
      ['로컬 저장소에 없는 작업', '999', undefined],
      ['작업 id 가 아님', 'work-boiler', undefined],
    ])('%s 이면 초안을 지우고 나갈 때 묻지 않는다', async (_, id, error) => {
      const alert = spyAlert();
      if (error) {
        jest.spyOn(workRepository, 'getWorkDetail').mockRejectedValue(error);
      }
      restoreReport({ id });

      await launch();

      expect(
        await screen.findByText('볼 수 없는 작업이에요'),
      ).toBeOnTheScreen();
      expect(appStorage.contains(`work.reportDraft.${id}`)).toBe(false);
      await expectLeavesWithoutAsking(alert);
    });
  });

  // 거절 사유도 같다. 볼 수 없는 요청이면 이전 화면으로 돌아가고, 고르던 사유는 요청이 확실히 없을 때만 지운다
  it.each([
    [
      '403 SCHEDULE-004 — 사유를 남긴다',
      new ApiError({
        kind: 'http',
        status: 403,
        code: 'SCHEDULE-004',
        message: '서버 문구',
      }),
      true,
    ],
    [
      '기사 소속 없음 — 사유를 남긴다',
      new NoTechnicianOrganizationError(),
      true,
    ],
    [
      '없는 요청(404 SCHEDULE-001) — 사유도 지운다',
      new ApiError({
        kind: 'http',
        status: 404,
        code: 'SCHEDULE-001',
        message: '서버 문구',
      }),
      false,
    ],
  ])(
    '복원한 거절 사유의 요청을 볼 수 없으면 이전 화면으로 돌아간다: %s',
    async (_, error, kept) => {
      jest.spyOn(workRepository, 'getWorkDetail').mockRejectedValue(error);
      seedNavigation({
        index: 1,
        routes: [
          { name: 'Main' },
          { name: 'RejectReason', params: { id: '104' } },
        ],
      });
      writeJson('schedule.rejectDraft.104', {
        selected: 'schedule',
        otherText: '',
      });

      await launch();

      expect(
        await screen.findByRole('header', { name: '내 작업' }),
      ).toBeOnTheScreen();
      expect(appStorage.contains('schedule.rejectDraft.104')).toBe(kept);
    },
  );

  // 검증표가 없으면 작업 상세가 route.params.id 를 읽다 죽는다. React Navigation 은 모르는 화면만 빼 주고 파라미터는 보지 않는다
  it('저장한 화면 구조가 지금 앱과 맞지 않으면(앱 업데이트로 파라미터가 바뀜 등) 첫 화면으로 시작한다', async () => {
    seedNavigation({
      index: 0,
      routes: [
        {
          name: 'Main',
          state: {
            index: 0,
            routes: [
              {
                name: 'home',
                state: {
                  index: 1,
                  routes: [
                    { name: 'WorkHome' },
                    { name: 'WorkDetail', params: { workId: 'w1' } },
                  ],
                },
              },
            ],
          },
        },
      ],
    });

    await launch();

    expect(header('내 작업')).toBeOnTheScreen();
    expect(tab('홈')).toBeSelected();
  });
});
