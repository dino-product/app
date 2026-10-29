import { act, renderHook } from '@testing-library/react-native';
import type { ConfirmedSchedule, PendingRequest } from './model';
import { useScheduleStore } from './useScheduleStore';

const confirmed: ConfirmedSchedule[] = [
  {
    id: 'c1',
    dateKey: '2026-12-15',
    title: '세탁기 설치',
    status: 'assigned',
    timeRange: '08:00 - 09:00',
    company: '한빛 설비',
    customerName: '정다은',
    address: '서울 용산구 이태원로 202',
  },
];

const pending: PendingRequest[] = [
  {
    id: 'p1',
    dateKey: '2026-12-20',
    dateLabel: '12/20',
    title: '에어컨 필터 교체',
    status: 'assigned',
    timeRange: '14:00 – 15:00',
    company: '한빛 설비',
    customerName: '정다은',
    address: '서울 용산구 이태원로 202',
  },
];

describe('useScheduleStore', () => {
  it('수락하면 요청이 확정 일정으로 옮겨진다', async () => {
    const { result } = await renderHook(() =>
      useScheduleStore({ confirmed, pending }),
    );

    await act(() => result.current.accept('p1'));

    expect(result.current.pending).toHaveLength(0);
    expect(result.current.confirmed.map(item => item.id)).toEqual(['c1', 'p1']);
    expect(result.current.confirmed[1]).toMatchObject({
      dateKey: '2026-12-20',
      timeRange: '14:00 – 15:00',
    });
  });

  it('거절하면 요청이 목록에서 빠진다', async () => {
    const { result } = await renderHook(() =>
      useScheduleStore({ confirmed, pending }),
    );

    await act(() => result.current.reject('p1'));

    expect(result.current.pending).toHaveLength(0);
    expect(result.current.confirmed).toHaveLength(1);
  });

  it('없는 요청 id 는 무시한다', async () => {
    const { result } = await renderHook(() =>
      useScheduleStore({ confirmed, pending }),
    );

    await act(() => result.current.accept('nope'));

    expect(result.current.pending).toHaveLength(1);
    expect(result.current.confirmed).toHaveLength(1);
  });
});
