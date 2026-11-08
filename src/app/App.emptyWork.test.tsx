import { render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { saveSignedInStep } from '../features/onboarding/login';
import {
  LOCAL_ORGANIZATION_NAME,
  makeLocalSeed,
} from '../features/work/data/localSeedTesting';
import { saveReportDraft } from '../features/work/reportDraft';
import { emptyReport } from '../features/work/model';
import { appStorage, writeJson } from '../shared/storage/appStorage';
import { fail } from '../shared/testing/fakeServer';
import { createTestApi } from '../shared/testing/renderWithApi';
import App from './App';
import { NAVIGATION_STATE_KEY } from './navigation/persistence';
import {
  accountServer,
  APP_TEST_NOW,
  fixAppTestClock,
  signedInSession,
} from './testing';

// #136 운영 작업 저장소에는 예시(더미) 작업이 없다. 운영 저장소는 기사 작업 API(#155)라 서버가 준 작업만 보인다.
// 다른 앱 흐름 테스트는 테스트 시드(localSeedTesting)를 넣은 저장소를 주입하지만, 여기서는 주입하지 않아
// WorkRepositoryProvider 가 운영과 같이 config 의 저장소를 만든다. 서버는 작업이 하나도 없는 기사로 답한다
fixAppTestClock();

// 예전 예시 작업 id (진행할 작업 101, 응답 필요 요청 104, 완료 이력 1). 서버에는 없는 작업이다
const SAMPLE_WORK_IDS = [1, 101, 104];

/**
 * 로그인해 둔 기기에서 운영과 같은 작업 저장소로 앱을 켠다. 기사 발주사(1)의 내 일정·응답 필요·이력은 빈 목록이다.
 * 기기에는 이 빌드로 켠 표식이 없다: 예시가 있던 빌드에서 올린 기기의 첫 실행이다 (app/sampleDrafts)
 */
async function launch() {
  saveSignedInStep('COMPLETED');
  const server = accountServer();
  for (const workId of SAMPLE_WORK_IDS) {
    server.on(
      'GET',
      `/api/v1/organizations/1/works/${workId}`,
      fail(404, 'SCHEDULE-001', { message: '작업을 찾을 수 없습니다.' }),
    );
  }
  const api = createTestApi({ server, session: signedInSession() });
  return render(<App api={api} />);
}

const draftKeys = () =>
  appStorage.getAllKeys().filter(key => key.includes('Draft'));

const header = (name: string) => screen.queryByRole('header', { name });
const tab = (name: string) => screen.getByRole('tab', { name });
const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// 전에 운영 화면에 보이던 예시의 작업 이름·고객·기사·발주사 (테스트 시드와 같다)
const SAMPLE_TEXTS = [
  ...new Set(
    [
      LOCAL_ORGANIZATION_NAME,
      ...makeLocalSeed(APP_TEST_NOW).flatMap(work => [
        work.name,
        work.customer?.name,
        work.schedule?.technician?.name,
      ]),
    ].filter((text): text is string => typeof text === 'string'),
  ),
];

function expectNoSampleWork() {
  for (const text of SAMPLE_TEXTS) {
    expect({
      text,
      shown: screen.queryAllByText(text, { exact: false }).length,
    }).toEqual({ text, shown: 0 });
  }
}

// 저장소에 화면 상태를 직접 넣는다 (지금 막 저장한 것으로, App.restore.test 와 같다)
const seedNavigation = (state: unknown) =>
  writeJson(NAVIGATION_STATE_KEY, { savedAt: Date.now(), state });
const tabStackAt = (tabName: string, routes: unknown[]) => ({
  index: 0,
  routes: [
    {
      name: 'Main',
      state: {
        index: 0,
        routes: [
          { name: tabName, state: { index: routes.length - 1, routes } },
        ],
      },
    },
  ],
});
const rootAt = (name: string, params: unknown) => ({
  index: 1,
  routes: [{ name: 'Main' }, { name, params }],
});

describe('App — 예시 작업 없는 작업 화면 (#136)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('빈 상태', () => {
    it('내 작업 홈은 진행할 작업·이번 주 일정이 없다 (블록 보기도)', async () => {
      await launch();

      expect(
        await screen.findByText('이번 주 일정이 없어요'),
      ).toBeOnTheScreen();
      expect(
        screen.getByText('현재 진행 중인 작업이 없습니다'),
      ).toBeOnTheScreen();
      expectNoSampleWork();

      await userEvent.press(screen.getByRole('button', { name: '블록 보기' }));
      expect(screen.getByText('이 날은 일정이 없어요')).toBeOnTheScreen();
    });

    it('내 일정은 확정 일정·응답 필요 요청이 없다', async () => {
      await launch();
      await userEvent.press(tab('내 일정'));

      expect(
        await screen.findByText('예정된 일정이 없습니다'),
      ).toBeOnTheScreen();
      expectNoSampleWork();

      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      expect(
        await screen.findByText('응답할 요청이 없습니다'),
      ).toBeOnTheScreen();
      expectNoSampleWork();
    });

    it('작업 이력은 이 달에 완료한 작업이 없고 누적 완료는 0건이다', async () => {
      await launch();
      await userEvent.press(tab('작업 이력'));

      expect(
        await screen.findByText('이 달에 완료한 작업이 없어요'),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText('누적 완료 0건')).toBeOnTheScreen();
      expectNoSampleWork();

      await userEvent.press(screen.getByRole('button', { name: '이전 달' }));
      expect(
        await screen.findByText('이 달에 완료한 작업이 없어요'),
      ).toBeOnTheScreen();
      expectNoSampleWork();
    });
  });

  describe('없는 작업 id', () => {
    // 서버가 볼 수 없는 작업이라고 답한다(404 SCHEDULE-001). 미리 받기가 실패해 작업 상세가 상태를 보인다
    it('알림센터에서 작업 알림을 누르면 작업 상세가 "볼 수 없는 작업이에요" 를 보이고 돌아갈 수 있다', async () => {
      await launch();
      await userEvent.press(
        await screen.findByRole('button', { name: '알림센터' }),
      );
      await userEvent.press(
        await screen.findByRole('button', {
          name: /^읽지 않음, 신규 배정, \[보일러 점검\]/,
        }),
      );

      expect(
        await screen.findByText('볼 수 없는 작업이에요'),
      ).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(header('알림센터')).toBeOnTheScreen();
    });

    // #34 복원: 예시가 있던 버전이 저장한 화면 상태와 작성 중 보고(진행할 작업 101)가 남아 있다
    it('복원한 작업 상세가 예전 예시 작업이면 볼 수 없는 작업이고, 남은 보고 초안은 지워 나갈 때 묻지 않는다', async () => {
      const alert = spyAlert();
      seedNavigation(
        tabStackAt('home', [
          { name: 'WorkHome' },
          { name: 'WorkDetail', params: { id: '101' } },
        ]),
      );
      saveReportDraft('101', { ...emptyReport, memo: '배관 교체' });

      await launch();

      expect(
        await screen.findByText('볼 수 없는 작업이에요'),
      ).toBeOnTheScreen();
      expect(appStorage.contains('work.reportDraft.101')).toBe(false);
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(alert).not.toHaveBeenCalled();
      expect(header('내 작업')).toBeOnTheScreen();
    });

    it('복원한 요청 상세가 예전 예시 요청이면 볼 수 없는 작업이고, 뒤로 가면 메인이다', async () => {
      seedNavigation(rootAt('RequestDetail', { id: '104' }));

      await launch();

      expect(
        await screen.findByText('볼 수 없는 작업이에요'),
      ).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(
        await screen.findByRole('header', { name: '내 작업' }),
      ).toBeOnTheScreen();
    });

    it('복원한 거절 사유가 예전 예시 요청이면 메인으로 돌아가고 고르던 사유도 지운다', async () => {
      seedNavigation(rootAt('RejectReason', { id: '104' }));
      writeJson('schedule.rejectDraft.104', {
        selected: 'schedule',
        otherText: '',
      });

      await launch();

      expect(
        await screen.findByRole('header', { name: '내 작업' }),
      ).toBeOnTheScreen();
      expect(appStorage.contains('schedule.rejectDraft.104')).toBe(false);
    });

    it('복원한 완료 작업 상세가 예전 예시 이력이면 볼 수 없는 작업이고, 뒤로 가면 작업 이력이다', async () => {
      seedNavigation(
        tabStackAt('history', [
          { name: 'WorkHistory' },
          { name: 'CompletedWorkDetail', params: { id: '1' } },
        ]),
      );

      await launch();

      expect(
        await screen.findByText('볼 수 없는 작업이에요'),
      ).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(header('작업 이력')).toBeOnTheScreen();
    });
  });

  // 예시가 있던 빌드(TestFlight 0.0 (3))를 쓴 기기에는 예시 작업 id 를 가리키는 초안이 남아 있다.
  // 그 화면을 열지 않아도 켤 때 지운다. 같은 id 의 실제 서버 작업(#155) 보고 칸에 채워지지 않게 한다
  it('예시가 있던 빌드가 남긴 초안은 켤 때 한 번 지우고, 다시 켠 뒤에는 새로 남긴 초안을 지우지 않는다', async () => {
    saveReportDraft('103', { ...emptyReport, memo: '배관 교체' });
    writeJson('schedule.rejectDraft.105', {
      selected: 'schedule',
      otherText: '',
    });

    const first = await launch();
    expect(await screen.findByText('이번 주 일정이 없어요')).toBeOnTheScreen();
    expect(draftKeys()).toEqual([]);

    // 이 빌드에서 남긴 초안
    saveReportDraft('7', { ...emptyReport, memo: '수전 교체' });
    await first.unmount();
    await launch();

    expect(await screen.findByText('이번 주 일정이 없어요')).toBeOnTheScreen();
    expect(draftKeys()).toEqual(['work.reportDraft.7']);
  });

  // 알림·마이(프로필·소속)는 실제 API 응답이라 예시 작업을 지워도 그대로 서버 값을 보인다
  it('API 로 오는 화면(마이페이지 프로필·소속, 알림센터)은 그대로다', async () => {
    await launch();
    await userEvent.press(tab('마이'));

    expect(
      await screen.findByRole('button', { name: /^박기사/ }),
    ).toBeOnTheScreen();
    expect(
      await screen.findByLabelText('오르빗 설비, 기사, 활성'),
    ).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '알림센터' }));
    expect(
      await screen.findByRole('button', { name: /^읽지 않음, 작업 취소/ }),
    ).toBeOnTheScreen();
  });
});
