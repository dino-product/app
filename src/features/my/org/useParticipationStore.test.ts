import { act, renderHook } from '@testing-library/react-native';
import type { Membership } from '../model';
import { useParticipationStore } from './useParticipationStore';

const orbit = { organizationId: 'org-9', organizationName: 'Orbit' };
const noMemberships: readonly Membership[] = [];

const renderStore = () =>
  renderHook(() => useParticipationStore([], noMemberships));

describe('useParticipationStore', () => {
  it('참여를 요청하면 승인 대기 요청이 생기고, 같은 회사를 찾으면 대기 중이다', async () => {
    const { result } = await renderStore();

    let requestId = '';
    await act(() => {
      requestId = result.current.requestParticipation(
        orbit,
        'TECHNICIAN',
      ).requestId;
    });

    expect(result.current.requests).toEqual([
      expect.objectContaining({
        requestId,
        organizationId: 'org-9',
        desiredType: 'TECHNICIAN',
        status: 'PENDING',
        requestChannel: 'COMPANY_CODE',
      }),
    ]);
    expect(await result.current.lookupCompany('123456')).toEqual({
      kind: 'pending',
      organization: orbit,
    });
  });

  it('요청을 취소하면 같은 코드로 다시 찾을 수 있다', async () => {
    const { result } = await renderStore();
    let requestId = '';
    await act(() => {
      requestId = result.current.requestParticipation(orbit, 'STAFF').requestId;
    });

    await act(() => result.current.cancelRequest(requestId));

    expect(result.current.requests[0].status).toBe('CANCELED');
    expect(await result.current.lookupCompany('123456')).toEqual({
      kind: 'found',
      organization: orbit,
    });
  });

  it('승인으로 결정하면 확정 유형과 결정 시각을 남기고, 그 회사는 이미 참여 중이 된다', async () => {
    const { result } = await renderStore();
    let requestId = '';
    await act(() => {
      requestId = result.current.requestParticipation(
        orbit,
        'TECHNICIAN',
      ).requestId;
    });
    const at = new Date(2026, 8, 23, 11, 0);

    await act(() =>
      result.current.decideRequest(
        requestId,
        { status: 'APPROVED', approvedType: 'STAFF' },
        at,
      ),
    );

    expect(result.current.requests[0]).toMatchObject({
      status: 'APPROVED',
      approvedType: 'STAFF',
      decidedAt: at.toISOString(),
    });
    expect(await result.current.lookupCompany('123456')).toEqual({
      kind: 'alreadyMember',
      organization: orbit,
    });
  });

  it('거절로 결정하면 사유를 남기고, 같은 코드로 다시 요청할 수 있다', async () => {
    const { result } = await renderStore();
    let requestId = '';
    await act(() => {
      requestId = result.current.requestParticipation(
        orbit,
        'TECHNICIAN',
      ).requestId;
    });

    await act(() =>
      result.current.decideRequest(requestId, {
        status: 'REJECTED',
        rejectReason: '사유',
      }),
    );

    expect(result.current.requests[0]).toMatchObject({
      status: 'REJECTED',
      rejectReason: '사유',
    });
    expect((await result.current.lookupCompany('123456')).kind).toBe('found');
  });

  it('요청 id 는 처음 받은 요청 다음 번호부터 매긴다', async () => {
    const { result } = await renderHook(() =>
      useParticipationStore(
        [
          {
            ...orbit,
            requestId: 'request-1',
            desiredType: 'STAFF',
            status: 'REJECTED',
            requestChannel: 'COMPANY_CODE',
            requestedAt: '2026-09-20T01:00:00Z',
          },
        ],
        noMemberships,
      ),
    );

    let requestId = '';
    await act(() => {
      requestId = result.current.requestParticipation(orbit, 'STAFF').requestId;
    });

    expect(requestId).toBe('request-2');
  });
});
