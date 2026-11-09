import { render, screen } from '@testing-library/react-native';
import { boxOf } from '../../../shared/testing/skeleton';
import type { HostElement } from '../../../shared/testing/touchTarget';
import type { ConfirmedSchedule } from '../model';
import { ConfirmedRow, PendingRequestCard } from './ScheduleRows';
import {
  ConfirmedCardsSkeleton,
  PendingRequestsSkeleton,
} from './ScheduleSkeletons';

const noop = () => {};

const item: ConfirmedSchedule = {
  id: 'c1',
  dateKey: '2026-12-15',
  title: '에어컨 필터 교체',
  status: 'assigned',
  timeRange: '14:00 – 15:00',
  company: '한빛 설비',
  customerName: '정다은',
  address: '서울 용산구 이태원로 202',
};

// 받은 내용으로 바뀔 때 높이가 크게 튀지 않도록 (#139) 실제 카드(#143 흰 카드)와 같은 상자를 쓴다
describe('내 일정 스켈레톤', () => {
  it('확정 일정 카드 스켈레톤은 실제 확정 일정 카드(ConfirmedRow)와 같은 상자다', async () => {
    await render(<ConfirmedRow item={item} dayLabel="12.15 (화)" />);
    const real = boxOf(screen.getByLabelText(/^에어컨 필터 교체, /));

    await render(<ConfirmedCardsSkeleton />);

    const cards = screen.getAllByTestId('confirmed-card-skeleton');
    expect(cards).toHaveLength(3);
    expect(boxOf(cards[0])).toEqual(real);
  });

  it('요청 카드 스켈레톤은 실제 응답 필요 카드(PendingRequestCard)와 카드·본문·버튼 줄 상자가 같다', async () => {
    await render(
      <PendingRequestCard
        item={item}
        dayLabel="12.15 (화)"
        onAccept={noop}
        onReject={noop}
        onOpen={noop}
      />,
    );
    const body = screen.getByRole('button', { name: /상세/ });
    const card = body.parent as HostElement;
    const actions = card.children[1] as HostElement;
    const real = {
      card: boxOf(card),
      body: boxOf(body),
      actions: boxOf(actions),
    };

    await render(<PendingRequestsSkeleton />);

    const cards = screen.getAllByTestId('pending-request-skeleton');
    expect(cards).toHaveLength(2);
    expect(boxOf(cards[0])).toEqual(real.card);
    expect(boxOf(cards[0].children[0] as HostElement)).toEqual(real.body);
    expect(boxOf(cards[0].children[1] as HostElement)).toEqual(real.actions);
  });
});
