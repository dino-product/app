import { render, screen } from '@testing-library/react-native';
import { boxOf } from '../../../shared/testing/skeleton';
import { CompletedWorkRow } from '../../history/components/CompletedWorkRow';
import type { HostElement } from '../../../shared/testing/touchTarget';
import { weeklySchedule, workDetail } from '../mockData';
import { ScheduleCard } from './ScheduleCard';
import { WorkInfoSections } from './WorkInfoSections';
import {
  WorkDetailSkeleton,
  WorkHomeSkeleton,
  WorkRowsSkeleton,
} from './WorkSkeletons';

// 받은 내용으로 바뀔 때 높이가 크게 튀지 않도록 (#139), 되풀이되는 카드·행 스켈레톤은 실제 컴포넌트와 같은
// 상자(여백·간격·모서리·테두리)를 쓴다. 줄 높이는 글자 스타일의 줄 높이다 (Skeleton.test)
const noop = () => {};

describe('작업 스켈레톤', () => {
  it('메인화면의 일정 카드 스켈레톤은 실제 일정 카드(ScheduleCard)와 같은 상자다', async () => {
    await render(<ScheduleCard item={weeklySchedule[0]} onPress={noop} />);
    const real = boxOf(screen.getByRole('button'));

    await render(<WorkHomeSkeleton block={false} />);

    const cards = screen.getAllByTestId('schedule-card-skeleton');
    expect(cards).toHaveLength(3);
    expect(boxOf(cards[0])).toEqual(real);
  });

  it('작업 행 스켈레톤은 완료 작업 행(CompletedWorkRow)과 같은 상자다', async () => {
    await render(
      <CompletedWorkRow
        item={{
          id: 'w1',
          title: '세탁기 설치',
          company: '한빛 설비',
          customerName: '정다은',
          address: '서울 용산구 이태원로 202',
          dateKey: '2026-09-26',
          start: '08:00',
          end: '09:00',
        }}
        onPress={noop}
      />,
    );
    const completed = boxOf(screen.getByRole('button'));

    await render(<WorkRowsSkeleton />);

    const rows = screen.getAllByTestId('work-row-skeleton');
    expect(rows).toHaveLength(3);
    expect(boxOf(rows[0])).toEqual(completed);
  });

  it('작업 상세 스켈레톤은 실제 정보 영역(WorkInfoSections)의 요약·일정 카드·고객 카드와 같은 상자다', async () => {
    await render(
      <WorkInfoSections work={workDetail} onCall={noop} onNavigate={noop} />,
    );
    const titleRow = screen.getByText(workDetail.title).parent as HostElement;
    const cardOf = (section: string) =>
      (screen.getByRole('header', { name: section }).parent as HostElement)
        .children[1] as HostElement;
    const real = {
      summary: boxOf(titleRow.parent as HostElement),
      titleRow: boxOf(titleRow),
      schedule: boxOf(cardOf('일정 및 담당 정보')),
      customer: boxOf(cardOf('고객 정보')),
    };

    await render(<WorkDetailSkeleton />);

    const part = (name: string) =>
      boxOf(screen.getByTestId(`work-detail-skeleton-${name}`));
    expect(part('summary')).toEqual(real.summary);
    expect(part('title')).toEqual(real.titleRow);
    expect(part('schedule')).toEqual(real.schedule);
    expect(part('customer')).toEqual(real.customer);
  });
});
