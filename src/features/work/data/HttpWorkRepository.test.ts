import { createApiClient, type ApiClient } from '../../../shared/api/client';
import { isApiError } from '../../../shared/api';
import { waitFor } from '@testing-library/react-native';
import {
  createFakeServer,
  fail,
  hang,
  networkError,
  ok,
  type FakeServer,
} from '../../../shared/testing/fakeServer';
import {
  createMemoryTokenStore,
  testSession,
} from '../../../shared/testing/session';
import { REFRESH_PATH } from '../../../shared/api/session';
import { isUnavailableWork, UnsupportedWorkOperationError } from './errors';
import { createHttpWorkRepository } from './HttpWorkRepository';
import { workDetailResponse } from './testing';

const ORG_ID = 7;
const DETAIL_PATH = `/api/v1/organizations/${ORG_ID}/works/10`;

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
      onOrganizationRejected,
    }),
  };
}

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
  it('이 기기에 들고 있는 작업 상태가 없어 아무것도 하지 않는다 (서버가 계정마다 준다)', () => {
    const { server, repository } = setup();

    repository.reset();

    expect(server.calls).toHaveLength(0);
  });
});

describe('HttpWorkRepository 의 백엔드에 아직 없는 기능 (#112 G1·G2)', () => {
  const command = { workId: 10, assignmentNumber: 1 };
  const period = {
    from: '2026-10-01T00:00:00Z',
    to: '2026-10-08T00:00:00Z',
  };

  it.each([
    [
      'getMySchedule',
      (r: ReturnType<typeof setup>['repository']) => r.getMySchedule(period),
    ],
    [
      'acceptWork',
      (r: ReturnType<typeof setup>['repository']) => r.acceptWork(command),
    ],
    [
      'rejectWork',
      (r: ReturnType<typeof setup>['repository']) =>
        r.rejectWork({ ...command, reason: 'SCHEDULE_CONFLICT', note: null }),
    ],
    [
      'startWork',
      (r: ReturnType<typeof setup>['repository']) => r.startWork(command),
    ],
    [
      'submitCompletionReport',
      (r: ReturnType<typeof setup>['repository']) =>
        r.submitCompletionReport({
          ...command,
          beforePhotos: [],
          afterPhotos: [],
          usedParts: null,
          workNote: null,
          actualFee: null,
          actualPaymentMethod: null,
        }),
    ],
    [
      'getWorkHistory',
      (r: ReturnType<typeof setup>['repository']) => r.getWorkHistory(period),
    ],
  ])(
    '%s 는 경로를 지어내지 않고 "아직 지원하지 않음" 오류를 던진다',
    async (operation, call) => {
      const { server, repository } = setup();

      const error = await call(repository).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UnsupportedWorkOperationError);
      expect((error as UnsupportedWorkOperationError).operation).toBe(
        operation,
      );
      expect(server.calls).toHaveLength(0);
    },
  );
});
