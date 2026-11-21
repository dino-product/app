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
  useRejectWork,
  useWorkDetail,
} from './queries';
import {
  assignedWorkResponse,
  createWorkTestApi,
  scheduledWorkResponse,
  workDetailResponse,
  workHistoryResponse,
} from './testing';
import type {
  MySchedule,
  RejectWorkCommand,
  WorkDetailResponse,
  WorkRepository,
} from './types';

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

// #197 수락·거절(POST)은 서버 답을 기다리지 않고 곧바로 화면에 반영한다. 답이 오면 서버 값으로 바로잡고, 실패하면 되돌린다
describe('수락·거절 낙관 반영', () => {
  // 서버 답을 테스트가 정한 때 돌려준다. 답하면 실제 로컬 저장소가 처리한다(성공) 또는 오류를 낸다(실패)
  function gated<T>(run: (command: T) => Promise<void>) {
    const answers: {
      command: T;
      ok: () => Promise<void>;
      fail: (error: unknown) => Promise<void>;
    }[] = [];
    const send = jest.fn(
      (command: T) =>
        new Promise<void>((resolve, reject) => {
          answers.push({
            command,
            ok: () => run(command).then(resolve, reject),
            fail: async error => reject(error),
          });
        }),
    );
    return { send, answers };
  }

  const pendingWork = (overrides: Partial<WorkDetailResponse> = {}) => ({
    ...pending(),
    ...overrides,
  });
  // 11 은 10 과 같은 시각의 다른 요청, 12 는 그다음 날 수락한 작업이다
  const seed = () => [
    pendingWork(),
    pendingWork({ workId: 11, name: '보일러 점검' }),
    workDetailResponse({
      workId: 12,
      name: '수전 교체',
      schedule: {
        ...workDetailResponse().schedule!,
        startTime: '2026-10-22T00:00:00Z',
        endTime: '2026-10-22T01:00:00Z',
      },
    }),
  ];
  const november = { from: '2026-10-31T15:00:00Z', to: '2026-11-30T15:00:00Z' };

  async function setup({
    serverSchedule = false,
  }: {
    /** 운영 API 처럼 내 일정에 수락 대기를 넣지 않는다 */
    serverSchedule?: boolean;
  } = {}) {
    const local = createLocalWorkRepository({ seed: seed(), now });
    if (serverSchedule) {
      const read = local.getMySchedule;
      local.getMySchedule = async (...args) => {
        const schedule = await read(...args);
        return {
          works: schedule.works.filter(
            work => work.status !== 'PENDING_ACCEPT',
          ),
        };
      };
    }
    // 서버가 그대로 처리하는 명령 (다른 곳에서 먼저 처리한 상황을 만들 때)
    const server = {
      acceptWork: local.acceptWork,
      rejectWork: local.rejectWork,
    };
    const accept = gated(local.acceptWork);
    const reject = gated(local.rejectWork);
    local.acceptWork = accept.send;
    local.rejectWork = reject.send;
    const api = createWorkTestApi({ repository: local });
    // 화면에 보인 응답 필요 (그릴 때마다). 잠깐이라도 돌아왔는지 본다
    const seenPending: (number[] | undefined)[] = [];
    // subscribed: false 는 탭을 옮겨 보이지 않는 화면이다 (#110)
    const view = await renderHook(
      ({ subscribed }: { subscribed: boolean }) => {
        const pendingWorks = usePendingWorks({ subscribed });
        seenPending.push(ids(pendingWorks.works));
        return {
          pending: pendingWorks,
          week: useMySchedule(period, { subscribed }),
          november: useMySchedule(november, { subscribed }),
          detail: useWorkDetail(10, { subscribed }),
          accept: useAcceptWork(),
          reject: useRejectWork(),
        };
      },
      { wrapper: api.wrapper, initialProps: { subscribed: true } },
    );
    await waitFor(() => {
      expect(view.result.current.pending.works).toHaveLength(2);
      expect(view.result.current.week.data).toBeDefined();
      expect(view.result.current.november.data).toBeDefined();
      expect(view.result.current.detail.data).toBeDefined();
    });
    return { ...view, api, local, server, accept, reject, seenPending };
  }

  function ids(works: readonly { workId: number }[]): number[];
  function ids(
    works: readonly { workId: number }[] | undefined,
  ): number[] | undefined;
  function ids(works: readonly { workId: number }[] | undefined) {
    return works?.map(work => work.workId);
  }
  // 서버가 늦게 답하는 조회 (그동안 화면이 무엇을 보이는지 본다)
  function slowPendingReads(local: WorkRepository) {
    const read = local.getPendingWorks;
    return jest
      .spyOn(local, 'getPendingWorks')
      .mockImplementation(async options => {
        const works = await read(options);
        await new Promise<void>(resolve => setTimeout(resolve, 80));
        return works;
      });
  }
  const settle = () =>
    act(() => new Promise<void>(resolve => setTimeout(resolve, 200)));
  const networkError = () =>
    new ApiError({ kind: 'network', message: '네트워크' });
  const rejection = (workId: number): RejectWorkCommand => ({
    workId,
    assignmentNumber: 1,
    reason: 'SCHEDULE_CONFLICT',
    note: null,
  });

  it('수락을 보내면 서버 답 전에 응답 필요에서 빠지고, 내 일정·상세는 수락됨(작업전)이다', async () => {
    const { result, accept } = await setup();

    await act(async () => {
      result.current.accept.mutate({ workId: 10, assignmentNumber: 1 });
    });

    expect(accept.answers).toHaveLength(1);
    await waitFor(() =>
      expect(ids(result.current.pending.works)).toEqual([11]),
    );
    expect(
      result.current.week.data?.works.find(work => work.workId === 10)?.status,
    ).toBe('ACCEPTED');
    expect(result.current.detail.data).toMatchObject({
      status: 'beforeWork',
      workStatus: 'ACCEPTED',
    });
  });

  it('내 일정에 수락 대기가 없으면(운영 API) 수락한 요청을 겹치는 구간에만 시작 시각 순으로 넣는다', async () => {
    const { result } = await setup({ serverSchedule: true });
    expect(ids(result.current.week.data?.works)).toEqual([12]);

    await act(async () => {
      result.current.accept.mutate({ workId: 10, assignmentNumber: 1 });
    });

    await waitFor(() =>
      expect(ids(result.current.week.data?.works)).toEqual([10, 12]),
    );
    expect(result.current.week.data?.works[0]).toMatchObject({
      name: '배관 누수 점검 및 교체',
      status: 'ACCEPTED',
    });
    expect(result.current.november.data?.works).toEqual([]);
  });

  it('수락이 성공하면 서버 값으로 다시 받는다', async () => {
    const { result, accept, local } = await setup();
    const readPending = jest.spyOn(local, 'getPendingWorks');
    const readDetail = jest.spyOn(local, 'getWorkDetail');
    await act(async () => {
      result.current.accept.mutate({ workId: 10, assignmentNumber: 1 });
    });
    expect(readPending).not.toHaveBeenCalled();

    await act(() => accept.answers[0].ok());

    await waitFor(() => expect(readPending).toHaveBeenCalledTimes(1));
    expect(readDetail).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.accept.isSuccess).toBe(true));
    expect(ids(result.current.pending.works)).toEqual([11]);
    expect(result.current.detail.data?.workStatus).toBe('ACCEPTED');
  });

  it('수락이 실패하면 응답 필요·내 일정·상세를 이전 값으로 되돌리고, 다시 받지 않는다', async () => {
    const { result, accept, local } = await setup();
    const readPending = jest.spyOn(local, 'getPendingWorks');
    await act(async () => {
      result.current.accept.mutate({ workId: 10, assignmentNumber: 1 });
    });

    await act(() =>
      accept.answers[0].fail(
        new ApiError({ kind: 'network', message: '네트워크' }),
      ),
    );

    await waitFor(() => expect(result.current.accept.isError).toBe(true));
    expect(ids(result.current.pending.works)).toEqual([10, 11]);
    expect(
      result.current.week.data?.works.find(work => work.workId === 10)?.status,
    ).toBe('PENDING_ACCEPT');
    expect(result.current.detail.data).toMatchObject({
      status: 'assigned',
      workStatus: 'PENDING_ACCEPT',
    });
    expect(readPending).not.toHaveBeenCalled();
  });

  it('거절을 보내면 서버 답 전에 응답 필요·내 일정에서 빠지고, 실패하면 돌아온다', async () => {
    const { result, reject } = await setup();

    await act(async () => {
      result.current.reject.mutate(rejection(10));
    });

    await waitFor(() =>
      expect(ids(result.current.pending.works)).toEqual([11]),
    );
    expect(ids(result.current.week.data?.works)).not.toContain(10);

    await act(() =>
      reject.answers[0].fail(
        new ApiError({ kind: 'network', message: '네트워크' }),
      ),
    );

    await waitFor(() => expect(result.current.reject.isError).toBe(true));
    expect(ids(result.current.pending.works)).toEqual([10, 11]);
    expect(ids(result.current.week.data?.works)).toContain(10);
  });

  it('거절이 성공하면 서버 값으로 다시 받는다', async () => {
    const { result, reject, local } = await setup();
    const readPending = jest.spyOn(local, 'getPendingWorks');
    await act(async () => {
      result.current.reject.mutate(rejection(10));
    });

    await act(() => reject.answers[0].ok());

    await waitFor(() => expect(readPending).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.reject.isSuccess).toBe(true));
    expect(ids(result.current.pending.works)).toEqual([11]);
  });

  // 앞 답에 바로 다시 받으면, 서버가 아직 처리하지 않은 뒤 요청이 응답 필요에 잠깐 돌아온다
  it('잇달아 보낸 요청은 앞 답이 와도 뒤 요청이 돌아오지 않고, 마지막 답이 오면 한 번 다시 받는다', async () => {
    const { result, accept, reject, local } = await setup();
    const readPending = jest.spyOn(local, 'getPendingWorks');
    await act(async () => {
      result.current.accept.mutate({ workId: 10, assignmentNumber: 1 });
      result.current.reject.mutate(rejection(11));
    });
    await waitFor(() => expect(result.current.pending.works).toEqual([]));

    await act(() => accept.answers[0].ok());
    expect(readPending).not.toHaveBeenCalled();
    expect(result.current.pending.works).toEqual([]);

    await act(() => reject.answers[0].ok());
    await waitFor(() => expect(readPending).toHaveBeenCalledTimes(1));
    expect(result.current.pending.works).toEqual([]);
  });

  it('잇달아 보낸 요청 중 앞 요청이 성공하고 마지막 요청이 실패해도, 마지막 답이 오면 서버 값으로 다시 받는다', async () => {
    const { result, accept, reject, local } = await setup();
    const readPending = jest.spyOn(local, 'getPendingWorks');
    await act(async () => {
      result.current.accept.mutate({ workId: 10, assignmentNumber: 1 });
      result.current.reject.mutate(rejection(11));
    });

    await act(() => accept.answers[0].ok());
    await act(() =>
      reject.answers[0].fail(
        new ApiError({ kind: 'network', message: '네트워크' }),
      ),
    );

    await waitFor(() => expect(readPending).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(ids(result.current.pending.works)).toEqual([11]),
    );
  });

  // PR #209 재리뷰 재현: 성공한 결과는 캐시에 확정해 둔다. 보이지 않는 화면은 다시 받지 않으므로(#110) 무효화만으로는
  // 옛 값이 남고, 다시 받기가 실패하거나 끊겨도 옛 값이 남는다
  describe('성공한 응답은 캐시에 확정한다', () => {
    it('보이지 않는 동안 수락이 성공해도, 다시 보일 때 응답 필요·내 일정·상세가 옛 값으로 돌아가지 않는다', async () => {
      const { result, rerender, accept, local } = await setup({
        serverSchedule: true,
      });
      await act(async () => {
        result.current.accept.mutate({ workId: 10, assignmentNumber: 1 });
      });
      await waitFor(() =>
        expect(ids(result.current.pending.works)).toEqual([11]),
      );
      await rerender({ subscribed: false });
      const readPending = slowPendingReads(local);

      await act(() => accept.answers[0].ok());
      await waitFor(() => expect(result.current.accept.isSuccess).toBe(true));
      expect(readPending).not.toHaveBeenCalled();
      await rerender({ subscribed: true });

      expect(ids(result.current.pending.works)).toEqual([11]);
      expect(
        result.current.week.data?.works.map(work => [work.workId, work.status]),
      ).toEqual([
        [10, 'ACCEPTED'],
        [12, 'ACCEPTED'],
      ]);
      expect(result.current.detail.data?.workStatus).toBe('ACCEPTED');
      // 다시 보이면 서버 값을 새로 받는다 (낡았다고 표시돼 있다)
      await waitFor(() => expect(readPending).toHaveBeenCalledTimes(1));
    });

    it('수락이 성공한 뒤 다시 받기가 실패해도 요청은 응답 필요에 돌아오지 않는다', async () => {
      const { result, accept, local } = await setup();
      await act(async () => {
        result.current.accept.mutate({ workId: 10, assignmentNumber: 1 });
      });
      await waitFor(() =>
        expect(ids(result.current.pending.works)).toEqual([11]),
      );
      jest.spyOn(local, 'getPendingWorks').mockRejectedValue(networkError());

      await act(() => accept.answers[0].ok());
      await waitFor(() => expect(result.current.accept.isSuccess).toBe(true));
      await settle();

      expect(ids(result.current.pending.works)).toEqual([11]);
    });

    it('다시 받는 중에 당겨서 새로고침이 그 조회를 끊어도 요청은 응답 필요에 잠깐도 돌아오지 않는다', async () => {
      const { result, accept, local, seenPending } = await setup();
      await act(async () => {
        result.current.accept.mutate({ workId: 10, assignmentNumber: 1 });
      });
      await waitFor(() =>
        expect(ids(result.current.pending.works)).toEqual([11]),
      );
      slowPendingReads(local);
      const from = seenPending.length;

      await act(async () => {
        accept.answers[0].ok();
        await new Promise<void>(resolve => setTimeout(resolve, 20));
        // 다시 받는 중인 조회를 끊고 새로 받는다 (cancelRefetch)
        result.current.pending.refetch();
      });
      await waitFor(() => expect(result.current.accept.isSuccess).toBe(true));
      await settle();

      expect(
        seenPending.slice(from).filter(seen => seen?.includes(10)),
      ).toEqual([]);
      expect(ids(result.current.pending.works)).toEqual([11]);
    });
  });

  // PR #209 재리뷰 재현: 이미 처리됐거나 바뀐 요청(-010·-002·-016)은 서버 값을 받을 때까지 진행 중으로 둔다
  describe('서버 작업이 달라져 실패하면', () => {
    const alreadyRejected = async (server: {
      rejectWork: WorkRepository['rejectWork'];
    }) => server.rejectWork(rejection(10));
    const invalidState = () =>
      new ApiError({
        kind: 'http',
        status: 409,
        code: 'SCHEDULE-002',
        message: 'x',
      });

    it('서버 값을 받을 때까지 요청을 응답 필요에 다시 보이지 않는다', async () => {
      const { result, accept, local, server, seenPending } = await setup();
      await act(async () => {
        result.current.accept.mutate({ workId: 10, assignmentNumber: 1 });
      });
      await waitFor(() =>
        expect(ids(result.current.pending.works)).toEqual([11]),
      );
      await alreadyRejected(server);
      const readPending = slowPendingReads(local);
      const from = seenPending.length;

      await act(() => accept.answers[0].fail(invalidState()));
      await waitFor(() => expect(result.current.accept.isError).toBe(true));
      await settle();

      expect(readPending).toHaveBeenCalled();
      expect(
        seenPending.slice(from).filter(seen => seen?.includes(10)),
      ).toEqual([]);
      expect(ids(result.current.pending.works)).toEqual([11]);
    });

    it('보이지 않는 화면도 서버 값으로 바로잡아, 다시 보일 때 옛 요청이 보이지 않는다', async () => {
      const { result, rerender, accept, server } = await setup();
      await act(async () => {
        result.current.accept.mutate({ workId: 10, assignmentNumber: 1 });
      });
      await waitFor(() =>
        expect(ids(result.current.pending.works)).toEqual([11]),
      );
      await alreadyRejected(server);
      await rerender({ subscribed: false });

      await act(() => accept.answers[0].fail(invalidState()));
      await waitFor(() => expect(result.current.accept.isError).toBe(true));
      await rerender({ subscribed: true });

      expect(ids(result.current.pending.works)).toEqual([11]);
    });
  });

  // PR #209 리뷰 재현: 응답을 보내는 동안 화면이 다시 받으면(내 일정 재포커스·당겨서 새로고침) 서버는 아직 옛 값이다
  it('보내는 동안 다시 받은 목록(서버가 아직 처리 전)이 와도 보낸 요청은 응답 필요에 돌아오지 않는다', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.accept.mutate({ workId: 10, assignmentNumber: 1 });
      result.current.reject.mutate(rejection(11));
    });
    await waitFor(() => expect(result.current.pending.works).toEqual([]));

    await act(async () => {
      await result.current.pending.refetch();
      await result.current.week.refetch();
      // React Query 가 화면에 알리기까지 기다린다
      await new Promise<void>(resolve => setTimeout(resolve, 50));
    });

    expect(result.current.pending.works).toEqual([]);
    expect(
      result.current.week.data?.works.find(work => work.workId === 10)?.status,
    ).toBe('ACCEPTED');
    expect(ids(result.current.week.data?.works)).not.toContain(11);
  });

  // PR #209 리뷰 재현 ⓐ: 되돌리기가 다른 응답의 낙관 값까지 덮으면 아직 가는 중인 B 가 돌아온다
  it('겹친 응답에서 A 만 실패하면 A 만 응답 필요로 돌아오고, 가는 중인 B 는 빠진 채 내 일정에 작업전으로 남는다', async () => {
    const { result, accept } = await setup({ serverSchedule: true });
    await act(async () => {
      result.current.accept.mutate({ workId: 10, assignmentNumber: 1 });
      result.current.accept.mutate({ workId: 11, assignmentNumber: 1 });
    });
    await waitFor(() => expect(result.current.pending.works).toEqual([]));

    await act(() =>
      accept.answers[0].fail(
        new ApiError({ kind: 'network', message: '네트워크' }),
      ),
    );

    await waitFor(() =>
      expect(ids(result.current.pending.works)).toEqual([10]),
    );
    expect(
      result.current.week.data?.works.map(work => [work.workId, work.status]),
    ).toEqual([
      [11, 'ACCEPTED'],
      [12, 'ACCEPTED'],
    ]);
  });

  // PR #209 리뷰 재현 ⓑ: 둘 다 실패하면 서버(둘 다 수락 대기)와 같아야 한다
  it('겹친 응답이 둘 다 실패하면 응답 필요·내 일정·상세가 서버와 같은 보내기 전 상태로 돌아온다', async () => {
    const { result, accept, local } = await setup({ serverSchedule: true });
    await act(async () => {
      result.current.accept.mutate({ workId: 10, assignmentNumber: 1 });
      result.current.accept.mutate({ workId: 11, assignmentNumber: 1 });
    });
    await waitFor(() => expect(result.current.pending.works).toEqual([]));

    await act(() =>
      accept.answers[0].fail(
        new ApiError({ kind: 'network', message: '네트워크' }),
      ),
    );
    await act(() =>
      accept.answers[1].fail(
        new ApiError({ kind: 'network', message: '네트워크' }),
      ),
    );

    const server = await local.getPendingWorks();
    await waitFor(() =>
      expect(ids(result.current.pending.works)).toEqual(ids(server.works)),
    );
    expect(ids(server.works)).toEqual([10, 11]);
    expect(ids(result.current.week.data?.works)).toEqual([12]);
    expect(result.current.detail.data?.workStatus).toBe('PENDING_ACCEPT');
  });

  // PR #209 리뷰 재현: '마지막 응답' 판단이 비동기 체인 안에 있으면 같은 틱에 끝난 둘이 모두 미룬다
  it('같은 틱에 끝난 두 응답도 마지막 답에서 한 번 다시 받는다', async () => {
    const { result, accept, local } = await setup();
    const readPending = jest.spyOn(local, 'getPendingWorks');
    await act(async () => {
      result.current.accept.mutate({ workId: 10, assignmentNumber: 1 });
      result.current.accept.mutate({ workId: 11, assignmentNumber: 1 });
    });
    await waitFor(() => expect(accept.answers).toHaveLength(2));

    await act(async () => {
      await Promise.all([accept.answers[0].ok(), accept.answers[1].ok()]);
    });

    await waitFor(() => expect(readPending).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.accept.isSuccess).toBe(true));
    expect(result.current.pending.works).toEqual([]);
  });
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
