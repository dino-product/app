import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import {
  pickOnePhotoFromLibrary,
  resetPhotoLibrary,
} from '../../jest/photoPicker';
import { saveSignedInStep } from '../features/onboarding/login';
import { createWorkRepository } from '../features/work/data/config';
import { createPhotoStorage } from '../features/work/data/photoStorage';
import {
  assignedWorkResponse,
  devicePhotoFetch,
  photoUploadResponse,
  scheduledWorkResponse,
  workDetailResponse,
  workHistoryResponse,
} from '../features/work/data/testing';
import type {
  PhotoUploadRequest,
  ScheduledWorkResponse,
  WorkDetailResponse,
  WorkStatusCode,
} from '../features/work/data/types';
import {
  fail,
  noContent,
  ok,
  type FakeServer,
} from '../shared/testing/fakeServer';
import { createTestApi } from '../shared/testing/renderWithApi';
import App from './App';
import {
  accountServer,
  fixAppTestClock,
  markSampleDraftsCleared,
  signedInSession,
} from './testing';

// #155 운영 작업 저장소(기사 작업 API)로 켠 앱. 화면이 서버 데이터를 보이고, 명령이 서버에 반영된 뒤 다시 받는다.
// 가짜 서버는 백엔드처럼 상태를 이어 간다: 수락·거절·시작·완료 보고를 받으면 다음 조회에 바뀐 상태를 준다.
// 사진 업로드만 가짜 기기 파일(file://)·가짜 저장소(가짜 서버의 /storage)로 바꾼다 (features/work/data/testing)
fixAppTestClock(); // 2026-10-21(수) 14:00 KST

const ORG = '/api/v1/organizations/1'; // accountMemberships 의 활성 기사 발주사 '오르빗 설비'
const workPath = (workId: number) => `${ORG}/works/${workId}`;

// 오늘 13:30~15:30 작업전(201), 내일 10:00~11:00 수락 대기(202)
const CURRENT = {
  workId: 201,
  name: '보일러 점검',
  startTime: '2026-10-21T04:30:00Z',
  endTime: '2026-10-21T06:30:00Z',
};
const REQUEST = {
  workId: 202,
  name: '누수 점검',
  startTime: '2026-10-22T01:00:00Z',
  endTime: '2026-10-22T02:00:00Z',
};

function detailOf(
  work: typeof CURRENT,
  status: WorkStatusCode,
  overrides: Partial<WorkDetailResponse> = {},
): WorkDetailResponse {
  const base = workDetailResponse();
  const schedule = {
    ...base.schedule!,
    startTime: work.startTime,
    endTime: work.endTime,
  };
  return workDetailResponse({
    workId: work.workId,
    name: work.name,
    status,
    schedule,
    assignments: [
      {
        ...base.assignments[0],
        schedule,
        result: status === 'PENDING_ACCEPT' ? 'PENDING' : 'ACCEPTED',
      },
    ],
    ...overrides,
  });
}

/** 백엔드처럼 상태를 이어 가는 기사 작업 API */
function workServer(server: FakeServer = accountServer()) {
  const state = {
    current: 'ACCEPTED' as WorkStatusCode,
    request: 'PENDING_ACCEPT' as WorkStatusCode | 'REJECTED',
    issued: 0,
  };
  const row = (
    work: typeof CURRENT,
    status: WorkStatusCode,
  ): ScheduledWorkResponse => scheduledWorkResponse({ ...work, status });
  server
    .on('GET', `${ORG}/my-schedule`, () =>
      ok({
        works: [
          row(CURRENT, state.current),
          ...(state.request === 'ACCEPTED' ? [row(REQUEST, 'ACCEPTED')] : []),
        ],
      }),
    )
    .on('GET', `${ORG}/my-schedule/pending`, () =>
      ok({
        works:
          state.request === 'PENDING_ACCEPT'
            ? [row(REQUEST, 'PENDING_ACCEPT')]
            : [],
      }),
    )
    .on('GET', workPath(CURRENT.workId), () =>
      ok(
        detailOf(CURRENT, state.current, {
          completionReport:
            state.current === 'COMPLETED'
              ? {
                  beforePhotos: [],
                  afterPhotos: [],
                  usedParts: null,
                  workNote: '교체',
                  actualFee: 120000,
                  actualPaymentMethod: 'CREDIT_CARD',
                }
              : null,
        }),
      ),
    )
    .on('GET', workPath(REQUEST.workId), () =>
      ok(detailOf(REQUEST, 'PENDING_ACCEPT')),
    )
    .on('POST', `${workPath(REQUEST.workId)}/acceptance`, () => {
      state.request = 'ACCEPTED';
      return noContent();
    })
    .on('POST', `${workPath(REQUEST.workId)}/rejection`, () => {
      state.request = 'REJECTED';
      return noContent();
    })
    .on('POST', `${workPath(CURRENT.workId)}/start`, () => {
      state.current = 'IN_PROGRESS';
      return noContent();
    })
    .on(
      'POST',
      `${workPath(CURRENT.workId)}/completion-photo-uploads`,
      call => {
        state.issued += 1;
        return ok(
          photoUploadResponse(
            server,
            `file-${state.issued}`,
            call.body as PhotoUploadRequest,
          ),
        );
      },
    )
    .on('POST', `${workPath(CURRENT.workId)}/completion-report`, () => {
      state.current = 'COMPLETED';
      return noContent();
    })
    .on(
      'GET',
      `${ORG}/work-history`,
      ok(
        workHistoryResponse({
          works: [assignedWorkResponse({ workId: 190, name: '수전 교체' })],
          statistics: { assigned: 1, completed: 1, rejected: 0, cancelled: 0 },
          totalCompleted: 42,
        }),
      ),
    );
  for (let id = 1; id <= 4; id += 1) {
    server.on('PUT', `/storage/incoming/file-${id}`, ok());
  }
  return server;
}

/** 로그인해 둔 기기에서 운영 작업 저장소(config)로 앱을 켠다. 사진 업로드만 가짜 기기 파일·저장소다 */
async function launch(server: FakeServer = workServer()) {
  saveSignedInStep('COMPLETED');
  markSampleDraftsCleared();
  const api = createTestApi({ server, session: signedInSession() });
  const workRepository = createWorkRepository({
    api: api.client,
    queryClient: api.queryClient,
    photoStorage: createPhotoStorage({ fetch: devicePhotoFetch(server) }),
  });
  await render(<App api={{ ...api, workRepository }} />);
  return server;
}

const tab = (name: string) => screen.getByRole('tab', { name });
const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const findCurrentWork = () =>
  screen.findByRole('button', { name: '보일러 점검 상세 보기' });

async function openPending() {
  await userEvent.press(tab('내 일정'));
  await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
  return screen.findByRole('button', { name: /누수 점검.*수락$/ });
}

async function openStartedWork() {
  await userEvent.press(
    await screen.findByRole('button', { name: '작업 시작' }),
  );
  await userEvent.press(
    await screen.findByRole('button', { name: '작업 수행중' }),
  );
  await screen.findByRole('button', { name: '작업 전 사진 추가' });
}

async function fillReport() {
  await userEvent.press(
    screen.getByRole('button', { name: '작업 전 사진 추가' }),
  );
  await userEvent.press(
    screen.getByRole('button', { name: '작업 후 사진 추가' }),
  );
  await userEvent.type(screen.getByLabelText('수행 메모 입력'), '교체');
}

describe('App — 기사 작업 API (#155)', () => {
  beforeEach(pickOnePhotoFromLibrary);

  afterEach(() => {
    jest.restoreAllMocks();
    resetPhotoLibrary();
  });

  describe('내 작업 홈', () => {
    it('서버의 내 일정을 이번 주 구간으로 불러 진행할 작업과 일정을 보인다 (고객은 서버, 업체명은 소속 발주사)', async () => {
      const server = await launch();

      expect(await findCurrentWork()).toBeOnTheScreen();
      expect(
        screen.getByRole('button', {
          name: /^보일러 점검, .*오르빗 설비 홍길동/,
        }),
      ).toBeOnTheScreen();
      // 응답 필요(수락 대기)는 날짜와 관계없이 따로 받아 이번 주 것만 더한다
      expect(
        screen.getByRole('button', {
          name: /^누수 점검, .*오르빗 설비 홍길동/,
        }),
      ).toBeOnTheScreen();
      // 이번 주: 10/19(월) 00:00 ~ 10/26(월) 00:00 KST
      expect(server.callsTo('GET', `${ORG}/my-schedule`)[0].query).toEqual({
        from: '2026-10-18T15:00:00.000Z',
        to: '2026-10-25T15:00:00.000Z',
      });
    });

    it('서버가 답할 때까지 불러오는 중을 보이고, 답하면 작업을 보인다', async () => {
      let answer: () => void = () => {};
      const answered = new Promise<void>(resolve => {
        answer = resolve;
      });
      const server = workServer().on('GET', `${ORG}/my-schedule`, async () => {
        await answered;
        return ok({ works: [scheduledWorkResponse({ ...CURRENT })] });
      });
      await launch(server);

      expect(await screen.findByLabelText('불러오는 중')).toBeOnTheScreen();
      await act(async () => answer());

      expect(await findCurrentWork()).toBeOnTheScreen();
      expect(screen.queryByLabelText('불러오는 중')).not.toBeOnTheScreen();
    });

    it('불러오지 못하면(5xx) 서버 문구와 다시 시도를 보이고, 다시 시도하면 불러온다', async () => {
      const server = workServer().on(
        'GET',
        `${ORG}/my-schedule`,
        fail(500, 'COMMON-500', { message: '서버 오류가 발생했습니다.' }),
        ok({ works: [scheduledWorkResponse({ ...CURRENT })] }),
      );
      await launch(server);

      expect(
        await screen.findByText('서버 오류가 발생했습니다.'),
      ).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

      expect(await findCurrentWork()).toBeOnTheScreen();
      expect(server.callsTo('GET', `${ORG}/my-schedule`)).toHaveLength(2);
    });
  });

  describe('응답 필요', () => {
    it('수락하면 서버에 본 배정 순번을 보내고, 다시 받은 목록에서 요청이 빠진다', async () => {
      const server = await launch();
      await findCurrentWork();

      await userEvent.press(await openPending());

      expect(
        await screen.findByText('응답할 요청이 없습니다'),
      ).toBeOnTheScreen();
      expect(
        server.callsTo('POST', `${workPath(REQUEST.workId)}/acceptance`)[0]
          .body,
      ).toEqual({ assignmentNumber: 1 });
    });

    it('수락이 동시 변경과 겹치면(409 SCHEDULE-016) 알리고 최신 목록을 다시 받으며, 요청은 그대로 다시 누를 수 있다', async () => {
      const alert = spyAlert();
      const server = workServer().on(
        'POST',
        `${workPath(REQUEST.workId)}/acceptance`,
        fail(409, 'SCHEDULE-016'),
      );
      await launch(server);
      await findCurrentWork();
      const accept = await openPending();
      const reads = server.callsTo('GET', `${ORG}/my-schedule/pending`).length;

      await userEvent.press(accept);

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '수락하지 못했어요',
          '같은 작업이 동시에 바뀌어 처리하지 못했어요. 최신 정보를 다시 불러왔으니 확인해 주세요.',
        ),
      );
      await waitFor(() =>
        expect(
          server.callsTo('GET', `${ORG}/my-schedule/pending`).length,
        ).toBeGreaterThan(reads),
      );
      expect(
        screen.getByRole('button', { name: /누수 점검.*수락$/ }),
      ).toBeEnabled();
    });

    // 백엔드 응답 필요(pending)는 날짜와 관계없이 수락 대기 전부다. 앱이 구간으로 거르지 않는다
    it('날짜와 관계없이 서버의 수락 대기를 모두 보인다 (석 달 뒤 요청도)', async () => {
      const server = workServer().on(
        'GET',
        `${ORG}/my-schedule/pending`,
        ok({
          works: [
            scheduledWorkResponse({ ...REQUEST, status: 'PENDING_ACCEPT' }),
            scheduledWorkResponse({
              workId: 203,
              name: '보일러 교체',
              status: 'PENDING_ACCEPT',
              startTime: '2027-01-20T01:00:00Z',
              endTime: '2027-01-20T02:00:00Z',
            }),
          ],
        }),
      );
      await launch(server);
      await findCurrentWork();

      await openPending();

      expect(
        screen.getByRole('button', { name: /보일러 교체.*수락$/ }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('tab', { name: /^응답 필요.*2/ }),
      ).toBeOnTheScreen();
    });

    it('기타 사유로 거절하면 메모와 함께 서버 사유 코드로 보낸다', async () => {
      const server = await launch();
      await findCurrentWork();
      await openPending();

      await userEvent.press(
        screen.getByRole('button', { name: /누수 점검.*거절$/ }),
      );
      await userEvent.press(
        screen.getByRole('radio', { name: '기타 (직접 입력)' }),
      );
      await userEvent.type(
        screen.getByLabelText('기타 거절 사유 입력'),
        '차량 고장',
      );
      await userEvent.press(screen.getByRole('button', { name: '거절 제출' }));

      expect(
        await screen.findByRole('header', { name: '내 일정' }),
      ).toBeOnTheScreen();
      expect(
        server.callsTo('POST', `${workPath(REQUEST.workId)}/rejection`)[0].body,
      ).toEqual({ assignmentNumber: 1, reason: 'OTHER', note: '차량 고장' });
    });
  });

  describe('작업 시작·완료 보고', () => {
    it('시작하면 작업중이 되고, 완료 보고는 사진을 올려 받은 파일 식별자로 제출한다', async () => {
      const server = await launch();
      await findCurrentWork();
      await openStartedWork();
      await fillReport();

      await userEvent.press(
        screen.getByRole('button', { name: '완료보고 제출' }),
      );

      expect(
        await screen.findByRole('header', { name: '제출 완료' }),
      ).toBeOnTheScreen();
      expect(
        server.callsTo('POST', `${workPath(CURRENT.workId)}/start`)[0].body,
      ).toEqual({ assignmentNumber: 1 });
      expect(
        server.calls
          .filter(call => call.method === 'PUT')
          .map(call => call.path),
      ).toEqual(['/storage/incoming/file-1', '/storage/incoming/file-2']);
      expect(
        server.callsTo(
          'POST',
          `${workPath(CURRENT.workId)}/completion-report`,
        )[0].body,
      ).toEqual({
        assignmentNumber: 1,
        beforePhotoIds: ['file-1'],
        afterPhotoIds: ['file-2'],
        usedParts: null,
        workNote: '교체',
        actualFee: 120000,
        actualPaymentMethod: 'CREDIT_CARD',
      });
    });

    it('사진을 올리지 못하면 제출하지 않고 입력을 둔 채 알리며, 다시 내면 못 올린 사진만 올려 제출한다', async () => {
      const alert = spyAlert();
      const server = workServer().on(
        'PUT',
        '/storage/incoming/file-2',
        fail(403, 'AccessDenied'),
      );
      await launch(server);
      await findCurrentWork();
      await openStartedWork();
      await fillReport();

      await userEvent.press(
        screen.getByRole('button', { name: '완료보고 제출' }),
      );

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '완료 보고를 제출하지 못했어요',
          '사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.',
        ),
      );
      expect(
        server.callsTo('POST', `${workPath(CURRENT.workId)}/completion-report`),
      ).toHaveLength(0);
      expect(
        screen.getByRole('button', { name: '작업 후 사진 추가' }),
      ).toHaveAccessibilityValue({ text: '1/6' });

      await userEvent.press(
        screen.getByRole('button', { name: '완료보고 제출' }),
      );

      expect(
        await screen.findByRole('header', { name: '제출 완료' }),
      ).toBeOnTheScreen();
      expect(
        server.callsTo(
          'POST',
          `${workPath(CURRENT.workId)}/completion-report`,
        )[0].body,
      ).toMatchObject({
        beforePhotoIds: ['file-1'],
        afterPhotoIds: ['file-3'],
      });
    });
  });

  // 승인 대기 중에 가입을 마치고 메인에 들어온 새 기사 (onboardingRoutes JoinPending → completeOnboarding)
  describe('활성 기사 소속이 없는 계정', () => {
    const launchWithoutTechnician = () =>
      launch(
        workServer().on('GET', '/api/v1/memberships', ok({ memberships: [] })),
      );

    it('홈·내 일정·응답 필요는 오류가 아니라 빈 상태다', async () => {
      await launchWithoutTechnician();

      expect(
        await screen.findByText('이번 주 일정이 없어요'),
      ).toBeOnTheScreen();
      expect(
        screen.getByText('현재 진행 중인 작업이 없습니다'),
      ).toBeOnTheScreen();

      await userEvent.press(tab('내 일정'));
      expect(
        await screen.findByText('예정된 일정이 없습니다'),
      ).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      expect(
        await screen.findByText('응답할 요청이 없습니다'),
      ).toBeOnTheScreen();
      expect(screen.queryByText('볼 수 없는 작업이에요')).toBeNull();
    });

    it('작업 이력은 빈 상태이고 누적 완료는 알 수 없음(-)이다', async () => {
      await launchWithoutTechnician();
      await screen.findByText('이번 주 일정이 없어요');

      await userEvent.press(tab('작업 이력'));

      expect(
        await screen.findByText('이 달에 완료한 작업이 없어요'),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText('누적 완료, 알 수 없음')).toBeOnTheScreen();
      expect(screen.queryByText('볼 수 없는 작업이에요')).toBeNull();
    });
  });

  it('작업 이력은 서버의 완료 작업과 누적 완료를 보인다', async () => {
    await launch();
    await findCurrentWork();

    await userEvent.press(tab('작업 이력'));

    expect(await screen.findByText('수전 교체')).toBeOnTheScreen();
    expect(screen.getByLabelText('누적 완료 42건')).toBeOnTheScreen();
  });
});
