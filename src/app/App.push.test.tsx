import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import {
  AuthorizationStatus,
  enableFirebase,
  firebaseMessaging,
  openPush,
  pushMessage,
  receivePush,
  refreshPushToken,
} from '../../jest/firebase';
import { saveSignedInStep } from '../features/onboarding/login';
import { participationRequestsKey } from '../features/my/org/participationQueries';
import { REJECT_REASON } from '../features/my/org/testing';
import { readPushDeviceId } from '../features/push/push';
import { createWorkRepository } from '../features/work/data/config';
import { workDetailResponse } from '../features/work/data/testing';
import { appStorage } from '../shared/storage/appStorage';
import { createTestApi } from '../shared/testing/renderWithApi';
import {
  createFakeServer,
  fail,
  noContent,
  ok,
} from '../shared/testing/fakeServer';
import App from './App';
import {
  accountServer,
  LOGOUT_PATH,
  renderApp,
  renderSignedInApp,
  signedInSession,
} from './testing';

// 앱 푸시 (#118). FCM 은 jest/firebase 목이 흉내 낸다. 기본은 Firebase 설정 파일이 없는 빌드라 테스트마다 enableFirebase 로 켠다.
// "지금 보이는 화면" 은 헤더가 접근성 트리에 있는지로 확인한다 (App.test 와 같다)
const header = (name: string) => screen.queryByRole('header', { name });
const LOGIN_TITLE = '오늘의 현장, 한눈에. Orbit';
const PUSH_DEVICES_PATH = '/api/v1/push-devices';
const readPath = (id: string) => `/api/v1/notifications/${id}/read`;

// 작업 101 은 테스트 작업 저장소(로컬 처음 데이터)에 있는 작업이다
const workPush = pushMessage({
  notificationId: '31',
  type: 'WORK_ASSIGNED',
  workId: '101',
});
const approvedPush = pushMessage({
  notificationId: '32',
  type: 'PARTICIPATION_REQUEST_APPROVED',
  participationRequestId: '3',
});

/** 기기 등록·해제·읽음을 받는 서버 */
const pushServer = (pushDeviceId = 7) =>
  createFakeServer()
    .on('POST', PUSH_DEVICES_PATH, ok({ pushDeviceId }))
    .on('DELETE', `${PUSH_DEVICES_PATH}/${pushDeviceId}`, noContent())
    .on('PUT', readPath('31'), noContent())
    .on('PUT', readPath('32'), noContent());

async function registered(app: {
  server: ReturnType<typeof createFakeServer>;
}) {
  await waitFor(() =>
    expect(app.server.callsTo('POST', PUSH_DEVICES_PATH)).toHaveLength(1),
  );
  await waitFor(() => expect(readPushDeviceId()).toBe(7));
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

describe('App — 앱 푸시 기기 등록 (#118)', () => {
  it('가입을 마친 계정이 메인에 들어오면 알림 권한을 묻고 FCM 토큰을 등록해 pushDeviceId 만 남긴다', async () => {
    enableFirebase({ token: 'fcm-token-secret' });
    const app = await renderSignedInApp({ server: pushServer() });

    await registered(app);

    expect(header('내 작업')).toBeOnTheScreen();
    expect(firebaseMessaging.requestPermission).toHaveBeenCalledTimes(1);
    expect(app.server.callsTo('POST', PUSH_DEVICES_PATH)[0].body).toEqual({
      platform: 'IOS',
      token: 'fcm-token-secret',
    });
    // 기기에 남는 값에 토큰은 없다 (가입 단계 표식·보던 화면·pushDeviceId)
    const stored = appStorage
      .getAllKeys()
      .map(key => appStorage.getString(key) ?? '')
      .join();
    expect(stored).not.toContain('fcm-token-secret');
  });

  it('가입 단계(프로필 등록)에서는 권한을 묻지도 기기를 등록하지도 않는다 (가입 전 등록은 PROFILE-005)', async () => {
    enableFirebase();
    const app = await renderSignedInApp({
      nextStep: 'PROFILE',
      server: createFakeServer(),
    });

    await waitFor(() => expect(header('프로필 등록')).toBeOnTheScreen());
    await act(async () => {});

    expect(firebaseMessaging.requestPermission).not.toHaveBeenCalled();
    expect(firebaseMessaging.getToken).not.toHaveBeenCalled();
    expect(app.server.callsTo('POST', PUSH_DEVICES_PATH)).toHaveLength(0);
  });

  it('로그아웃 상태로 켜서 로그인해 메인에 들어오면 그때 등록한다', async () => {
    enableFirebase();
    const app = await renderApp({
      server: accountServer({ server: pushServer() }),
    });
    expect(firebaseMessaging.requestPermission).not.toHaveBeenCalled();

    await userEvent.press(
      screen.getByRole('button', { name: '카카오로 시작하기' }),
    );

    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
    await registered(app);
  });

  it('알림 권한을 거부하면 등록하지 않고 앱은 그대로 쓴다', async () => {
    enableFirebase({ permission: AuthorizationStatus.DENIED });
    const app = await renderSignedInApp({ server: createFakeServer() });

    await waitFor(() =>
      expect(firebaseMessaging.requestPermission).toHaveBeenCalledTimes(1),
    );
    await act(async () => {});

    expect(firebaseMessaging.getToken).not.toHaveBeenCalled();
    expect(app.server.callsTo('POST', PUSH_DEVICES_PATH)).toHaveLength(0);
    expect(header('내 작업')).toBeOnTheScreen();
  });

  it('FCM 토큰이 바뀌면 바뀐 토큰으로 다시 등록한다', async () => {
    enableFirebase();
    const app = await renderSignedInApp({ server: pushServer() });
    await registered(app);
    app.server.on('POST', PUSH_DEVICES_PATH, ok({ pushDeviceId: 8 }));

    await act(async () => refreshPushToken('fcm-token-2'));

    await waitFor(() =>
      expect(app.server.callsTo('POST', PUSH_DEVICES_PATH)).toHaveLength(2),
    );
    expect(app.server.callsTo('POST', PUSH_DEVICES_PATH)[1].body).toEqual({
      platform: 'IOS',
      token: 'fcm-token-2',
    });
    await waitFor(() => expect(readPushDeviceId()).toBe(8));
  });

  it('Firebase 설정 파일이 없는 빌드는 푸시를 건너뛰고 앱은 죽지 않는다', async () => {
    const app = await renderSignedInApp({ server: createFakeServer() });
    await act(async () => {});

    expect(header('내 작업')).toBeOnTheScreen();
    expect(firebaseMessaging.getMessaging).not.toHaveBeenCalled();
    expect(firebaseMessaging.requestPermission).not.toHaveBeenCalled();
    expect(app.server.callsTo('POST', PUSH_DEVICES_PATH)).toHaveLength(0);
  });
});

describe('App — 로그아웃 때 기기 해제 (#118)', () => {
  it('해제 API 를 로그아웃 API 보다 먼저 같은 access token 으로 부르고, 저장한 id 를 지운다', async () => {
    enableFirebase();
    const app = await renderSignedInApp({ server: pushServer() });
    await registered(app);

    await logout();

    expect(
      await screen.findByRole('header', { name: LOGIN_TITLE }),
    ).toBeOnTheScreen();
    await waitFor(() =>
      expect(app.server.callsTo('POST', LOGOUT_PATH)).toHaveLength(1),
    );
    const order = app.server.calls
      .filter(call => call.method !== 'GET')
      .map(call => `${call.method} ${call.path}`);
    expect(order).toEqual([
      `POST ${PUSH_DEVICES_PATH}`,
      `DELETE ${PUSH_DEVICES_PATH}/7`,
      `POST ${LOGOUT_PATH}`,
    ]);
    expect(
      app.server.callsTo('DELETE', `${PUSH_DEVICES_PATH}/7`)[0].headers
        .Authorization,
    ).toBe('Bearer access-1');
    expect(readPushDeviceId()).toBeUndefined();
  });

  it('해제가 실패해도 로그아웃은 계속하고 id 를 지운다', async () => {
    enableFirebase();
    const app = await renderSignedInApp({ server: pushServer() });
    await registered(app);
    app.server.on(
      'DELETE',
      `${PUSH_DEVICES_PATH}/7`,
      fail(404, 'NOTIFICATION-005'),
    );

    await logout();

    expect(
      await screen.findByRole('header', { name: LOGIN_TITLE }),
    ).toBeOnTheScreen();
    await waitFor(() =>
      expect(app.server.callsTo('POST', LOGOUT_PATH)).toHaveLength(1),
    );
    expect(readPushDeviceId()).toBeUndefined();
    expect(app.tokenStore.current).toBeNull();
  });
});

describe('App — 앱이 앞에 있을 때 받은 푸시 (#118)', () => {
  // 알림센터(#117 ['notifications', …])·작업(#114 ['work', …])·신청 현황(#116) 캐시. 받으면 무효화해 다시 받게 한다
  const NOTIFICATIONS_KEY = ['notifications', 'list'];
  const WORK_KEY = ['work', 'detail', 101, null];
  const REQUESTS_KEY = [...participationRequestsKey];

  async function seededApp() {
    enableFirebase();
    const app = await renderSignedInApp({ server: pushServer() });
    await registered(app);
    app.queryClient.setQueryData(NOTIFICATIONS_KEY, ['알림']);
    app.queryClient.setQueryData(WORK_KEY, { id: 101 });
    app.queryClient.setQueryData(REQUESTS_KEY, []);
    return app;
  }
  const invalidated = (
    app: Awaited<ReturnType<typeof seededApp>>,
    key: unknown[],
  ) => app.queryClient.getQueryState(key)?.isInvalidated;

  it('작업 알림이면 알림센터 목록·안 읽은 수와 작업 목록·상세를 다시 받게 한다. 화면은 옮기지 않는다', async () => {
    const app = await seededApp();

    await act(async () => receivePush(workPush));

    expect(invalidated(app, NOTIFICATIONS_KEY)).toBe(true);
    expect(invalidated(app, WORK_KEY)).toBe(true);
    expect(invalidated(app, REQUESTS_KEY)).toBe(false);
    expect(header('내 작업')).toBeOnTheScreen();
    expect(app.server.callsTo('PUT', readPath('31'))).toHaveLength(0);
  });

  it('참여 결과 알림이면 알림센터와 신청 현황(마이페이지 배지)을 다시 받게 하고 작업은 그대로 둔다', async () => {
    const app = await seededApp();

    await act(async () => receivePush(approvedPush));

    expect(invalidated(app, NOTIFICATIONS_KEY)).toBe(true);
    expect(invalidated(app, REQUESTS_KEY)).toBe(true);
    expect(invalidated(app, WORK_KEY)).toBe(false);
  });
});

describe('App — 푸시를 눌러 열기 (#118)', () => {
  it('백그라운드에서 작업 알림을 누르면 홈 탭에 그 작업 상세를 열고 읽음 처리한다', async () => {
    enableFirebase();
    const app = await renderSignedInApp({ server: pushServer() });
    await registered(app);

    await act(async () => openPush(workPush));

    expect(header('작업 상세')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: '홈' })).toBeSelected();
    await waitFor(() =>
      expect(app.server.callsTo('PUT', readPath('31'))).toHaveLength(1),
    );
    // 뒤로 가면 내 작업 홈이다
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(header('내 작업')).toBeOnTheScreen();
  });

  // 페이로드에 organizationId 가 없다(#112 G8). 작업 상세는 소속 목록의 활성 기사 계약으로 발주사를 정한다 (#114 HTTP 저장소)
  it('작업 알림을 누르면 소속의 활성 기사 계약(발주사)으로 그 작업 상세를 받아 연다', async () => {
    enableFirebase();
    saveSignedInStep('COMPLETED');
    const server = accountServer({ server: pushServer() })
      .on(
        'GET',
        '/api/v1/memberships',
        ok({
          memberships: [
            {
              organizationId: 1,
              organizationName: '오빗 서비스',
              role: 'STAFF',
              status: 'ACTIVE',
            },
            {
              organizationId: 5,
              organizationName: '그린 테크',
              role: 'TECHNICIAN',
              status: 'DEACTIVATED',
            },
            {
              organizationId: 7,
              organizationName: '한빛 설비',
              role: 'TECHNICIAN',
              status: 'ACTIVE',
            },
          ],
        }),
      )
      .on(
        'GET',
        '/api/v1/organizations/7/works/101',
        ok(workDetailResponse({ workId: 101, name: '푸시로 연 작업' })),
      );
    const api = createTestApi({ server, session: signedInSession() });
    const workRepository = createWorkRepository('http', {
      api: api.client,
      queryClient: api.queryClient,
    });
    await render(<App api={{ ...api, workRepository }} />);
    await registered({ server });

    await act(async () => openPush(workPush));

    expect(await screen.findByText('푸시로 연 작업')).toBeOnTheScreen();
    expect(header('작업 상세')).toBeOnTheScreen();
    // 작업 상세 조회는 모두 활성 기사 소속(7) 경로로 갔다
    expect(
      server.callsTo('GET', '/api/v1/organizations/7/works/101').length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      server.calls.some(call => /organizations\/(1|5)\/works/.test(call.path)),
    ).toBe(false);
  });

  // 알림에는 작업 상태가 없어 상세를 먼저 받아 고른다 (홈·알림센터의 작업 열기와 같은 규칙)
  it('수락 대기 작업의 배정 알림을 누르면 수락·거절하는 요청 상세를 연다', async () => {
    enableFirebase();
    const app = await renderSignedInApp({ server: pushServer() });
    await registered(app);

    // 작업 106 은 테스트 작업 저장소의 수락 대기 작업이다
    await act(async () =>
      openPush(
        pushMessage({
          notificationId: '31',
          type: 'WORK_ASSIGNED',
          workId: '106',
        }),
      ),
    );

    expect(
      await screen.findByRole('button', { name: '수락' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '거절' })).toBeOnTheScreen();
    await waitFor(() =>
      expect(app.server.callsTo('PUT', readPath('31'))).toHaveLength(1),
    );
  });

  it('종료된 앱을 알림으로 열면(백그라운드와 같은 화면) 그 작업 상세를 열고 읽음 처리한다', async () => {
    enableFirebase({ initialNotification: workPush });
    const app = await renderSignedInApp({ server: pushServer() });

    // 상세는 불러오는 동안의 자리에서 내용으로 바뀌며 다시 그려진다
    await waitFor(() => expect(header('작업 상세')).toBeOnTheScreen());
    await waitFor(() =>
      expect(app.server.callsTo('PUT', readPath('31'))).toHaveLength(1),
    );
  });

  it('참여 승인 알림을 누르면 마이 탭의 참여 신청 현황을 연다', async () => {
    enableFirebase();
    const app = await renderSignedInApp({ server: pushServer() });
    await registered(app);

    await act(async () => openPush(approvedPush));

    expect(header('참여 신청 현황')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: '마이' })).toBeSelected();
    await waitFor(() =>
      expect(app.server.callsTo('PUT', readPath('32'))).toHaveLength(1),
    );
  });

  it('참여 거절 알림을 누르면 마이 탭에 그 요청의 거절 화면(서버 사유)을 연다', async () => {
    enableFirebase();
    const app = await renderSignedInApp({
      server: pushServer().on('PUT', readPath('33'), noContent()),
    });
    await registered(app);

    await act(async () =>
      openPush(
        pushMessage({
          notificationId: '33',
          type: 'PARTICIPATION_REQUEST_REJECTED',
          participationRequestId: '3',
        }),
      ),
    );

    expect(
      await screen.findByRole('header', { name: '참여 요청이 거절되었어요' }),
    ).toBeOnTheScreen();
    expect(await screen.findByText(REJECT_REASON)).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: '마이' })).toBeSelected();
    await waitFor(() =>
      expect(app.server.callsTo('PUT', readPath('33'))).toHaveLength(1),
    );
  });

  it('로그인 전에 누른 푸시는 로그인해 메인에 들어온 뒤 그 화면을 연다', async () => {
    enableFirebase({ initialNotification: workPush });
    const app = await renderApp({
      server: accountServer({ server: pushServer() }),
    });
    await act(async () => {});
    expect(header(LOGIN_TITLE)).toBeOnTheScreen();
    expect(app.server.callsTo('PUT', readPath('31'))).toHaveLength(0);

    await userEvent.press(
      screen.getByRole('button', { name: '카카오로 시작하기' }),
    );

    // 상세는 불러오는 동안의 자리에서 내용으로 바뀌며 다시 그려진다
    await waitFor(() => expect(header('작업 상세')).toBeOnTheScreen());
    await waitFor(() =>
      expect(app.server.callsTo('PUT', readPath('31'))).toHaveLength(1),
    );
  });

  it('이을 수 없는 푸시(앱이 모르는 종류)는 메인의 알림센터를 연다', async () => {
    enableFirebase();
    const app = await renderSignedInApp({
      server: pushServer().on('PUT', readPath('40'), noContent()),
    });
    await registered(app);

    await act(async () =>
      openPush(pushMessage({ notificationId: '40', type: 'ROLE_CHANGED' })),
    );

    expect(header('알림센터')).toBeOnTheScreen();
  });
});
