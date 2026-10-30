import { render, screen, userEvent } from '@testing-library/react-native';
import type { ConfirmedSchedule, PendingRequest } from '../model';
import { ScheduleScreen } from './ScheduleScreen';

const today = new Date(2026, 11, 15); // 화요일

const base = {
  status: 'assigned' as const,
  timeRange: '08:00 - 09:00',
  company: '한빛 설비',
  customerName: '정다은',
  address: '서울 용산구 이태원로 202',
};

const confirmed: ConfirmedSchedule[] = [
  { ...base, id: 'c1', dateKey: '2026-12-15', title: '세탁기 설치' },
  {
    ...base,
    id: 'c2',
    dateKey: '2026-12-15',
    title: '보일러 점검',
    status: 'beforeWork',
  },
  { ...base, id: 'c3', dateKey: '2026-12-16', title: '도어록 교체' },
  { ...base, id: 'c4', dateKey: '2027-01-04', title: '에어컨 청소' },
];

const pending: PendingRequest[] = [
  {
    ...base,
    id: 'p1',
    dateKey: '2026-12-20',
    dateLabel: '12/20',
    title: '에어컨 필터 교체',
    timeRange: '14:00 – 15:00',
  },
  {
    ...base,
    id: 'p2',
    dateKey: '2026-12-21',
    dateLabel: '12/21',
    title: '수전 교체',
    timeRange: '10:00 – 11:00',
  },
];

const renderSchedule = (
  overrides: Partial<Parameters<typeof ScheduleScreen>[0]> = {},
) =>
  render(
    <ScheduleScreen
      today={today}
      confirmed={confirmed}
      pending={pending}
      onAccept={jest.fn()}
      onReject={jest.fn()}
      onOpenRequest={jest.fn()}
      {...overrides}
    />,
  );

describe('ScheduleScreen — 확정 일정', () => {
  it('헤더와 탭(선택한 날의 확정 건수, 응답 필요 건수)을 보여준다', async () => {
    await renderSchedule();

    expect(screen.getByRole('header', { name: '내 일정' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: '확정 일정 2건' })).toBeSelected();
    expect(
      screen.getByRole('tab', { name: '응답 필요 2건' }),
    ).toBeOnTheScreen();
  });

  it('오늘 날짜를 선택한 채로 그날의 일정만 보여준다', async () => {
    await renderSchedule();

    expect(screen.getByText('2026년 12월 15일 (화)')).toBeOnTheScreen();
    expect(screen.getByText('세탁기 설치')).toBeOnTheScreen();
    expect(screen.getByText('보일러 점검')).toBeOnTheScreen();
    expect(screen.queryByText('도어록 교체')).not.toBeOnTheScreen();
  });

  it('주간 줄에서 날짜를 고르면 날짜 머리와 목록이 바뀐다', async () => {
    await renderSchedule();

    await userEvent.press(
      screen.getByRole('button', { name: '12월 16일 수요일' }),
    );

    expect(
      screen.getByRole('button', { name: '12월 16일 수요일' }),
    ).toBeSelected();
    expect(screen.getByText('2026년 12월 16일 (수)')).toBeOnTheScreen();
    expect(screen.getByText('도어록 교체')).toBeOnTheScreen();
    expect(screen.queryByText('세탁기 설치')).not.toBeOnTheScreen();
    expect(
      screen.getByRole('tab', { name: '확정 일정 1건' }),
    ).toBeOnTheScreen();
  });

  it('일정이 없는 날은 안내 문구를 보여준다', async () => {
    await renderSchedule();

    await userEvent.press(
      screen.getByRole('button', { name: '12월 17일 목요일' }),
    );

    expect(screen.getByText('예정된 일정이 없습니다')).toBeOnTheScreen();
  });

  it('달력을 펼쳐 다음 달로 가서 날짜를 고를 수 있다', async () => {
    await renderSchedule();

    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));
    expect(screen.getByText('2026년 12월')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '다음 달' }));
    expect(screen.getByText('2027년 1월')).toBeOnTheScreen();

    await userEvent.press(
      screen.getByRole('button', { name: '1월 4일 월요일' }),
    );
    expect(screen.getByText('2027년 1월 4일 (월)')).toBeOnTheScreen();
    expect(screen.getByText('에어컨 청소')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '이전 달' }));
    expect(screen.getByText('2026년 12월')).toBeOnTheScreen();
  });

  it('달력을 접으면 주간 줄로 돌아온다', async () => {
    await renderSchedule();

    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));
    await userEvent.press(screen.getByRole('button', { name: '달력 접기' }));

    expect(screen.queryByText('2026년 12월')).not.toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: '12월 15일 화요일' }),
    ).toBeOnTheScreen();
  });
});

describe('ScheduleScreen — 응답 필요', () => {
  it('요청 카드를 보여주고 수락·거절·상세 콜백을 부른다', async () => {
    const onAccept = jest.fn();
    const onReject = jest.fn();
    const onOpenRequest = jest.fn();
    await renderSchedule({ onAccept, onReject, onOpenRequest });

    await userEvent.press(screen.getByRole('tab', { name: '응답 필요 2건' }));

    expect(screen.getByText('에어컨 필터 교체')).toBeOnTheScreen();
    expect(screen.getByText('12/20 · 14:00 – 15:00')).toBeOnTheScreen();

    await userEvent.press(
      screen.getByRole('button', { name: '에어컨 필터 교체 수락' }),
    );
    await userEvent.press(
      screen.getByRole('button', { name: '수전 교체 거절' }),
    );
    await userEvent.press(
      screen.getByRole('button', { name: /^에어컨 필터 교체 상세/ }),
    );

    expect(onAccept).toHaveBeenCalledWith('p1');
    expect(onReject).toHaveBeenCalledWith('p2');
    expect(onOpenRequest).toHaveBeenCalledWith('p1');
  });

  it('요청이 없으면 안내 문구를 보여준다', async () => {
    await renderSchedule({ pending: [] });

    await userEvent.press(screen.getByRole('tab', { name: '응답 필요 0건' }));

    expect(screen.getByText('응답할 요청이 없습니다')).toBeOnTheScreen();
  });

  describe('ScheduleScreen — 정렬·접근성', () => {
    it('그날 일정을 시작 시각 순으로 보여준다', async () => {
      await renderSchedule({
        confirmed: [
          {
            ...base,
            id: 'late',
            dateKey: '2026-12-15',
            title: '늦은 일정',
            timeRange: '15:00 - 16:00',
          },
          {
            ...base,
            id: 'early',
            dateKey: '2026-12-15',
            title: '이른 일정',
            timeRange: '08:00 - 09:00',
          },
        ],
      });

      const titles = screen
        .getAllByText(/일정$/)
        .map(node => node.props.children)
        .filter(text => text === '늦은 일정' || text === '이른 일정');
      expect(titles).toEqual(['이른 일정', '늦은 일정']);
    });

    it('확정 일정 행은 누를 수 없으므로 버튼으로 노출하지 않는다', async () => {
      await renderSchedule();

      expect(
        screen.queryByRole('button', { name: /^세탁기 설치,/ }),
      ).toBeNull();
      expect(screen.getByLabelText(/^세탁기 설치, 배정됨/)).toBeOnTheScreen();
    });
  });
});
