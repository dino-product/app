import {
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import { drag } from '../../../../jest/gesture';
import { holdNativeAnimations } from '../../../../jest/nativeAnimation';
import { colors } from '../../../shared/design-system';
import { iconSvgs } from '../../../shared/design-system/icons/svgs';
import { iconSvgIn } from '../../../shared/testing/icon';
import { stylePt, type HostElement } from '../../../shared/testing/touchTarget';
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

const weekStrip = () => screen.getByTestId('week-strip').props;

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

  it('주간 줄을 왼쪽으로 밀면 다음 주의 같은 요일을 고른다', async () => {
    await renderSchedule();

    await drag(weekStrip(), { dx: -80 });

    expect(screen.getByText('2026년 12월 22일 (화)')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: '12월 22일 화요일' }),
    ).toBeSelected();
    expect(
      screen.getByRole('button', { name: '12월 20일 일요일' }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: '12월 15일 화요일' }),
    ).not.toBeOnTheScreen();
    expect(screen.getByText('예정된 일정이 없습니다')).toBeOnTheScreen();
  });

  it('주간 줄을 오른쪽으로 밀면 이전 주의 같은 요일을 고른다', async () => {
    await renderSchedule();

    await drag(weekStrip(), { dx: 80 });

    expect(screen.getByText('2026년 12월 8일 (화)')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: '12월 6일 일요일' }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: '12월 13일 일요일' }),
    ).not.toBeOnTheScreen();
  });

  it('주간 줄을 끌어 넘기면 다 넘어간 뒤에 날짜와 일정이 바뀐다', async () => {
    const { finish } = holdNativeAnimations();
    try {
      await renderSchedule();
      await fireEvent(screen.getByTestId('week-strip-track'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 69 } },
      });

      await drag(weekStrip(), { dx: -80 });
      expect(screen.getByText('2026년 12월 15일 (화)')).toBeOnTheScreen();
      expect(screen.getByText('세탁기 설치')).toBeOnTheScreen();

      await finish();
      expect(screen.getByText('2026년 12월 22일 (화)')).toBeOnTheScreen();
      expect(screen.getByText('예정된 일정이 없습니다')).toBeOnTheScreen();
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('주를 넘겨 달이 바뀌면 달력도 그 달을 펼친다', async () => {
    await renderSchedule();

    await drag(weekStrip(), { dx: -80 });
    await drag(weekStrip(), { dx: -80 });
    await drag(weekStrip(), { dx: -80 });

    expect(screen.getByText('2027년 1월 5일 (화)')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));
    expect(screen.getByText('2027년 1월')).toBeOnTheScreen();
  });

  it('VoiceOver 로 날짜의 다음 주 동작을 부르면 그 요일을 다음 주에서 고르고 읽어 준다', async () => {
    const announce = jest.mocked(
      AccessibilityInfo.announceForAccessibilityWithOptions,
    );
    announce.mockClear();
    await renderSchedule();

    await fireEvent(
      screen.getByRole('button', { name: '12월 16일 수요일' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'nextWeek' } },
    );

    expect(screen.getByText('2026년 12월 23일 (수)')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: '12월 23일 수요일' }),
    ).toBeSelected();
    expect(announce).toHaveBeenCalledWith('12월 23일 수요일', { queue: true });
  });

  it('주간 줄을 가로로 밀 때 확정 일정 리스트가 세로로 따라 움직이지 않게 방향을 고정한다', async () => {
    await renderSchedule();

    let list = screen.getByTestId('week-strip');
    while (list.parent && list.type !== 'RCTScrollView') {
      list = list.parent;
    }

    expect(list.type).toBe('RCTScrollView');
    expect(list.props.directionalLockEnabled).toBe(true);
  });

  it('펼친 달력을 좌우로 밀면 다음·이전 달로 간다', async () => {
    await renderSchedule();
    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));

    await drag(screen.getByTestId('month-calendar').props, { dx: -80 });
    expect(screen.getByText('2027년 1월')).toBeOnTheScreen();

    await drag(screen.getByTestId('month-calendar').props, { dx: 80 });
    await drag(screen.getByTestId('month-calendar').props, { dx: 80 });
    expect(screen.getByText('2026년 11월')).toBeOnTheScreen();
    // 달을 넘겨 보기만 하고 고른 날은 그대로다
    expect(screen.getByText('2026년 12월 15일 (화)')).toBeOnTheScreen();
  });

  // Figma 는 접힘·펼침에서 모양이 좌우로 뒤집혀 있고 색도 다르다
  it('날짜 줄 오른쪽 버튼은 주간·달력 모두 Figma 의 달력 전환 아이콘이다', async () => {
    await renderSchedule();

    const toggleSvg = () =>
      iconSvgIn(screen.getByRole('button', { name: /^달력 (펼치기|접기)$/ }));
    expect(toggleSvg().props).toMatchObject({
      xml: iconSvgs['calendar-switch'].xml,
      color: colors.gray[500],
    });

    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));
    expect(toggleSvg().props).toMatchObject({
      xml: iconSvgs['calendar-switch-open'].xml,
      color: colors.gray[800],
    });
  });

  // Figma: 제목은 상태 막대 아래 8, 제목과 탭 사이 24. 머리말 아래에 그림자가 리스트 위로 드리운다
  it('머리말은 제목 위 8, 제목과 탭 사이 24 이고 아래에 그림자가 있다', async () => {
    await renderSchedule();

    const title = screen.getByRole('header', { name: '내 일정' });
    const tab = screen.getByRole('tab', { name: '확정 일정 2건' });
    expect(title).toHaveStyle({ paddingTop: 8 });
    expect(stylePt(title, 'paddingBottom') + stylePt(tab, 'paddingTop')).toBe(
      24,
    );
    expect(title.parent?.parent).toHaveStyle({
      boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.04)',
      zIndex: 1,
    });
  });

  it('주간 줄 위 구분선은 화면 가장자리에서 24 안쪽이다', async () => {
    await renderSchedule();

    const weekArea = screen.getByTestId('week-strip').parent as HostElement;
    const rule = weekArea.children[0] as HostElement;
    expect(
      stylePt(weekArea, 'paddingHorizontal') +
        stylePt(rule, 'marginHorizontal'),
    ).toBe(24);
  });

  // Figma: 날짜 줄 좌우 24, 주간 줄은 좌우 10·위아래 20 (구분선 포함), 펼친 달력은 좌우·위아래 24 (구분선 없음)
  it('주간 줄과 펼친 달력은 Figma 여백 안에 놓인다', async () => {
    await renderSchedule();

    const weekArea = screen.getByTestId('week-strip').parent as HostElement;
    expect(weekArea).toHaveStyle({
      paddingHorizontal: 10,
      paddingTop: 20,
      paddingBottom: 20,
      gap: 20,
    });

    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));
    const monthArea = screen.getByTestId('month-calendar')
      .parent as HostElement;
    expect(monthArea).toHaveStyle({
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 24,
    });
    expect(monthArea.children).toHaveLength(1);
  });

  it('펼친 달력에 확정 일정의 날짜별 개수만큼 점을 찍는다', async () => {
    await renderSchedule();
    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));

    const dotsOf = (name: string) =>
      within(screen.getByRole('button', { name })).queryAllByTestId(
        'event-dot',
      );
    expect(dotsOf('12월 15일 화요일')).toHaveLength(2);
    expect(dotsOf('12월 16일 수요일')).toHaveLength(1);
    expect(dotsOf('12월 17일 목요일')).toHaveLength(0);
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

// 주간 줄·달력은 dateArea 좌우 패딩만큼 화면 가장자리에서 들어가 있다. 그 패딩까지 넓혀야
// 제스처 내비게이션의 가장자리 뒤로 가기 영역을 덮는다 (#58)
describe('ScheduleScreen — Android 가장자리 밀기', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    { label: '주간 줄', testID: 'week-strip', open: false },
    { label: '달력', testID: 'month-calendar', open: true },
  ])(
    '$label 의 제외 영역이 dateArea 좌우 패딩 끝까지 닿는다',
    async ({ testID, open }) => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await renderSchedule();
      if (open) {
        await userEvent.press(
          screen.getByRole('button', { name: '달력 펼치기' }),
        );
      }

      const dateArea = screen.getByTestId(testID).parent as HostElement;
      const inset = stylePt(dateArea, 'paddingHorizontal');
      expect(
        StyleSheet.flatten(screen.getByTestId('gesture-exclusion').props.style),
      ).toMatchObject({ left: -inset, right: -inset });
    },
  );
});

// 마이 › 탈퇴 불가의 '미완료 작업 배정' 에서 응답 필요로 올 때 (#72)
describe('ScheduleScreen — 바깥에서 하위 탭 고르기', () => {
  it('requestedTab 이 오면 그 하위 탭으로 옮기고, 직접 고른 탭은 그대로 둔다', async () => {
    const props = {
      today,
      confirmed,
      pending,
      onAccept: jest.fn(),
      onReject: jest.fn(),
      onOpenRequest: jest.fn(),
    };
    const { rerender } = await render(<ScheduleScreen {...props} />);
    expect(screen.getByRole('tab', { name: /^확정 일정/ })).toBeSelected();

    await rerender(<ScheduleScreen {...props} requestedTab="pending" />);
    expect(screen.getByRole('tab', { name: /^응답 필요/ })).toBeSelected();

    // 화면이 요청을 받은 뒤(지움) 사용자가 다른 탭을 고르면 그대로 남는다
    await rerender(<ScheduleScreen {...props} />);
    await userEvent.press(screen.getByRole('tab', { name: /^확정 일정/ }));
    expect(screen.getByRole('tab', { name: /^확정 일정/ })).toBeSelected();

    // 지운 뒤 같은 요청이 다시 오면 다시 옮긴다
    await rerender(<ScheduleScreen {...props} requestedTab="pending" />);
    expect(screen.getByRole('tab', { name: /^응답 필요/ })).toBeSelected();
  });

  it('처음 열 때 요청이 있으면 확정 일정을 거치지 않고 그 탭으로 그린다', async () => {
    await render(
      <ScheduleScreen
        today={today}
        confirmed={confirmed}
        pending={pending}
        onAccept={jest.fn()}
        onReject={jest.fn()}
        onOpenRequest={jest.fn()}
        requestedTab="pending"
      />,
    );

    expect(screen.getByRole('tab', { name: /^응답 필요/ })).toBeSelected();
  });
});
