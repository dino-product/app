import { act, renderHook, waitFor } from '@testing-library/react-native';
import { isApiError } from '../../../shared/api';
import {
  fail,
  ok,
  type FakeResponse,
} from '../../../shared/testing/fakeServer';
import { createTestApi } from '../../../shared/testing/renderWithApi';
import { testSession } from '../../../shared/testing/session';
import { countPendingRequests } from './model';
import { OrganizationErrorCode } from './participationApi';
import { membershipsQueryKey } from '../memberships';
import {
  participationRequestsKey,
  useCancelParticipationRequest,
  useFetchParticipationRequests,
  useParticipationRequest,
  useParticipationRequests,
  useRequestParticipation,
} from './participationQueries';
import {
  createParticipationServer,
  EXISTING_REQUESTS,
  type ParticipationFake,
} from './testing';

function setup(requests = EXISTING_REQUESTS) {
  const participation = createParticipationServer({ requests });
  const api = createTestApi({
    server: participation.server,
    session: testSession(),
  });
  return { participation, ...api };
}

const statusOf = (participation: ParticipationFake, requestId: number) =>
  participation.requests.find(item => item.requestId === requestId)?.status;

describe('useParticipationRequests', () => {
  it('신청 현황을 서버 목록으로 받고, select 로 고른 값만 준다', async () => {
    const { wrapper } = setup();

    const { result } = await renderHook(
      () => useParticipationRequests(countPendingRequests),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toBe(2));
  });

  it('id 로 요청 하나를 고르고, 목록에 없으면 null 이다', async () => {
    const { wrapper } = setup();

    const { result } = await renderHook(
      () => ({
        rejected: useParticipationRequest('3'),
        gone: useParticipationRequest('404'),
      }),
      { wrapper },
    );

    await waitFor(() =>
      expect(result.current.rejected.data).toMatchObject({
        requestId: '3',
        status: 'REJECTED',
      }),
    );
    expect(result.current.gone.data).toBeNull();
  });

  // 승인되면 소속(GET /api/v1/memberships, #114)이 바뀐다. 기사 작업 화면이 새 발주사를 쓰게 소속 조회를 다시 부른다
  it('다시 받은 목록에 새로 승인된 요청이 있으면 소속 조회를 무효로 만든다', async () => {
    const { wrapper, participation, queryClient } = setup();
    queryClient.setQueryData(membershipsQueryKey, []);
    const membershipsInvalidated = () =>
      queryClient.getQueryState(membershipsQueryKey)?.isInvalidated;
    const { result } = await renderHook(() => useParticipationRequests(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(membershipsInvalidated()).toBe(false);

    participation.decide({ status: 'APPROVED' }, 1);
    await act(() => result.current.refetch());

    expect(membershipsInvalidated()).toBe(true);
  });

  it('승인이 새로 생기지 않았으면 소속 조회는 그대로다', async () => {
    const { wrapper, participation, queryClient } = setup();
    queryClient.setQueryData(membershipsQueryKey, []);
    const { result } = await renderHook(() => useParticipationRequests(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    participation.decide({ status: 'REJECTED' }, 1);
    await act(() => result.current.refetch());

    expect(queryClient.getQueryState(membershipsQueryKey)?.isInvalidated).toBe(
      false,
    );
  });
});

describe('useFetchParticipationRequests', () => {
  it('캐시가 있어도 서버에서 새로 받아 캐시를 바꾼다 (온보딩 결과 확인)', async () => {
    const { wrapper, participation, queryClient, server } = setup();
    const { result } = await renderHook(() => useFetchParticipationRequests(), {
      wrapper,
    });
    await act(() => result.current());
    participation.decide({ status: 'APPROVED', confirmedType: 'STAFF' }, 2);

    const requests = await act(() => result.current());

    expect(requests.find(item => item.requestId === '2')).toMatchObject({
      status: 'APPROVED',
      approvedType: 'STAFF',
    });
    expect(queryClient.getQueryData(participationRequestsKey)).toEqual(
      requests,
    );
    expect(
      server.callsTo('GET', '/api/v1/participation-requests'),
    ).toHaveLength(2);
  });
});

describe('useRequestParticipation', () => {
  it('보낸 요청을 받아 둔 신청 현황에 바로 더하고, 목록을 다시 받는다', async () => {
    const { wrapper, queryClient, server, participation } = setup();
    const { result } = await renderHook(
      () => ({
        list: useParticipationRequests(countPendingRequests),
        request: useRequestParticipation(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.data).toBe(2));
    // 다시 받는 목록은 테스트가 내보낼 때까지 잡아 둔다 (응답으로 바로 더했는지 본다)
    let release: () => void = () => {};
    server.on(
      'GET',
      '/api/v1/participation-requests',
      () =>
        new Promise<FakeResponse>(done => {
          release = () => done(ok({ requests: participation.requests }));
        }),
    );

    const created = await act(() =>
      result.current.request.mutateAsync({
        companyCode: 'RBT124',
        desiredType: 'TECHNICIAN',
        requestChannel: 'COMPANY_CODE',
      }),
    );

    expect(created).toMatchObject({
      organizationName: 'Orbit',
      status: 'PENDING',
      requestChannel: 'COMPANY_CODE',
    });
    expect(
      queryClient
        .getQueryData<{ requestId: string }[]>(participationRequestsKey)
        ?.map(item => item.requestId),
    ).toEqual(['3', '1', '2', created.requestId]);
    await waitFor(() => expect(result.current.list.data).toBe(3));
    expect(
      server.callsTo('GET', '/api/v1/participation-requests'),
    ).toHaveLength(2);
    await act(async () => release());
  });

  it('받아 둔 목록이 없으면 만들지 않는다 (처음 열 때 서버 목록을 받는다)', async () => {
    const { wrapper, queryClient } = setup([]);
    const { result } = await renderHook(() => useRequestParticipation(), {
      wrapper,
    });

    await act(() =>
      result.current.mutateAsync({
        companyCode: '123456',
        desiredType: 'TECHNICIAN',
        requestChannel: 'COMPANY_CODE',
      }),
    );

    expect(queryClient.getQueryData(participationRequestsKey)).toBeUndefined();
  });

  it('실패하면 신청 현황을 바꾸지 않는다', async () => {
    const { wrapper, queryClient } = setup();
    const { result } = await renderHook(
      () => ({
        list: useParticipationRequests(),
        request: useRequestParticipation(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    const before = queryClient.getQueryData(participationRequestsKey);

    const error = await act(() =>
      result.current.request
        .mutateAsync({
          companyCode: 'HB0010',
          desiredType: 'TECHNICIAN',
          requestChannel: 'COMPANY_CODE',
        })
        .catch(caught => caught),
    );

    expect(isApiError(error, OrganizationErrorCode.pendingRequest)).toBe(true);
    expect(queryClient.getQueryData(participationRequestsKey)).toBe(before);
  });
});

describe('useCancelParticipationRequest', () => {
  it('취소하면 받아 둔 목록의 상태를 바로 바꾸고 다시 받는다', async () => {
    const { wrapper, participation } = setup();
    const { result } = await renderHook(
      () => ({
        pending: useParticipationRequests(countPendingRequests),
        cancel: useCancelParticipationRequest(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.pending.data).toBe(2));

    await act(() => result.current.cancel.mutateAsync('1'));

    await waitFor(() => expect(result.current.pending.data).toBe(1));
    expect(statusOf(participation, 1)).toBe('CANCELED');
  });

  // 사무실이 그사이 승인·거절했다. 받아 둔 목록은 옛 상태라 다시 받는다
  it('이미 처리된 요청(ORGANIZATION-017)이면 목록을 다시 받아 서버 상태로 맞춘다', async () => {
    const { wrapper, participation } = setup();
    const { result } = await renderHook(
      () => ({
        request: useParticipationRequest('1'),
        cancel: useCancelParticipationRequest(),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.request.data?.status).toBe('PENDING'),
    );
    participation.decide({ status: 'APPROVED' }, 1);

    const error = await act(() =>
      result.current.cancel.mutateAsync('1').catch(caught => caught),
    );

    expect(isApiError(error, OrganizationErrorCode.alreadyDecided)).toBe(true);
    await waitFor(() =>
      expect(result.current.request.data?.status).toBe('APPROVED'),
    );
  });

  it('없는·다른 계정의 요청(ORGANIZATION-016)이어도 목록을 다시 받는다', async () => {
    const { wrapper, server } = setup();
    server.on(
      'POST',
      '/api/v1/participation-requests/1/cancel',
      fail(403, OrganizationErrorCode.notOwnRequest),
    );
    const { result } = await renderHook(
      () => ({
        request: useParticipationRequest('1'),
        cancel: useCancelParticipationRequest(),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.request.data?.status).toBe('PENDING'),
    );

    await act(() =>
      result.current.cancel.mutateAsync('1').catch(() => undefined),
    );

    await waitFor(() =>
      expect(
        server.callsTo('GET', '/api/v1/participation-requests'),
      ).toHaveLength(2),
    );
  });

  it('그 밖의 실패(네트워크 등)는 목록을 바꾸지 않는다', async () => {
    const { wrapper, server } = setup();
    server.on('POST', '/api/v1/participation-requests/1/cancel', () => ({
      type: 'networkError',
    }));
    const { result } = await renderHook(
      () => ({
        request: useParticipationRequest('1'),
        cancel: useCancelParticipationRequest(),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.request.data?.status).toBe('PENDING'),
    );

    await act(() =>
      result.current.cancel.mutateAsync('1').catch(() => undefined),
    );

    expect(result.current.request.data?.status).toBe('PENDING');
    expect(
      server.callsTo('GET', '/api/v1/participation-requests'),
    ).toHaveLength(1);
  });
});
