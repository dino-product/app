import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ApiError } from '../../../shared/api';
import { MEMBERSHIPS_PATH } from '../../my/memberships';
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
  useRefresh,
  useWorkDetail,
} from './queries';
import { createWorkTestApi, workDetailResponse } from './testing';
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

  it.each(['SCHEDULE-010', 'SCHEDULE-002'])(
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
  it("'http' 는 소속 목록의 활성 기사 발주사로 작업 상세를 부른다 (소속은 캐시를 같이 쓴다)", async () => {
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
    const repository = createWorkRepository('http', {
      api: api.client,
      queryClient: api.queryClient,
    });

    await expect(repository.getWorkDetail(10)).resolves.toMatchObject({
      id: '10',
    });
    await repository.getWorkDetail(10);
    expect(api.server.callsTo('GET', MEMBERSHIPS_PATH)).toHaveLength(1);
  });

  it("'http' 는 SCHEDULE-004 가 오면 소속을 다시 받는다 (소속이 바뀌었을 수 있다)", async () => {
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
    const repository = createWorkRepository('http', {
      api: api.client,
      queryClient: api.queryClient,
    });

    await repository.getWorkDetail(10).catch(() => undefined);

    await expect(repository.getWorkDetail(10)).resolves.toMatchObject({
      id: '10',
    });
    expect(api.server.callsTo('GET', MEMBERSHIPS_PATH)).toHaveLength(2);
  });

  it("'http' 는 활성 기사 소속이 없으면 볼 수 없는 작업 오류다", async () => {
    const api = createTestApi({
      session: testSession(),
      server: createFakeServer().on(
        'GET',
        MEMBERSHIPS_PATH,
        ok({ memberships: [] }),
      ),
    });
    const repository = createWorkRepository('http', {
      api: api.client,
      queryClient: api.queryClient,
    });

    const error = await repository.getWorkDetail(10).catch(e => e);

    expect(isUnavailableWork(error)).toBe(true);
  });

  it("'local' 은 지금 시각 기준 처음 데이터로 시작한다 (소속 없이)", async () => {
    const api = createTestApi();
    const opened = new Date(2026, 9, 21, 14, 0);
    const repository = createWorkRepository('local', {
      api: api.client,
      queryClient: api.queryClient,
      now: () => opened,
    });

    const { works } = await repository.getMySchedule({
      from: new Date(2026, 9, 21).toISOString(),
      to: new Date(2026, 9, 22).toISOString(),
    });

    expect(works.map(work => work.name)).toContain('보일러 점검');
    expect(api.server.calls).toHaveLength(0);
  });
});
