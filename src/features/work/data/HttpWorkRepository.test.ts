import { createApiClient, type ApiClient } from '../../../shared/api/client';
import { isApiError } from '../../../shared/api';
import { waitFor } from '@testing-library/react-native';
import {
  createFakeServer,
  fail,
  hang,
  networkError,
  noContent,
  ok,
  type FakeServer,
} from '../../../shared/testing/fakeServer';
import {
  createMemoryTokenStore,
  testSession,
} from '../../../shared/testing/session';
import { REFRESH_PATH } from '../../../shared/api/session';
import { isUnavailableWork, PhotoUploadError } from './errors';
import { createHttpWorkRepository } from './HttpWorkRepository';
import { createPhotoStorage } from './photoStorage';
import type { PhotoUploadRequest } from './types';
import {
  assignedWorkResponse,
  DEVICE_PHOTO_BYTES,
  devicePhotoFetch,
  photoUploadResponse,
  scheduledWorkResponse,
  workDetailResponse,
  workHistoryResponse,
} from './testing';

const ORG_ID = 7;
const DETAIL_PATH = `/api/v1/organizations/${ORG_ID}/works/10`;

// 기기 사진(file://)은 가짜 JPEG 로 읽고, 저장소 PUT 은 가짜 서버의 /storage/... 로 받는다 (testing.tsx)
function setup(server: FakeServer = createFakeServer()) {
  const api: ApiClient = createApiClient({
    baseUrl: server.baseUrl,
    fetch: server.fetch,
    tokenStore: createMemoryTokenStore(testSession()),
  });
  const organizationId = jest.fn(async () => ORG_ID);
  const onOrganizationRejected = jest.fn();
  return {
    server,
    organizationId,
    onOrganizationRejected,
    repository: createHttpWorkRepository({
      api,
      organizationId,
      organizationName: id => (id === ORG_ID ? '오르빗 설비' : null),
      onOrganizationRejected,
      photoStorage: createPhotoStorage({ fetch: devicePhotoFetch(server) }),
    }),
  };
}

type Repository = ReturnType<typeof setup>['repository'];

describe('HttpWorkRepository.getWorkDetail', () => {
  it('기사 발주사의 작업 상세를 불러 화면 모델로 바꾼다', async () => {
    const { server, repository } = setup(
      createFakeServer().on('GET', DETAIL_PATH, ok(workDetailResponse())),
    );

    const work = await repository.getWorkDetail(10);

    expect(work).toMatchObject({
      id: '10',
      title: '배관 누수 점검 및 교체',
      status: 'beforeWork',
      assignmentNumber: 1,
    });
    expect(server.callsTo('GET', DETAIL_PATH)[0].headers).toMatchObject({
      Authorization: 'Bearer access-1',
    });
  });

  // #117: 알림처럼 발주사를 아는 곳에서 연 작업은 그 발주사로 부른다
  it('발주사를 주면 소속 목록으로 정하지 않고 그 발주사로 부른다', async () => {
    const { server, repository, organizationId } = setup(
      createFakeServer().on(
        'GET',
        '/api/v1/organizations/3/works/10',
        ok(workDetailResponse()),
      ),
    );

    await repository.getWorkDetail(10, { organizationId: 3 });

    expect(organizationId).not.toHaveBeenCalled();
    expect(server.calls).toHaveLength(1);
  });

  it('화면을 떠나 취소하면 요청을 끊는다 (signal 을 넘긴다)', async () => {
    const { server, repository } = setup(
      createFakeServer().on('GET', DETAIL_PATH, hang()),
    );
    const controller = new AbortController();

    const pending = repository.getWorkDetail(10, { signal: controller.signal });
    await waitFor(() => expect(server.calls).toHaveLength(1));
    controller.abort();

    await expect(pending).rejects.toThrow();
    expect(server.calls[0].signal?.aborted).toBe(true);
  });

  it.each([
    [404, 'SCHEDULE-001'],
    [403, 'SCHEDULE-004'],
  ])('%s %s 는 볼 수 없는 작업 오류로 던진다', async (status, code) => {
    const { repository } = setup(
      createFakeServer().on('GET', DETAIL_PATH, fail(status, code)),
    );

    const error = await repository.getWorkDetail(10).catch(e => e);

    expect(isApiError(error, code)).toBe(true);
    expect(isUnavailableWork(error)).toBe(true);
  });

  it('SCHEDULE-004(그 발주사의 활성 구성원 아님)면 소속이 바뀐 것이라 알린다 (소속을 다시 받게)', async () => {
    const { repository, onOrganizationRejected } = setup(
      createFakeServer().on('GET', DETAIL_PATH, fail(403, 'SCHEDULE-004')),
    );

    await repository.getWorkDetail(10).catch(() => undefined);

    expect(onOrganizationRejected).toHaveBeenCalledTimes(1);
  });

  it('SCHEDULE-001 은 소속 문제가 아니라 알리지 않는다', async () => {
    const { repository, onOrganizationRejected } = setup(
      createFakeServer().on('GET', DETAIL_PATH, fail(404, 'SCHEDULE-001')),
    );

    await repository.getWorkDetail(10).catch(() => undefined);

    expect(onOrganizationRejected).not.toHaveBeenCalled();
  });

  it('5xx 는 다시 시도할 서버 오류로 던진다', async () => {
    const { repository } = setup(
      createFakeServer().on('GET', DETAIL_PATH, fail(500, 'COMMON-500')),
    );

    const error = await repository.getWorkDetail(10).catch(e => e);

    expect(error).toMatchObject({
      kind: 'http',
      status: 500,
      code: 'COMMON-500',
    });
    expect(isUnavailableWork(error)).toBe(false);
  });

  it('access token 이 만료돼 COMMON-404 가 오면 한 번 재발급해 다시 부른다', async () => {
    const { server, repository } = setup(
      createFakeServer()
        .on(
          'GET',
          DETAIL_PATH,
          fail(404, 'COMMON-404'),
          ok(workDetailResponse()),
        )
        .on(
          'POST',
          REFRESH_PATH,
          ok(
            testSession({ accessToken: 'access-2', refreshToken: 'refresh-2' }),
          ),
        ),
    );

    await expect(repository.getWorkDetail(10)).resolves.toMatchObject({
      id: '10',
    });
    expect(server.callsTo('GET', DETAIL_PATH)[1].headers).toMatchObject({
      Authorization: 'Bearer access-2',
    });
  });

  it('재발급도 거절되면 세션이 끝난 오류(AUTH-009)로 던지고 볼 수 없는 작업으로 보지 않는다', async () => {
    const { repository } = setup(
      createFakeServer()
        .on('GET', DETAIL_PATH, fail(404, 'COMMON-404'))
        .on('POST', REFRESH_PATH, fail(401, 'AUTH-009')),
    );

    const error = await repository.getWorkDetail(10).catch(e => e);

    expect(isApiError(error, 'AUTH-009')).toBe(true);
    expect(isUnavailableWork(error)).toBe(false);
  });

  it('네트워크 오류는 다시 시도할 오류로 던진다', async () => {
    const { repository } = setup(
      createFakeServer().on('GET', DETAIL_PATH, networkError()),
    );

    const error = await repository.getWorkDetail(10).catch(e => e);

    expect(isApiError(error)).toBe(true);
    expect(error.kind).toBe('network');
    expect(isUnavailableWork(error)).toBe(false);
  });

  it('발주사를 정하지 못하면 요청하지 않고 그 오류를 던진다', async () => {
    const { server, repository, organizationId } = setup();
    organizationId.mockRejectedValueOnce(new Error('소속 없음'));

    await expect(repository.getWorkDetail(10)).rejects.toThrow('소속 없음');
    expect(server.calls).toHaveLength(0);
  });
});

describe('HttpWorkRepository.reset', () => {
  it('서버를 부르지 않는다 (작업 상태는 서버가 계정마다 준다)', () => {
    const { server, repository } = setup();

    repository.reset();

    expect(server.calls).toHaveLength(0);
  });
});

// 10/20 00:00 ~ 10/27 00:00 KST
const WEEK = { from: '2026-10-19T15:00:00Z', to: '2026-10-26T15:00:00Z' };
const ORG_PATH = `/api/v1/organizations/${ORG_ID}`;
const SCHEDULE_PATH = `${ORG_PATH}/my-schedule`;
const PENDING_PATH = `${ORG_PATH}/my-schedule/pending`;
const HISTORY_PATH = `${ORG_PATH}/work-history`;

describe('HttpWorkRepository.getMySchedule', () => {
  it('구간의 확정 일정(my-schedule)과 응답 필요(pending)를 불러 합치고 발주사 이름을 붙인다', async () => {
    const { server, repository } = setup(
      createFakeServer()
        .on(
          'GET',
          SCHEDULE_PATH,
          ok({ works: [scheduledWorkResponse({ workId: 12 })] }),
        )
        .on(
          'GET',
          PENDING_PATH,
          ok({
            works: [
              scheduledWorkResponse({
                workId: 11,
                status: 'PENDING_ACCEPT',
                startTime: '2026-10-20T23:00:00Z',
                endTime: '2026-10-21T00:00:00Z',
              }),
              // 구간 밖 (다음 달)
              scheduledWorkResponse({
                workId: 13,
                status: 'PENDING_ACCEPT',
                startTime: '2026-11-20T00:00:00Z',
                endTime: '2026-11-20T01:00:00Z',
              }),
            ],
          }),
        ),
    );

    const schedule = await repository.getMySchedule(WEEK);

    expect(schedule.works.map(work => [work.workId, work.status])).toEqual([
      [11, 'PENDING_ACCEPT'],
      [12, 'ACCEPTED'],
    ]);
    expect(schedule.works[1]).toMatchObject({
      customerName: '홍길동',
      organizationName: '오르빗 설비',
    });
    const [call] = server.callsTo('GET', SCHEDULE_PATH);
    expect(call.query).toEqual(WEEK);
    expect(call.headers).toMatchObject({ Authorization: 'Bearer access-1' });
    expect(server.callsTo('GET', PENDING_PATH)[0].query).toEqual({});
  });

  it('화면을 떠나 취소하면 두 요청을 모두 끊는다 (signal 을 넘긴다)', async () => {
    const { server, repository } = setup(
      createFakeServer()
        .on('GET', SCHEDULE_PATH, hang())
        .on('GET', PENDING_PATH, hang()),
    );
    const controller = new AbortController();

    const pending = repository.getMySchedule(WEEK, {
      signal: controller.signal,
    });
    await waitFor(() => expect(server.calls).toHaveLength(2));
    controller.abort();

    await expect(pending).rejects.toThrow();
    expect(server.calls.every(call => call.signal?.aborted)).toBe(true);
  });

  it.each([
    ['내 일정이 5xx', SCHEDULE_PATH, fail(500, 'COMMON-500')],
    ['응답 필요가 네트워크 오류', PENDING_PATH, networkError()],
    ['구간 오류(SCHEDULE-003)', SCHEDULE_PATH, fail(400, 'SCHEDULE-003')],
  ])('%s 면 다시 시도할 오류로 던진다', async (_, path, response) => {
    const { repository } = setup(
      createFakeServer()
        .on('GET', SCHEDULE_PATH, ok({ works: [] }))
        .on('GET', PENDING_PATH, ok({ works: [] }))
        .on('GET', path, response),
    );

    const error = await repository.getMySchedule(WEEK).catch(e => e);

    expect(isApiError(error)).toBe(true);
    expect(isUnavailableWork(error)).toBe(false);
  });

  it('SCHEDULE-004(활성 구성원 아님)면 소속을 다시 받게 알린다', async () => {
    const { repository, onOrganizationRejected } = setup(
      createFakeServer()
        .on('GET', SCHEDULE_PATH, fail(403, 'SCHEDULE-004'))
        .on('GET', PENDING_PATH, fail(403, 'SCHEDULE-004')),
    );

    await repository.getMySchedule(WEEK).catch(() => undefined);

    expect(onOrganizationRejected).toHaveBeenCalled();
  });
});

describe('HttpWorkRepository.getWorkHistory', () => {
  it('구간을 보내(기사 본인이라 technicianId 없이) 이력·구간 통계·누적 완료를 받는다', async () => {
    const { server, repository } = setup(
      createFakeServer().on(
        'GET',
        HISTORY_PATH,
        ok(
          workHistoryResponse({
            works: [assignedWorkResponse({ workId: 10 })],
            statistics: {
              assigned: 1,
              completed: 1,
              rejected: 0,
              cancelled: 0,
            },
            totalCompleted: 42,
          }),
        ),
      ),
    );

    const history = await repository.getWorkHistory(WEEK);

    expect(server.callsTo('GET', HISTORY_PATH)[0].query).toEqual(WEEK);
    expect(history).toMatchObject({
      works: [
        { workId: 10, customerName: null, organizationName: '오르빗 설비' },
      ],
      statistics: { assigned: 1, completed: 1, rejected: 0, cancelled: 0 },
      totalCompleted: 42,
    });
  });

  it('실패하면 그 오류를 던진다', async () => {
    const { repository } = setup(
      createFakeServer().on('GET', HISTORY_PATH, fail(502, 'COMMON-500')),
    );

    await expect(repository.getWorkHistory(WEEK)).rejects.toMatchObject({
      status: 502,
    });
  });
});

const WORK_PATH = `${ORG_PATH}/works/10`;

describe('HttpWorkRepository 기사 명령 (수락·거절·시작)', () => {
  const command = { workId: 10, assignmentNumber: 2 };
  const commands = [
    [
      '수락',
      `${WORK_PATH}/acceptance`,
      (r: Repository) => r.acceptWork(command),
      { assignmentNumber: 2 },
    ],
    [
      '거절(기타 사유와 메모)',
      `${WORK_PATH}/rejection`,
      (r: Repository) =>
        r.rejectWork({ ...command, reason: 'OTHER', note: '차량 고장' }),
      { assignmentNumber: 2, reason: 'OTHER', note: '차량 고장' },
    ],
    [
      '거절(객관식 사유)',
      `${WORK_PATH}/rejection`,
      (r: Repository) =>
        r.rejectWork({ ...command, reason: 'SCHEDULE_CONFLICT', note: null }),
      { assignmentNumber: 2, reason: 'SCHEDULE_CONFLICT', note: null },
    ],
    [
      '시작',
      `${WORK_PATH}/start`,
      (r: Repository) => r.startWork(command),
      { assignmentNumber: 2 },
    ],
  ] as const;

  it.each(commands)(
    '%s 는 POST 로 본 배정 순번을 보내고 204 면 끝난다',
    async (_, path, run, body) => {
      const { server, repository } = setup(
        createFakeServer().on('POST', path, noContent()),
      );

      await expect(run(repository)).resolves.toBeUndefined();

      const [call] = server.callsTo('POST', path);
      expect(call.body).toEqual(body);
      expect(call.headers).toMatchObject({
        Authorization: 'Bearer access-1',
        'Content-Type': 'application/json',
      });
    },
  );

  it.each([
    [409, 'SCHEDULE-016'],
    [409, 'SCHEDULE-010'],
    [409, 'SCHEDULE-002'],
    [409, 'SCHEDULE-006'],
    [409, 'SCHEDULE-017'],
    [403, 'SCHEDULE-009'],
    [404, 'SCHEDULE-001'],
    [500, 'COMMON-500'],
  ])('%i %s 는 그 코드 그대로 던진다', async (status, code) => {
    const { repository } = setup(
      createFakeServer().on(
        'POST',
        `${WORK_PATH}/acceptance`,
        fail(status, code),
      ),
    );

    const error = await repository.acceptWork(command).catch(e => e);

    expect(isApiError(error, code)).toBe(true);
    expect(error.status).toBe(status);
  });

  it('네트워크 오류는 다시 시도할 오류로 던진다', async () => {
    const { repository } = setup(
      createFakeServer().on('POST', `${WORK_PATH}/start`, networkError()),
    );

    const error = await repository.startWork(command).catch(e => e);

    expect(error).toMatchObject({ kind: 'network' });
  });

  it('access token 이 만료돼 COMMON-404 가 오면 한 번 재발급해 다시 보낸다', async () => {
    const { server, repository } = setup(
      createFakeServer()
        .on(
          'POST',
          `${WORK_PATH}/acceptance`,
          fail(404, 'COMMON-404'),
          noContent(),
        )
        .on(
          'POST',
          REFRESH_PATH,
          ok(
            testSession({ accessToken: 'access-2', refreshToken: 'refresh-2' }),
          ),
        ),
    );

    await repository.acceptWork(command);

    const calls = server.callsTo('POST', `${WORK_PATH}/acceptance`);
    expect(calls).toHaveLength(2);
    expect(calls[1].headers).toMatchObject({
      Authorization: 'Bearer access-2',
    });
  });

  it('SCHEDULE-004 면 소속을 다시 받게 알린다', async () => {
    const { repository, onOrganizationRejected } = setup(
      createFakeServer().on(
        'POST',
        `${WORK_PATH}/rejection`,
        fail(403, 'SCHEDULE-004'),
      ),
    );

    await repository
      .rejectWork({ ...command, reason: 'SCOPE_MISMATCH', note: null })
      .catch(() => undefined);

    expect(onOrganizationRejected).toHaveBeenCalledTimes(1);
  });
});

describe('HttpWorkRepository.submitCompletionReport', () => {
  const REPORT_PATH = `${WORK_PATH}/completion-report`;
  const UPLOADS_PATH = `${WORK_PATH}/completion-photo-uploads`;
  const report = {
    workId: 10,
    assignmentNumber: 2,
    beforePhotos: ['file:///tmp/b1.jpg', 'file:///tmp/b2.jpg'],
    afterPhotos: ['file:///tmp/a1.jpg'],
    usedParts: '필터 1개',
    workNote: '배관 교체',
    actualFee: 150000,
    actualPaymentMethod: 'CREDIT_CARD' as const,
  };

  // 업로드 주소 발급은 차례로 file-1, file-2 … 를 주고, 저장소 PUT(file-1~6)은 받는다
  function uploadServer(server = createFakeServer()) {
    let issued = 0;
    server.on('POST', UPLOADS_PATH, call => {
      issued += 1;
      return ok(
        photoUploadResponse(
          server,
          `file-${issued}`,
          call.body as PhotoUploadRequest,
        ),
      );
    });
    for (let id = 1; id <= 6; id += 1) {
      server.on('PUT', `/storage/incoming/file-${id}`, ok());
    }
    return server.on('POST', REPORT_PATH, noContent());
  }
  const puts = (server: FakeServer) =>
    server.calls.filter(call => call.method === 'PUT');

  it('사진을 한 장씩 올리고(주소 발급 → 저장소 PUT) 받은 파일 식별자로 제출한다', async () => {
    const { server, repository } = setup(uploadServer());

    await repository.submitCompletionReport(report);

    const uploads = server.callsTo('POST', UPLOADS_PATH);
    expect(uploads.map(call => call.body)).toEqual([
      { contentType: 'image/jpeg', sizeBytes: DEVICE_PHOTO_BYTES },
      { contentType: 'image/jpeg', sizeBytes: DEVICE_PHOTO_BYTES },
      { contentType: 'image/jpeg', sizeBytes: DEVICE_PHOTO_BYTES },
    ]);
    expect(puts(server).map(call => call.path)).toEqual([
      '/storage/incoming/file-1',
      '/storage/incoming/file-2',
      '/storage/incoming/file-3',
    ]);
    // 서명된 헤더 그대로 (content-length 는 HTTP 클라이언트가 붙인다), API 토큰은 저장소에 보내지 않는다
    expect(puts(server)[0].headers).toEqual({ 'content-type': 'image/jpeg' });
    expect(server.callsTo('POST', REPORT_PATH)[0].body).toEqual({
      assignmentNumber: 2,
      beforePhotoIds: ['file-1', 'file-2'],
      afterPhotoIds: ['file-3'],
      usedParts: '필터 1개',
      workNote: '배관 교체',
      actualFee: 150000,
      actualPaymentMethod: 'CREDIT_CARD',
    });
  });

  it('사진이 없으면 올리지 않고 제출한다', async () => {
    const { server, repository } = setup(uploadServer());

    await repository.submitCompletionReport({
      ...report,
      beforePhotos: [],
      afterPhotos: [],
    });

    expect(server.callsTo('POST', UPLOADS_PATH)).toHaveLength(0);
    expect(server.callsTo('POST', REPORT_PATH)[0].body).toMatchObject({
      beforePhotoIds: [],
      afterPhotoIds: [],
    });
  });

  it('업로드 주소를 받지 못하면(SCHEDULE-023 503) 제출하지 않고 그 오류를 던진다', async () => {
    const { server, repository } = setup(
      uploadServer().on('POST', UPLOADS_PATH, fail(503, 'SCHEDULE-023')),
    );

    const error = await repository.submitCompletionReport(report).catch(e => e);

    expect(isApiError(error, 'SCHEDULE-023')).toBe(true);
    expect(server.callsTo('POST', REPORT_PATH)).toHaveLength(0);
  });

  it('저장소 PUT 이 실패하면 제출하지 않고, 다시 내면 이미 올린 사진은 다시 올리지 않는다', async () => {
    const server = uploadServer().on(
      'PUT',
      '/storage/incoming/file-2',
      fail(403, 'AccessDenied'),
      ok(),
    );
    const { repository } = setup(server);

    const error = await repository.submitCompletionReport(report).catch(e => e);

    expect(error).toBeInstanceOf(PhotoUploadError);
    expect(server.callsTo('POST', REPORT_PATH)).toHaveLength(0);

    await repository.submitCompletionReport(report);

    // 첫 시도: b1(file-1) 성공, b2(file-2) 실패. 다시: b2 를 새로 받아(file-3) 올리고 a1(file-4)
    expect(server.callsTo('POST', UPLOADS_PATH)).toHaveLength(4);
    expect(server.callsTo('POST', REPORT_PATH)[0].body).toMatchObject({
      beforePhotoIds: ['file-1', 'file-3'],
      afterPhotoIds: ['file-4'],
    });
  });

  it('제출이 네트워크 오류면 다시 낼 때 올린 사진을 그대로 쓴다', async () => {
    const server = uploadServer().on(
      'POST',
      REPORT_PATH,
      networkError(),
      noContent(),
    );
    const { repository } = setup(server);

    await repository.submitCompletionReport(report).catch(() => undefined);
    await repository.submitCompletionReport(report);

    expect(server.callsTo('POST', UPLOADS_PATH)).toHaveLength(3);
    expect(server.callsTo('POST', REPORT_PATH)[1].body).toMatchObject({
      beforePhotoIds: ['file-1', 'file-2'],
      afterPhotoIds: ['file-3'],
    });
  });

  it('제출이 SCHEDULE-022(쓸 수 없는 사진)면 올린 사진을 잊고, 다시 낼 때 새로 올린다', async () => {
    const server = uploadServer().on(
      'POST',
      REPORT_PATH,
      fail(400, 'SCHEDULE-022'),
      noContent(),
    );
    const { repository } = setup(server);

    const error = await repository.submitCompletionReport(report).catch(e => e);
    await repository.submitCompletionReport(report);

    expect(isApiError(error, 'SCHEDULE-022')).toBe(true);
    expect(server.callsTo('POST', UPLOADS_PATH)).toHaveLength(6);
    expect(server.callsTo('POST', REPORT_PATH)[1].body).toMatchObject({
      beforePhotoIds: ['file-4', 'file-5'],
      afterPhotoIds: ['file-6'],
    });
  });

  it.each([
    [409, 'SCHEDULE-016'],
    [409, 'SCHEDULE-002'],
    [409, 'SCHEDULE-010'],
  ])('제출이 %i %s 면 그 코드 그대로 던진다', async (status, code) => {
    const { repository } = setup(
      uploadServer().on('POST', REPORT_PATH, fail(status, code)),
    );

    const error = await repository.submitCompletionReport(report).catch(e => e);

    expect(isApiError(error, code)).toBe(true);
  });

  it('reset 하면(로그아웃·계정 전환) 올려 둔 사진을 잊는다', async () => {
    const server = uploadServer().on(
      'POST',
      REPORT_PATH,
      networkError(),
      noContent(),
    );
    const { repository } = setup(server);
    await repository.submitCompletionReport(report).catch(() => undefined);

    repository.reset();
    await repository.submitCompletionReport(report);

    expect(server.callsTo('POST', UPLOADS_PATH)).toHaveLength(6);
  });
});
