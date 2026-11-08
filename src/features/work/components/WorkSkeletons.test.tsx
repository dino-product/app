import { render, screen } from '@testing-library/react-native';
import { boxOf } from '../../../shared/testing/skeleton';
import { CompletedWorkRow } from '../../history/components/CompletedWorkRow';
import { ConfirmedRow } from '../../schedule/components/ScheduleRows';
import { weeklySchedule } from '../mockData';
import { ScheduleCard } from './ScheduleCard';
import { WorkHomeSkeleton, WorkRowsSkeleton } from './WorkSkeletons';

// 받은 내용으로 바뀔 때 높이가 크게 튀지 않도록 (#139), 되풀이되는 카드·행 스켈레톤은 실제 컴포넌트와 같은
// 상자(여백·간격·모서리·테두리)를 쓴다. 줄 높이는 글자 스타일의 줄 높이다 (Skeleton.test)
const noop = () => {};

describe('작업 스켈레톤', () => {
  it('메인화면의 일정 카드 스켈레톤은 실제 일정 카드(ScheduleCard)와 같은 상자다', async () => {
    await render(<ScheduleCard item={weeklySchedule[0]} onPress={noop} />);
    const real = boxOf(screen.getByRole('button'));

    await render(<WorkHomeSkeleton />);

    const cards = screen.getAllByTestId('schedule-card-skeleton');
    expect(cards).toHaveLength(3);
    expect(boxOf(cards[0])).toEqual(real);
  });

  it('작업 행 스켈레톤은 확정 일정 행(ConfirmedRow)·완료 작업 행(CompletedWorkRow)과 같은 상자다', async () => {
    const work = {
      id: 'w1',
      title: '세탁기 설치',
      company: '한빛 설비',
      customerName: '정다은',
      address: '서울 용산구 이태원로 202',
    };
    await render(
      <ConfirmedRow
        item={{
          ...work,
          dateKey: '2026-12-15',
          status: 'assigned',
          timeRange: '08:00 - 09:00',
        }}
      />,
    );
    const confirmed = boxOf(screen.getByLabelText(/^세탁기 설치, /));
    await render(
      <CompletedWorkRow
        item={{ ...work, dateKey: '2026-09-26', start: '08:00', end: '09:00' }}
        onPress={noop}
      />,
    );
    const completed = boxOf(screen.getByRole('button'));

    await render(<WorkRowsSkeleton />);

    const rows = screen.getAllByTestId('work-row-skeleton');
    expect(rows).toHaveLength(3);
    expect(boxOf(rows[0])).toEqual(confirmed);
    expect(boxOf(rows[0])).toEqual(completed);
  });
});
