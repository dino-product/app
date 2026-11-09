import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ApiError } from '../../../shared/api';
import { MEMBERSHIPS_PATH, membershipsQueryKey } from '../../my/memberships';
import { createFakeServer, fail, ok } from '../../../shared/testing/fakeServer';
import { createTestApi } from '../../../shared/testing/renderWithApi';
import { testSession } from '../../../shared/testing/session';
import { createWorkRepository } from './config';
import { isUnavailableWork } from './errors';
import { workKeys } from './keys';
import { createLocalWorkRepository } from './LocalWorkRepository';
import {
  loadStateOf,
  useAcceptWork,
  useMySchedule,
  usePendingWorks,
  useRefresh,
  useWorkDetail,
} from './queries';
import {
  assignedWorkResponse,
  createWorkTestApi,
  scheduledWorkResponse,
  workDetailResponse,
  workHistoryResponse,
} from './testing';
import type { MySchedule, WorkRepository } from './types';

const period = { from: '2026-10-18T15:00:00Z', to: '2026-10-25T15:00:00Z' };
// 픽스처 작업(2026-10-21 09:00~11:00)이 아직 지연되지 않은 시각
const now = () => new Date('2026-10-20T00:00:00Z');
const pending = () =>
  workDetailResponse({
    status: 'PENDING_ACCEPT',
    assignments: [
      { ...workDetailResponse().assignments[0], result: 'PENDING' },
    ],
  });

describe('작업 조회 훅', () => {
  it('주입한 저장소의 상세·내 일정을 준다', async () => {
    const api = createWorkTestApi({ seed: [pending()], now });

    const { result } = await renderHook(
      () => ({ detail: useWorkDetail(10), schedule: useMySchedule(period) }),
      { wrapper: api.wrapper },
    );

    await waitFor(() => expect(result.current.detail.data?.id).toBe('10'));
    expect(result.current.schedule.data?.works).toHaveLength(1);
  });

  it('응답 필요는 날짜와 관계없는 수락 대기 목록과 불러오기 상태를 준다', async () => {
    const api = createWorkTestApi({ seed: [pending()], now });

    const { result } = await renderHook(() => usePendingWorks(), {
      wrapper: api.wrapper,
    });

    expect(result.current.load.status).toBe('loading');
    expect(result.current.works).toEqual([]);
    await waitFor(() => expect(result.current.load.status).toBe('ready'));
    expect(result.current.works.map(work => work.workId)).toEqual([10]);
  });

  it('응답 필요를 불러오지 못하면 오류와 다시 시도를 준다', async () => {
    const local = createLocalWorkRepository({ seed: [pending()], now });
    jest
      .spyOn(local, 'getPendingWorks')
      .mockRejectedValueOnce(
        new ApiError({ kind: 'network', message: '네트워크' }),
      );
    const api = createWorkTestApi({ repository: local });

    const { result } = await renderHook(() => usePendingWorks(), {
      wrapper: api.wrapper,
    });

    await waitFor(() => expect(result.current.load.status).toBe('error'));
    await act(async () => {
      if (result.current.load.status === 'error') {
        result.current.load.onRetry();
      }
    });
    await waitFor(() => expect(result.current.works).toHaveLength(1));
  });
});

describe('작업 변경 훅', () => {
  function setup(repository: Partial<WorkRepository> = {}) {
    // 바꾼 메서드를 같은 객체에 넣어 spyOn 이 저장소가 부르는 메서드를 본다
    const local = Object.assign(
      createLocalWorkRepository({ seed: [pending()], now }),
      repository,
    );
    const api = createWorkTestApi({ repository: local });
    return { api, local };
  }

  it('성공하면 목록·상세를 새로 받는다 (끝날 때까지 진행 중이다)', async () => {
    const { api } = setup();
    const { result } = await renderHook(
      () => ({
        schedule: useMySchedule(period),
        detail: useWorkDetail(10),
        accept: useAcceptWork(),
      }),
      { wrapper: api.wrapper },
    );
    await waitFor(() => {
      expect(result.current.detail.data).toBeDefined();
      expect(result.current.schedule.data).toBeDefined();
    });

    await act(() =>
      result.current.accept.mutateAsync({ workId: 10, assignmentNumber: 1 }),
    );

    // 변경이 끝났을 때 캐시는 이미 새로 받은 값이다 (화면 갱신은 React Query 가 다음 틱에 알린다)
    expect(
      api.queryClient.getQueryData<MySchedule>(workKeys.schedule(period))
        ?.works[0].status,
    ).toBe('ACCEPTED');
    await waitFor(() =>
      expect(result.current.detail.data?.status).toBe('beforeWork'),
    );
    expect(result.current.schedule.data?.works[0].status).toBe('ACCEPTED');
  });

  // 포커스를 잃은 탭 화면은 구독을 멈춘다 (#110 관례). 변경이 성공해도 숨은 화면이 다시 받지 않는다
  it('구독을 멈춘 조회는 변경이 성공해도 다시 받지 않고, 다시 구독하면 받는다', async () => {
    const { api, local } = setup();
    const read = jest.spyOn(local, 'getMySchedule');
    let subscribed = true;
    const { result, rerender } = await renderHook(
      () => ({
        schedule: useMySchedule(period, { subscribed }),
        accept: useAcceptWork(),
      }),
      { wrapper: api.wrapper },
    );
    await waitFor(() => expect(result.current.schedule.data).toBeDefined());
    subscribed = false;
    await rerender({});
    read.mockClear();

    await act(() =>
      result.current.accept.mutateAsync({ workId: 10, assignmentNumber: 1 }),
    );
    expect(read).not.toHaveBeenCalled();

    subscribed = true;
    await rerender({});
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  });

  it('실패하면 화면 상태를 그대로 두고 다시 받지 않는다', async () => {
    const failing = jest.fn(async () => {
      throw new ApiError({ kind: 'network', message: '네트워크' });
    });
    const { api, local } = setup({ acceptWork: failing });
    const read = jest.spyOn(local, 'getMySchedule');
    const { result } = await renderHook(
      () => ({ schedule: useMySchedule(period), accept: useAcceptWork() }),
      { wrapper: api.wrapper },
    );
    await waitFor(() => expect(result.current.schedule.data).toBeDefined());
    read.mockClear();

    await act(async () => {
      await result.current.accept
        .mutateAsync({ workId: 10, assignmentNumber: 1 })
        .catch(() => undefined);
    });

    expect(read).not.toHaveBeenCalled();
    expect(result.current.schedule.data?.works[0].status).toBe(
      'PENDING_ACCEPT',
    );
  });

  it.each(['SCHEDULE-010', 'SCHEDULE-002', 'SCHEDULE-016'])(
    '%s 로 실패하면 서버의 최신 작업을 다시 받는다',
    async code => {
      const { api, local } = setup({
        acceptWork: async () => {
          throw new ApiError({ kind: 'http', status: 409, code, message: 'x' });
        },
      });
      const read = jest.spyOn(local, 'getWorkDetail');
      const { result } = await renderHook(
        () => ({ detail: useWorkDetail(10), accept: useAcceptWork() }),
        { wrapper: api.wrapper },
      );
      await waitFor(() => expect(result.current.detail.data).toBeDefined());
      read.mockClear();

      await act(async () => {
        await result.current.accept
          .mutateAsync({ workId: 10, assignmentNumber: 1 })
          .catch(() => undefined);
      });

      await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    },
  );
});

describe('loadStateOf', () => {
  const query = (patch: object) => ({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(async () => undefined),
    ...patch,
  });

  it('하나라도 불러오는 중이면 로딩, 다 받았으면 준비', () => {
    expect(loadStateOf(query({ isPending: true }), query({ data: 1 }))).toEqual(
      {
        status: 'loading',
      },
    );
    expect(loadStateOf(query({ data: 1 }))).toEqual({ status: 'ready' });
  });

  it('받은 값 없이 실패했으면 문구와 다시 시도(실패한 조회만 다시)', () => {
    const failed = query({
      isError: true,
      error: new ApiError({ kind: 'network', message: '네트워크 문구' }),
    });
    const fine = query({ data: 1 });

    const state = loadStateOf(failed, fine);
    expect(state).toMatchObject({ status: 'error', message: '네트워크 문구' });
    if (state.status === 'error') {
      state.onRetry();
    }

    expect(failed.refetch).toHaveBeenCalledTimes(1);
    expect(fine.refetch).not.toHaveBeenCalled();
  });

  it('받은 값이 있으면 뒤에서 다시 받는 동안(백그라운드 갱신)에도 준비라 스켈레톤을 다시 보이지 않는다 (#139)', () => {
    expect(loadStateOf(query({ data: 1, isFetching: true }))).toEqual({
      status: 'ready',
    });
  });

  it('받은 값이 있으면 다시 받다 실패해도 그 값을 보인다', () => {
    expect(
      loadStateOf(query({ data: 1, isError: true, error: new Error('x') })),
    ).toEqual({ status: 'ready' });
  });
});

describe('useRefresh', () => {
  it('다시 받는 동안 refreshing 이 켜진다', async () => {
    let finish = () => {};
    const refetch = jest.fn(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    const { result } = await renderHook(() => useRefresh(refetch));

    let done: Promise<void> | undefined;
    await act(async () => {
      done = result.current.onRefresh();
    });
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      finish();
      await done;
    });
    expect(result.current.refreshing).toBe(false);
  });
});

// 로그아웃·만료·탈퇴 때 저장소를 처음으로 돌리는 일은 AuthProvider 의 resetToSignedOut 이 한다 (App.onboarding·App.session 테스트)
describe('WorkRepositoryProvider', () => {
  it('Provider 밖에서 쓰면 알려 준다', async () => {
    const api = createTestApi();
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      renderHook(() => useWorkDetail(1), { wrapper: api.wrapper }),
    ).rejects.toThrow('WorkRepositoryProvider 안에서만 쓸 수 있다');
  });
});

describe('createWorkRepository', () => {
  it('소속 목록의 활성 기사 발주사로 작업 상세를 부른다 (소속은 캐시를 같이 쓴다)', async () => {
    const api = createTestApi({
      session: testSession(),
      server: createFakeServer()
        .on(
          'GET',
          MEMBERSHIPS_PATH,
          ok({
            memberships: [
              {
                organizationId: 7,
                organizationName: '오르빗 설비',
                role: 'TECHNICIAN',
                status: 'ACTIVE',
              },
            ],
          }),
        )
        .on(
          'GET',
          '/api/v1/organizations/7/works/10',
          ok(workDetailResponse()),
        ),
    });
    const repository = createWorkRepository({
      api: api.client,
      queryClient: api.queryClient,
    });

    await expect(repository.getWorkDetail(10)).resolves.toMatchObject({
      id: '10',
    });
    await repository.getWorkDetail(10);
    expect(api.server.callsTo('GET', MEMBERSHIPS_PATH)).toHaveLength(1);
  });

  it('SCHEDULE-004 가 오면 소속을 다시 받는다 (소속이 바뀌었을 수 있다)', async () => {
    const technician = (organizationId: number) => ({
      organizationId,
      organizationName: '오르빗 설비',
      role: 'TECHNICIAN',
      status: 'ACTIVE',
    });
    const api = createTestApi({
      session: testSession(),
      server: createFakeServer()
        .on(
          'GET',
          MEMBERSHIPS_PATH,
          ok({ memberships: [technician(7)] }),
          ok({ memberships: [technician(8)] }),
        )
        .on(
          'GET',
          '/api/v1/organizations/7/works/10',
          fail(403, 'SCHEDULE-004'),
        )
        .on(
          'GET',
          '/api/v1/organizations/8/works/10',
          ok(workDetailResponse()),
        ),
    });
    const repository = createWorkRepository({
      api: api.client,
      queryClient: api.queryClient,
    });

    await repository.getWorkDetail(10).catch(() => undefined);

    await expect(repository.getWorkDetail(10)).resolves.toMatchObject({
      id: '10',
    });
    expect(api.server.callsTo('GET', MEMBERSHIPS_PATH)).toHaveLength(2);
  });

  // 조직 참여(#116)는 새로 승인된 요청을 보면 소속 조회를 무효로 만든다. 승인 전에 받아 둔 소속으로 계속 막히지 않게 한다
  it('소속 조회가 무효가 되면(참여 승인) 다음 조회 때 소속을 다시 받는다', async () => {
    const api = createTestApi({
      session: testSession(),
      server: createFakeServer()
        .on(
          'GET',
          MEMBERSHIPS_PATH,
          ok({ memberships: [] }),
          ok({
            memberships: [
              {
                organizationId: 7,
                organizationName: '오르빗 설비',
                role: 'TECHNICIAN',
                status: 'ACTIVE',
              },
            ],
          }),
        )
        .on(
          'GET',
          '/api/v1/organizations/7/works/10',
          ok(workDetailResponse()),
        ),
    });
    const repository = createWorkRepository({
      api: api.client,
      queryClient: api.queryClient,
    });
    await repository.getWorkDetail(10).catch(() => undefined);

    await api.queryClient.invalidateQueries({ queryKey: membershipsQueryKey });

    await expect(repository.getWorkDetail(10)).resolves.toMatchObject({
      id: '10',
    });
    expect(api.server.callsTo('GET', MEMBERSHIPS_PATH)).toHaveLength(2);
  });

  it('활성 기사 소속이 없으면 볼 수 없는 작업 오류다', async () => {
    const api = createTestApi({
      session: testSession(),
      server: createFakeServer().on(
        'GET',
        MEMBERSHIPS_PATH,
        ok({ memberships: [] }),
      ),
    });
    const repository = createWorkRepository({
      api: api.client,
      queryClient: api.queryClient,
    });

    const error = await repository.getWorkDetail(10).catch(e => e);

    expect(isUnavailableWork(error)).toBe(true);
  });

  // #155 운영 저장소는 기사 작업 API 다. 목록 행의 업체명은 백엔드 행에 없어 경로의 발주사(소속 목록) 이름이다
  it('내 일정·이력은 기사 발주사의 API 를 부르고, 행에 소속 목록의 발주사 이름을 붙인다', async () => {
    const api = createTestApi({
      session: testSession(),
      server: createFakeServer()
        .on(
          'GET',
          MEMBERSHIPS_PATH,
          ok({
            memberships: [
              {
                organizationId: 7,
                organizationName: '오르빗 설비',
                role: 'TECHNICIAN',
                status: 'ACTIVE',
              },
            ],
          }),
        )
        .on(
          'GET',
          '/api/v1/organizations/7/my-schedule',
          ok({ works: [scheduledWorkResponse()] }),
        )
        .on(
          'GET',
          '/api/v1/organizations/7/my-schedule/pending',
          ok({ works: [] }),
        )
        .on(
          'GET',
          '/api/v1/organizations/7/work-history',
          ok(workHistoryResponse({ works: [assignedWorkResponse()] })),
        ),
    });
    const repository = createWorkRepository({
      api: api.client,
      queryClient: api.queryClient,
    });

    const schedule = await repository.getMySchedule(period);
    const history = await repository.getWorkHistory(period);

    expect(schedule.works).toEqual([
      expect.objectContaining({ workId: 10, organizationName: '오르빗 설비' }),
    ]);
    expect(history.works).toEqual([
      expect.objectContaining({ workId: 10, organizationName: '오르빗 설비' }),
    ]);
    expect(api.server.callsTo('GET', MEMBERSHIPS_PATH)).toHaveLength(1);
  });
});
