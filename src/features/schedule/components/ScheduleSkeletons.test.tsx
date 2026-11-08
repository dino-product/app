import { render, screen } from '@testing-library/react-native';
import { boxOf } from '../../../shared/testing/skeleton';
import { PendingRequestCard } from './ScheduleRows';
import { PendingRequestsSkeleton } from './ScheduleSkeletons';

const noop = () => {};

// 받은 내용으로 바뀔 때 높이가 크게 튀지 않도록 (#139) 실제 요청 카드와 같은 상자를 쓴다
describe('PendingRequestsSkeleton', () => {
  it('요청 카드 스켈레톤의 본문은 실제 응답 필요 카드(PendingRequestCard)의 본문과 같은 상자다', async () => {
    await render(
      <PendingRequestCard
        item={{
          id: 'p1',
          dateKey: '2026-12-15',
          title: '에어컨 필터 교체',
          status: 'assigned',
          timeRange: '14:00 – 15:00',
          dateLabel: '9/20',
          company: '한빛 설비',
          customerName: '정다은',
          address: '서울 용산구 이태원로 202',
        }}
        onAccept={noop}
        onReject={noop}
        onOpen={noop}
      />,
    );
    const real = boxOf(screen.getByRole('button', { name: /상세/ }));

    await render(<PendingRequestsSkeleton />);

    const bodies = screen.getAllByTestId('pending-request-skeleton-body');
    expect(bodies).toHaveLength(2);
    expect(boxOf(bodies[0])).toEqual(real);
  });
});
