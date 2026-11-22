import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import { drag, touchesEvent } from '../../../../jest/gesture';
import { holdNativeAnimations } from '../../../../jest/nativeAnimation';
import { colors, typography } from '../../../shared/design-system';
import { haptic } from '../../../shared/haptics';

jest.mock('../../../shared/haptics', () => ({
  haptic: { success: jest.fn(), warning: jest.fn(), selection: jest.fn() },
}));
import { iconSvgs } from '../../../shared/design-system/icons/svgs';
import { iconSvgIn } from '../../../shared/testing/icon';
import { UNDERLINE_TABS_HEIGHT } from '../../../shared/design-system';
import { TAB_HEADER_HEIGHT } from '../../../shared/layout/TabHeader';
import {
  autoHideHeader,
  autoHideHeaderOffset,
  scrollDownFromTop,
  scrollListTo,
} from '../../../shared/testing/autoHideHeader';
import { expectMessageOnly } from '../../../shared/testing/emptyState';
import { isInsideScrollView } from '../../../shared/testing/scroll';
import { expectOnlySkeletons } from '../../../shared/testing/skeleton';
import { stylePt, type HostElement } from '../../../shared/testing/touchTarget';
import type { ConfirmedSchedule, PendingRequest } from '../model';
import { ScheduleScreen, type ScheduleScreenProps } from './ScheduleScreen';

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
    title: '에어컨 필터 교체',
    timeRange: '14:00 – 15:00',
  },
  {
    ...base,
    id: 'p2',
    dateKey: '2026-12-21',
    title: '수전 교체',
    timeRange: '10:00 – 11:00',
  },
];

/** 위로 올라가며 처음 만나는 칠해진 바탕. 투명이면 그 뒤가 보인다 */
const backgroundBehind = (node: HostElement | null | undefined) => {
  let current = node;
  while (current) {
    const color = StyleSheet.flatten(current.props.style)?.backgroundColor;
    if (color != null && color !== 'transparent') {
      return color;
    }
    current = current.parent;
  }
  return undefined;
};

// 회색(Background/3) 바탕은 리스트가 아니라 그 뒤 화면 배경이다
function expectGrayBehind(list: HostElement) {
  expect(backgroundBehind(list)).toBe(colors.background[3]);
  expect(StyleSheet.flatten(list.props.style)?.backgroundColor).toBeUndefined();
}

const renderSchedule = (overrides: Partial<ScheduleScreenProps> = {}) =>
  render(
    <ScheduleScreen
      today={today}
      confirmed={confirmed}
      pending={pending}
      onAccept={jest.fn(async () => true)}
      onReject={jest.fn()}
      onOpenRequest={jest.fn()}
      onOpenWork={jest.fn()}
      {...overrides}
    />,
  );

const weekStrip = () => screen.getByTestId('week-strip').props;

/** element 를 감싼 리스트(네이티브 스크롤 뷰) */
const scrollViewOf = (element: HostElement) => {
  let node = element;
  while (node.parent && node.type !== 'RCTScrollView') {
    node = node.parent;
  }
  expect(node.type).toBe('RCTScrollView');
  return node;
};
/** 리스트 내용(머리·카드)을 감싸는 컨테이너의 스타일. jest 의 스크롤 뷰 목은 컨테이너에 스타일을 그리지 않아 prop 으로 본다 */
const contentStyleOf = (list: HostElement) =>
  StyleSheet.flatten(list.props.contentContainerStyle);

/** 선택(검정) 칸의 날짜. 넘기는 동안 드러나는 옆 페이지까지 본다 */
const selectedDays = () =>
  screen
    .queryAllByRole('button', {
      name: /월 \d+일 .요일$/,
      includeHiddenElements: true,
    })
    .filter(day => day.props.accessibilityState?.selected)
    .map(day => day.props.accessibilityLabel);
/** 지금 보이는(스크린리더가 읽는) 페이지의 선택 칸 */
const visibleSelectedDays = () =>
  screen
    .queryAllByRole('button', { name: /월 \d+일 .요일$/ })
    .filter(day => day.props.accessibilityState?.selected)
    .map(day => day.props.accessibilityLabel);

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

    expect(screen.getByText('이 날은 일정이 없습니다')).toBeOnTheScreen();
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

  // 검정 선택 칸은 고른 날 하나에만 있다. 주를 넘겨도 고른 날은 그대로다 (#100)
  it('처음에는 오늘 칸 하나만 선택돼 있다', async () => {
    await renderSchedule();

    expect(selectedDays()).toEqual(['12월 15일 화요일']);
  });

  it('주간 줄을 왼쪽으로 밀면 다음 주를 보여 주고, 고른 날·날짜 머리·일정은 그대로다', async () => {
    await renderSchedule();

    await drag(weekStrip(), { dx: -80 });

    expect(
      screen.getByRole('button', { name: '12월 20일 일요일' }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: '12월 15일 화요일' }),
    ).not.toBeOnTheScreen();
    // 다음 주에는 검정 칸이 없다
    expect(
      screen.getByRole('button', { name: '12월 22일 화요일' }),
    ).not.toBeSelected();
    expect(visibleSelectedDays()).toEqual([]);
    expect(selectedDays()).toEqual(['12월 15일 화요일']);
    expect(screen.getByText('2026년 12월 15일 (화)')).toBeOnTheScreen();
    expect(screen.getByText('세탁기 설치')).toBeOnTheScreen();
    expect(
      screen.getByRole('tab', { name: '확정 일정 2건' }),
    ).toBeOnTheScreen();
  });

  it('주간 줄을 오른쪽으로 밀면 이전 주를 보여 주고, 고른 날은 그대로다', async () => {
    await renderSchedule();

    await drag(weekStrip(), { dx: 80 });

    expect(
      screen.getByRole('button', { name: '12월 6일 일요일' }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: '12월 13일 일요일' }),
    ).not.toBeOnTheScreen();
    expect(visibleSelectedDays()).toEqual([]);
    expect(screen.getByText('2026년 12월 15일 (화)')).toBeOnTheScreen();
  });

  it('넘긴 주에서 날짜를 누르면 선택이 그 날로 옮겨 가고 날짜 머리·일정이 바뀐다', async () => {
    await renderSchedule();
    await drag(weekStrip(), { dx: -80 });
    await drag(weekStrip(), { dx: -80 });
    await drag(weekStrip(), { dx: -80 });

    await userEvent.press(
      screen.getByRole('button', { name: '1월 4일 월요일' }),
    );

    expect(selectedDays()).toEqual(['1월 4일 월요일']);
    expect(
      screen.getByRole('button', { name: '1월 4일 월요일' }),
    ).toBeSelected();
    expect(screen.getByText('2027년 1월 4일 (월)')).toBeOnTheScreen();
    expect(screen.getByText('에어컨 청소')).toBeOnTheScreen();

    // 고른 날의 주로 돌아가도 앞서 고른 날은 선택되지 않는다
    await drag(weekStrip(), { dx: 80 });
    await drag(weekStrip(), { dx: 80 });
    await drag(weekStrip(), { dx: 80 });
    expect(
      screen.getByRole('button', { name: '12월 15일 화요일' }),
    ).not.toBeSelected();
    expect(selectedDays()).toEqual([]);
  });

  it('주간 줄을 끌어 넘기면 다 넘어간 뒤에 보이는 주가 바뀌고, 날짜와 일정은 그대로다', async () => {
    const { finish } = holdNativeAnimations();
    try {
      await renderSchedule();
      await fireEvent(screen.getByTestId('week-strip-track'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 69 } },
      });

      await drag(weekStrip(), { dx: -80 });
      expect(
        screen.getByRole('button', { name: '12월 15일 화요일' }),
      ).toBeSelected();

      await finish();
      expect(
        screen.getByRole('button', { name: '12월 22일 화요일' }),
      ).not.toBeSelected();
      expect(screen.getByText('2026년 12월 15일 (화)')).toBeOnTheScreen();
      expect(screen.getByText('세탁기 설치')).toBeOnTheScreen();
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('주가 미끄러져 넘어가는 중에 날짜를 누르면 그 날을 고르고, 다 넘어간 주에는 검정 칸이 없다', async () => {
    const { finish } = holdNativeAnimations();
    try {
      await renderSchedule();
      await fireEvent(screen.getByTestId('week-strip-track'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 69 } },
      });

      await drag(weekStrip(), { dx: -80 });
      await fireEvent.press(
        screen.getByRole('button', { name: '12월 17일 목요일' }),
      );
      expect(screen.getByText('2026년 12월 17일 (목)')).toBeOnTheScreen();

      await finish();
      expect(
        screen.getByRole('button', { name: '12월 24일 목요일' }),
      ).not.toBeSelected();
      expect(visibleSelectedDays()).toEqual([]);
      expect(selectedDays()).toEqual(['12월 17일 목요일']);
      expect(screen.getByText('2026년 12월 17일 (목)')).toBeOnTheScreen();
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('주를 넘겨 다른 달을 보고 있어도 달력을 펼치면 고른 날의 달을 보여 준다', async () => {
    await renderSchedule();

    await drag(weekStrip(), { dx: -80 });
    await drag(weekStrip(), { dx: -80 });
    await drag(weekStrip(), { dx: -80 });
    expect(
      screen.getByRole('button', { name: '1월 5일 화요일' }),
    ).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));
    expect(screen.getByText('2026년 12월')).toBeOnTheScreen();
    expect(selectedDays()).toEqual(['12월 15일 화요일']);
  });

  it('넘긴 주에서 다른 달의 날을 고르고 달력을 펼치면 그 달을 보여 준다', async () => {
    await renderSchedule();

    await drag(weekStrip(), { dx: -80 });
    await drag(weekStrip(), { dx: -80 });
    await drag(weekStrip(), { dx: -80 });
    await userEvent.press(
      screen.getByRole('button', { name: '1월 5일 화요일' }),
    );

    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));
    expect(screen.getByText('2027년 1월')).toBeOnTheScreen();
  });

  it('달력에서 다른 달을 넘겨 보다 접으면 주간 줄은 고른 날의 주를 보여 준다', async () => {
    await renderSchedule();
    await drag(weekStrip(), { dx: -80 });

    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));
    await userEvent.press(screen.getByRole('button', { name: '다음 달' }));
    await userEvent.press(screen.getByRole('button', { name: '다음 달' }));
    await userEvent.press(screen.getByRole('button', { name: '달력 접기' }));

    expect(
      screen.getByRole('button', { name: '12월 15일 화요일' }),
    ).toBeSelected();
    expect(selectedDays()).toEqual(['12월 15일 화요일']);
  });

  it('펼친 달력에서 다른 주의 날을 고르고 접으면 주간 줄은 그 날의 주를 보여 준다', async () => {
    await renderSchedule();

    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));
    await userEvent.press(
      screen.getByRole('button', { name: '12월 29일 화요일' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '달력 접기' }));

    expect(
      screen.getByRole('button', { name: '12월 29일 화요일' }),
    ).toBeSelected();
    expect(selectedDays()).toEqual(['12월 29일 화요일']);
  });

  it('펼친 달력도 검정 칸은 고른 날 하나이고, 달을 넘겨 고른 날이 없는 달에는 없다', async () => {
    await renderSchedule();
    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));

    expect(selectedDays()).toEqual(['12월 15일 화요일']);
    expect(visibleSelectedDays()).toEqual(['12월 15일 화요일']);

    await userEvent.press(screen.getByRole('button', { name: '다음 달' }));
    expect(visibleSelectedDays()).toEqual([]);
  });

  it('VoiceOver 로 날짜의 다음 주 동작을 부르면 보이는 주만 넘기고, 고른 날은 그대로 두고 넘긴 주를 읽어 준다', async () => {
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

    expect(
      screen.getByRole('button', { name: '12월 23일 수요일' }),
    ).not.toBeSelected();
    expect(visibleSelectedDays()).toEqual([]);
    expect(screen.getByText('2026년 12월 15일 (화)')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('12월 20일부터 12월 26일까지', {
      queue: true,
    });
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

  // Figma 3754:6269·3754:6457: Web Icon Calender/ Weekly(주간) · Monthly(펼침, 좌우 반전), 둘 다 Gray500
  it('날짜 줄 오른쪽 버튼은 주간·달력에서 Figma 의 달력 전환 아이콘(Gray500)이다', async () => {
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
      color: colors.gray[500],
    });
  });

  // 제목 줄은 탭 첫 화면 공통 상단 바다 (#103, Figma 3463:17455: 상태 표시줄 아래 12, 종 없음 3754:6269).
  // Figma 내 일정: 제목과 탭 사이 24
  it('머리말은 공통 상단 바(종 없음) 아래 24 에 탭이 있다', async () => {
    await renderSchedule();

    const title = screen.getByRole('header', { name: '내 일정' });
    const bar = title.parent?.parent as HostElement;
    const tab = screen.getByRole('tab', { name: '확정 일정 2건' });
    expect(isInsideScrollView(title)).toBe(false);
    expect(bar).toHaveStyle({ paddingTop: 12, paddingHorizontal: 24 });
    expect(stylePt(bar, 'paddingBottom') + stylePt(tab, 'paddingTop')).toBe(24);
    expect(screen.queryByRole('button', { name: '알림센터' })).toBeNull();
    expect(screen.getByTestId('auto-hide-header')).toContainElement(bar);
  });

  // Figma 3754:6458·3754:6940: 머리(167)는 하위 탭 아래 끝(166)보다 1 길고, 날짜 블록·요청 카드는 머리 아래 24(191)에서 시작한다.
  // 탭 줄 아래 선을 빼도(#201) 하위 탭 아래 끝에서 내용까지는 25 다
  it('하위 탭 아래 끝에서 내용까지 Figma 대로 25 다 (머리 아래 여백 1 + 날짜 블록 위 24)', async () => {
    await renderSchedule();

    const tabsBar = screen.getByRole('tab', { name: '확정 일정 2건' }).parent
      ?.parent as HostElement;
    const dateArea = screen.getByTestId('week-strip').parent as HostElement;
    expect(
      stylePt(tabsBar, 'paddingBottom') + stylePt(dateArea, 'paddingTop'),
    ).toBe(25);
    // 머리 높이(내용 위 여백)에 그 1 이 든다
    expect(
      contentStyleOf(screen.getByTestId('schedule-confirmed-list')).paddingTop,
    ).toBe(TAB_HEADER_HEIGHT + 16 + UNDERLINE_TABS_HEIGHT + 1);
  });

  // Figma 3754:6269: 머리말 아래 회색(Background/3) 위에 날짜 블록(날짜 줄 → 16 → 주간 줄)과 카드 목록이 24 간격으로 놓인다.
  // 날짜 블록 아래 12 띠와 주간 줄 위 구분선은 없어졌다
  it('확정 일정 리스트는 회색 배경 위에 좌우 24 로 날짜 블록·카드를 놓고, 띠·구분선이 없다', async () => {
    await renderSchedule();

    const list = scrollViewOf(screen.getByTestId('week-strip'));
    expectGrayBehind(list);
    expect(contentStyleOf(list)).toMatchObject({ paddingBottom: 24 });

    const dateArea = screen.getByTestId('week-strip').parent as HostElement;
    expect(dateArea).toHaveStyle({
      paddingTop: 24,
      paddingBottom: 24,
      paddingHorizontal: 24,
      gap: 16,
    });
    expect(dateArea).not.toHaveStyle({ borderBottomWidth: 12 });
    // 날짜 줄과 주간 줄뿐이다 (구분선 없음)
    expect(dateArea.children).toHaveLength(2);
    expect(
      within(dateArea.children[0] as HostElement).getByText(
        '2026년 12월 15일 (화)',
      ),
    ).toBeOnTheScreen();
  });

  it('펼친 달력도 같은 날짜 블록 안에서 날짜 줄 아래 16 에 놓인다', async () => {
    await renderSchedule();
    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));

    const dateArea = screen.getByTestId('month-calendar').parent as HostElement;
    expect(dateArea).toHaveStyle({
      paddingTop: 24,
      paddingBottom: 24,
      paddingHorizontal: 24,
      gap: 16,
    });
    expect(dateArea.children).toHaveLength(2);
  });

  it('확정 일정 카드는 시간 뒤에 고른 날을 카드 표기로 보이고, 오늘이면 앞에 오늘을 붙인다', async () => {
    await renderSchedule();

    expect(
      screen.getAllByText('08:00 - 09:00  오늘 · 12. 15. (화)'),
    ).toHaveLength(2);

    await userEvent.press(
      screen.getByRole('button', { name: '12월 16일 수요일' }),
    );
    expect(screen.getByText('08:00 - 09:00  12. 16. (수)')).toBeOnTheScreen();
  });

  it('일정 카드는 좌우 24 안쪽에 놓이고 사이는 12 다', async () => {
    await renderSchedule();

    expect(screen.getByLabelText(/^세탁기 설치,/)).toHaveStyle({
      marginHorizontal: 24,
    });
    expect(screen.getAllByTestId('schedule-card-gap')).toHaveLength(1);
    expect(screen.getByTestId('schedule-card-gap')).toHaveStyle({ height: 12 });
  });

  // DesignSystem Event Indicator 는 0/1 뿐이라 일정이 있는 날은 건수와 관계없이 점 하나다
  it('펼친 달력에 확정 일정이 있는 날마다 점 하나를 찍는다', async () => {
    await renderSchedule();
    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));

    const dotsOf = (name: string) =>
      within(screen.getByRole('button', { name })).queryAllByTestId(
        'event-dot',
      );
    expect(dotsOf('12월 15일 화요일')).toHaveLength(1);
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

// #202: Figma 3754:6269(주간)·3754:6457(월간) 날짜 줄 오른쪽에 '오늘' 버튼이 있다.
// 주간 보기는 오늘이 있는 주, 월간 보기는 이번 달로 돌아오고 오늘을 고른다
describe('ScheduleScreen — 오늘 버튼 (#202)', () => {
  const pressToday = () =>
    userEvent.press(screen.getByRole('button', { name: '오늘' }));

  it('주간 보기에서 다른 주의 날을 고르고 있다가 오늘을 누르면 오늘이 있는 주와 오늘 날짜로 돌아온다', async () => {
    const onVisibleMonthsChange = jest.fn();
    await renderSchedule({ onVisibleMonthsChange });
    await drag(weekStrip(), { dx: -80 });
    await drag(weekStrip(), { dx: -80 });
    await drag(weekStrip(), { dx: -80 });
    await userEvent.press(
      screen.getByRole('button', { name: '1월 4일 월요일' }),
    );
    expect(screen.getByText('2027년 1월 4일 (월)')).toBeOnTheScreen();

    await pressToday();

    expect(screen.getByText('2026년 12월 15일 (화)')).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: '1월 4일 월요일' }),
    ).not.toBeOnTheScreen();
    expect(visibleSelectedDays()).toEqual(['12월 15일 화요일']);
    expect(selectedDays()).toEqual(['12월 15일 화요일']);
    expect(screen.getByText('세탁기 설치')).toBeOnTheScreen();
    expect(onVisibleMonthsChange).toHaveBeenLastCalledWith([
      { year: 2026, month: 11 },
    ]);
    // 주간 보기 그대로다
    expect(screen.getByTestId('week-strip')).toBeOnTheScreen();
  });

  it('주간 보기에서 다른 주를 넘겨 보기만 하다가 오늘을 누르면 오늘이 있는 주로 돌아온다', async () => {
    await renderSchedule();
    await drag(weekStrip(), { dx: 80 });
    await drag(weekStrip(), { dx: 80 });
    expect(visibleSelectedDays()).toEqual([]);

    await pressToday();

    expect(
      screen.getByRole('button', { name: '12월 13일 일요일' }),
    ).toBeOnTheScreen();
    expect(visibleSelectedDays()).toEqual(['12월 15일 화요일']);
  });

  it('월간 보기에서 다른 달의 날을 고르고 또 다른 달을 보다가 오늘을 누르면 이번 달과 오늘 날짜로 돌아온다', async () => {
    const onVisibleMonthsChange = jest.fn();
    await renderSchedule({ onVisibleMonthsChange });
    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));
    await userEvent.press(screen.getByRole('button', { name: '다음 달' }));
    await userEvent.press(
      screen.getByRole('button', { name: '1월 4일 월요일' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '다음 달' }));
    expect(screen.getByText('2027년 2월')).toBeOnTheScreen();

    await pressToday();

    expect(screen.getByText('2026년 12월')).toBeOnTheScreen();
    expect(screen.getByText('2026년 12월 15일 (화)')).toBeOnTheScreen();
    expect(visibleSelectedDays()).toEqual(['12월 15일 화요일']);
    expect(screen.getByText('세탁기 설치')).toBeOnTheScreen();
    expect(onVisibleMonthsChange).toHaveBeenLastCalledWith([
      { year: 2026, month: 11 },
    ]);
    // 월간 보기 그대로다
    expect(screen.getByTestId('month-calendar')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '달력 접기' })).toBeOnTheScreen();
  });

  // 넘김(280ms)이 끝나기 전에 오늘을 누르면 그 넘김은 버린다. 다 넘어간 뒤 확정하면 오늘의 달·주에서 한 페이지 더 간다
  describe('넘기는 중에 누르면', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });
    const layoutTrack = (testID: string) =>
      fireEvent(screen.getByTestId(testID), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 345, height: 400 } },
      });

    it.each([
      ['다음 달(2027년 1월)', []],
      ['지난달에서 이번 달', ['이전 달']],
    ] as const)(
      '월간: %s로 미끄러지는 중에 오늘을 누르면 이번 달에 머문다',
      async (_label, before) => {
        const { finish } = holdNativeAnimations();
        await renderSchedule();
        await userEvent.press(
          screen.getByRole('button', { name: '달력 펼치기' }),
        );
        await layoutTrack('month-calendar-track');
        for (const name of before) {
          await fireEvent.press(screen.getByRole('button', { name }));
          await finish();
        }

        await fireEvent.press(screen.getByRole('button', { name: '다음 달' }));
        await pressToday();
        await finish();

        expect(screen.getByText('2026년 12월')).toBeOnTheScreen();
        expect(visibleSelectedDays()).toEqual(['12월 15일 화요일']);
      },
    );

    it.each([
      ['다음 주', 0],
      ['지난주에서 이번 주', 1],
    ] as const)(
      '주간: %s로 미끄러지는 중에 오늘을 누르면 오늘이 있는 주에 머문다',
      async (_label, weeksBack) => {
        const { finish } = holdNativeAnimations();
        await renderSchedule();
        await layoutTrack('week-strip-track');
        for (let i = 0; i < weeksBack; i += 1) {
          await drag(weekStrip(), { dx: 80 });
          await finish();
        }

        await drag(weekStrip(), { dx: -80 });
        await pressToday();
        await finish();

        expect(
          screen.getByRole('button', { name: '12월 13일 일요일' }),
        ).toBeOnTheScreen();
        expect(visibleSelectedDays()).toEqual(['12월 15일 화요일']);
      },
    );

    // 격자 끝의 다른 달 칸을 고르면 보이는 달이 그 달로 바뀐다. 그 넘김까지 확정하면 한 달 더 간다
    it('월간: 다음 달로 미끄러지는 중에 다른 달 칸(1월 2일)을 누르면 그 날의 달에 머문다', async () => {
      const { finish } = holdNativeAnimations();
      await renderSchedule();
      await userEvent.press(
        screen.getByRole('button', { name: '달력 펼치기' }),
      );
      await layoutTrack('month-calendar-track');

      await fireEvent.press(screen.getByRole('button', { name: '다음 달' }));
      await fireEvent.press(
        screen.getByRole('button', { name: '1월 2일 토요일' }),
      );
      await finish();

      expect(screen.getByText('2027년 1월')).toBeOnTheScreen();
      expect(screen.getByText('2027년 1월 2일 (토)')).toBeOnTheScreen();
      expect(visibleSelectedDays()).toEqual(['1월 2일 토요일']);
    });

    // 보이는 달 안의 날을 고르면 넘김은 이어 간다 (주간 줄의 #100 동작과 같다)
    it('월간: 미끄러지는 중에 이번 달 칸을 누르면 그 날을 고르고 넘김은 이어 간다', async () => {
      const { finish } = holdNativeAnimations();
      await renderSchedule();
      await userEvent.press(
        screen.getByRole('button', { name: '달력 펼치기' }),
      );
      await layoutTrack('month-calendar-track');

      await fireEvent.press(screen.getByRole('button', { name: '다음 달' }));
      await fireEvent.press(
        screen.getByRole('button', { name: '12월 20일 일요일' }),
      );
      await finish();

      expect(screen.getByText('2027년 1월')).toBeOnTheScreen();
      expect(screen.getByText('2026년 12월 20일 (일)')).toBeOnTheScreen();
      expect(visibleSelectedDays()).toEqual([]);
    });
  });

  // 이미 오늘의 주·달을 보고 오늘을 고르고 있으면 바뀌는 것이 없다
  it.each([
    ['주간', false],
    ['월간', true],
  ] as const)(
    '%s: 이미 오늘을 보고 있으면 오늘을 눌러도 아무것도 바꾸지 않고 달을 다시 알리지 않는다',
    async (_label, open) => {
      const onVisibleMonthsChange = jest.fn();
      await renderSchedule({ onVisibleMonthsChange });
      if (open) {
        await userEvent.press(
          screen.getByRole('button', { name: '달력 펼치기' }),
        );
      }
      onVisibleMonthsChange.mockClear();

      await pressToday();

      expect(onVisibleMonthsChange).not.toHaveBeenCalled();
      expect(visibleSelectedDays()).toEqual(['12월 15일 화요일']);
    },
  );

  // Figma 51030:18439·51030:18441: Gray100 알약(좌우 12·위아래 4, 모서리 54), 글자 Caption/M/Semibold Gray900.
  // 날짜 줄 오른쪽에서 달력 전환 버튼 왼쪽에 놓이고, 둘 사이는 주간 16(51030:18440)·월간 12(51030:18444)다
  it('오늘 버튼은 날짜 줄 오른쪽 달력 버튼 앞의 Gray100 알약이고, 달력 버튼과의 간격은 주간 16·월간 12 다', async () => {
    await renderSchedule();

    const todayButton = screen.getByRole('button', { name: '오늘' });
    expect(todayButton).toHaveStyle({
      backgroundColor: colors.gray[100],
      borderRadius: 54,
      paddingHorizontal: 12,
      paddingVertical: 4,
    });
    expect(within(todayButton).getByText('오늘')).toHaveStyle({
      color: colors.gray[900],
      fontSize: typography['Caption/M/SemiBold'].fontSize,
      fontFamily: typography['Caption/M/SemiBold'].fontFamily,
      lineHeight: typography['Caption/M/SemiBold'].lineHeight,
    });
    const actions = todayButton.parent as HostElement;
    expect(actions.children).toEqual([
      todayButton,
      screen.getByRole('button', { name: '달력 펼치기' }),
    ]);
    expect(actions).toHaveStyle({
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    });
    // 날짜 줄의 오른쪽 끝이다
    const dateRow = actions.parent as HostElement;
    expect(dateRow.children[dateRow.children.length - 1]).toBe(actions);
    expect(dateRow).toHaveStyle({ justifyContent: 'space-between' });

    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));
    expect(
      screen.getByRole('button', { name: '오늘' }).parent as HostElement,
    ).toHaveStyle({ gap: 12 });
  });

  // 오늘 알약이 더해져 날짜 줄 오른쪽이 넓어졌다. 큰 글자·좁은 화면에서 날짜가 길어도 버튼을 화면 밖으로 밀지 않고 날짜가 줄을 바꾼다
  it('날짜가 길면 오늘·달력 버튼을 밀어내지 않고 날짜가 줄을 바꾼다', async () => {
    await renderSchedule();

    expect(screen.getByText('2026년 12월 15일 (화)')).toHaveStyle({
      flexShrink: 1,
    });
    expect(
      StyleSheet.flatten(
        (screen.getByRole('button', { name: '오늘' }).parent as HostElement)
          .props.style,
      ).flexShrink,
    ).toBeUndefined();
  });
});

// 주간 줄·월 달력은 리스트 머리에 있다. 주간 줄을 만지는 동안(닿은 뒤 뗄 때까지)은 리스트가 세로로 움직이지 않는다 (#99).
// 펼친 달력은 처음 움직인 방향으로 정한다: 가로면 막고 달을 넘기며, 세로면 리스트가 스크롤한다 (#144)
describe('ScheduleScreen — 달력을 만지는 동안 리스트 고정', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** 확정 일정 리스트 (네이티브 스크롤 뷰) */
  const list = () => {
    let node = screen.getByText(/^\d{4}년 \d+월 \d+일 \(.\)$/) as HostElement;
    while (node.parent && node.type !== 'RCTScrollView') {
      node = node.parent;
    }
    expect(node.type).toBe('RCTScrollView');
    return node;
  };
  // RNTL fireEvent 는 터치 시작을 거절하는 응답자(밀기)가 있는 뷰의 이벤트를 막아 props 의 핸들러를 직접 부른다.
  // RN 은 터치 시작을 리스트(조상)의 capture 로 먼저 보내고 닿은 뷰에서 위로(bubble) 올린다
  const touchStart = (target: HostElement | null, id = 0) =>
    act(() => {
      const event = touchesEvent({ changed: [id], touches: [id] });
      list().props.onTouchStartCapture(event);
      target?.props.onTouchStart?.(event);
    });
  const touchEnd = (target: HostElement, id = 0) =>
    act(() =>
      target.props.onTouchEnd(touchesEvent({ changed: [id], touches: [] })),
    );
  const touchCancel = (target: HostElement, id = 0) =>
    act(() =>
      target.props.onTouchCancel(touchesEvent({ changed: [id], touches: [] })),
    );
  // 손가락이 닿은 자리(0,0)에서 (x, y) 로 움직인다
  const touchMove = (target: HostElement, x: number, y: number, id = 0) =>
    act(() =>
      target.props.onTouchMove(
        touchesEvent({ changed: [id], touches: [id], x, y }),
      ),
    );

  it.each(['ios', 'android'] as const)(
    '%s: 주간 줄에 손가락이 닿으면 리스트 스크롤을 막고, 떼면 다시 스크롤한다',
    async os => {
      jest.replaceProperty(Platform, 'OS', os);
      await renderSchedule();
      expect(list().props.scrollEnabled).not.toBe(false);

      await touchStart(screen.getByTestId('week-strip'));
      expect(list().props.scrollEnabled).toBe(false);

      await touchEnd(screen.getByTestId('week-strip'));
      expect(list().props.scrollEnabled).toBe(true);
    },
  );

  it('주간 줄 터치가 취소돼도 다시 스크롤한다', async () => {
    await renderSchedule();

    await touchStart(screen.getByTestId('week-strip'));
    await touchCancel(screen.getByTestId('week-strip'));

    expect(list().props.scrollEnabled).toBe(true);
  });

  describe('펼친 달력 — 처음 움직인 방향 (#144)', () => {
    const openCalendar = async (os: 'ios' | 'android') => {
      jest.replaceProperty(Platform, 'OS', os);
      await renderSchedule();
      await userEvent.press(
        screen.getByRole('button', { name: '달력 펼치기' }),
      );
    };
    const calendar = () => screen.getByTestId('month-calendar');

    it.each(['ios', 'android'] as const)(
      '%s: 달력 위에서 세로로 밀면 리스트가 스크롤하고 달은 그대로다',
      async os => {
        await openCalendar(os);

        await touchStart(calendar());
        await touchMove(calendar(), 3, -12);
        expect(list().props.scrollEnabled).toBe(true);
        const { granted } = await drag(calendar().props, {
          path: [
            { x: 0, y: 0 },
            { x: 3, y: -12 },
            { x: -40, y: -60 },
            { x: -80, y: -120 },
          ],
        });
        await touchMove(calendar(), -80, -120);
        expect(list().props.scrollEnabled).toBe(true);
        await touchEnd(calendar());

        expect(granted).toBe(false);
        expect(screen.getByText('2026년 12월')).toBeOnTheScreen();
        expect(list().props.scrollEnabled).toBe(true);
      },
    );

    it.each(['ios', 'android'] as const)(
      '%s: 달력 위에서 가로로 밀면 리스트 스크롤을 막고 달을 넘긴다',
      async os => {
        await openCalendar(os);

        await touchStart(calendar());
        await touchMove(calendar(), -12, 3);
        expect(list().props.scrollEnabled).toBe(false);
        const { granted } = await drag(calendar().props, {
          path: [
            { x: 0, y: 0 },
            { x: -12, y: 3 },
            { x: -40, y: 30 },
            { x: -80, y: 60 },
          ],
        });
        await touchMove(calendar(), -80, 60);
        expect(list().props.scrollEnabled).toBe(false);
        await touchEnd(calendar());

        expect(granted).toBe(true);
        expect(screen.getByText('2027년 1월')).toBeOnTheScreen();
        expect(list().props.scrollEnabled).toBe(true);
      },
    );

    // iOS 는 막은 뒤 다시 켜도 그 손길에서 스크롤하지 않으므로 방향을 정하기 전에는 막지 않는다
    it('iOS: 달력에 닿기만 해서는 리스트 스크롤을 막지 않는다', async () => {
      await openCalendar('ios');

      await touchStart(calendar());
      await touchMove(calendar(), -10, 0);

      expect(list().props.scrollEnabled).not.toBe(false);
    });

    // Android 리스트는 밀기가 응답자가 되기 전에 가로채므로 방향을 정할 때까지 막아 둔다
    it('Android: 달력에 닿으면 방향을 정할 때까지 막고, 떼거나 취소되면 푼다', async () => {
      await openCalendar('android');

      await touchStart(calendar());
      await touchMove(calendar(), -10, 0);
      expect(list().props.scrollEnabled).toBe(false);
      await touchEnd(calendar());
      expect(list().props.scrollEnabled).toBe(true);

      await touchStart(calendar());
      await touchCancel(calendar());
      expect(list().props.scrollEnabled).toBe(true);
    });

    it.each(['ios', 'android'] as const)(
      '%s: 달력 날짜를 누르면 고르고, 손을 떼면 리스트가 스크롤한다',
      async os => {
        await openCalendar(os);

        await touchStart(calendar());
        await fireEvent.press(
          screen.getByRole('button', { name: '12월 23일 수요일' }),
        );
        await touchEnd(calendar());

        expect(screen.getByText('2026년 12월 23일 (수)')).toBeOnTheScreen();
        expect(list().props.scrollEnabled).toBe(true);
      },
    );
  });

  it('달력 밖(날짜 머리·일정 목록)에서 시작한 터치는 리스트 스크롤을 막지 않는다', async () => {
    await renderSchedule();

    await touchStart(screen.getByText('세탁기 설치') as HostElement);
    expect(list().props.scrollEnabled).not.toBe(false);

    await touchStart(screen.getByText('2026년 12월 15일 (화)') as HostElement);
    expect(list().props.scrollEnabled).not.toBe(false);
  });

  // 만지던 칸이 그사이 사라지면 뗀 이벤트가 오지 않을 수 있다. 리스트에서 새로 시작한 터치가 바로잡는다
  it('달력에서 뗀 이벤트를 놓쳐도, 손가락이 모두 떨어진 뒤 일정 목록에서 새로 시작한 터치는 리스트를 스크롤한다', async () => {
    await renderSchedule();

    await touchStart(screen.getByTestId('week-strip'));
    expect(list().props.scrollEnabled).toBe(false);
    // 뗀 이벤트 없이 새 손가락이 일정 목록에 닿는다 (iOS 는 손가락 번호를 다시 쓴다)
    await touchStart(screen.getByText('세탁기 설치') as HostElement);

    expect(list().props.scrollEnabled).toBe(true);
  });

  it('주간 줄을 만지는 동안에도 날짜를 누르면 고르고, 손을 떼면 다시 스크롤한다', async () => {
    await renderSchedule();
    const strip = screen.getByTestId('week-strip');

    await touchStart(strip);
    await fireEvent.press(
      screen.getByRole('button', { name: '12월 16일 수요일' }),
    );
    await touchEnd(strip);

    expect(screen.getByText('2026년 12월 16일 (수)')).toBeOnTheScreen();
    expect(list().props.scrollEnabled).toBe(true);
  });

  it('주간 줄을 만지는 동안 밀어서 주를 넘기고, 손을 떼면 다시 스크롤한다', async () => {
    await renderSchedule();
    const strip = screen.getByTestId('week-strip');

    await touchStart(strip);
    // 밀던 중 리스트가 응답자를 달라고 해도 넘겨 주지 않는다
    const { released } = await drag(strip.props, { dx: -80, cancelAt: 6 });
    await touchEnd(screen.getByTestId('week-strip'));

    expect(released).toBe(false);
    expect(
      screen.getByRole('button', { name: '12월 20일 일요일' }),
    ).toBeOnTheScreen();
    expect(list().props.scrollEnabled).toBe(true);
  });

  // 막고 푸는 렌더는 리스트만 다시 그리고 달력은 그대로 둔다 (끄는 손가락을 따라가는 JS 를 붙잡지 않는다)
  it.each([
    { label: '주간 줄', testID: 'week-strip', open: false },
    { label: '달력', testID: 'month-calendar', open: true },
  ])(
    '$label 을 만지기 시작하고 떼도 $label 은 다시 그리지 않는다',
    async ({ testID, open }) => {
      await renderSchedule();
      if (open) {
        await userEvent.press(
          screen.getByRole('button', { name: '달력 펼치기' }),
        );
      }
      const before = screen.getByTestId(testID).props;

      await touchStart(screen.getByTestId(testID));
      // 펼친 달력은 가로로 정해질 때 막는다 (iOS)
      if (open) {
        await touchMove(screen.getByTestId(testID), -12, 0);
      }
      expect(list().props.scrollEnabled).toBe(false);
      await touchEnd(screen.getByTestId(testID));
      expect(list().props.scrollEnabled).toBe(true);

      // 다시 그리면 루트 뷰가 새 props 를 받는다
      const same = screen.getByTestId(testID).props === before;
      expect(same).toBe(true);
    },
  );

  it('응답 필요 리스트는 막지 않는다', async () => {
    await renderSchedule();

    await touchStart(screen.getByTestId('week-strip'));
    await userEvent.press(screen.getByRole('tab', { name: '응답 필요 2건' }));

    let node = screen.getByText('에어컨 필터 교체') as HostElement;
    while (node.parent && node.type !== 'RCTScrollView') {
      node = node.parent;
    }
    expect(node.props.scrollEnabled).not.toBe(false);
  });
});

// #201: Figma 내 일정(3754:6269·3754:6457·3754:6804)은 화면 바탕이 Background/3 이고 탑 내비(3754:6270·3754:6458·3754:6940)는
// 바탕색·그림자가 없다. 머리는 리스트 위에 겹쳐 그려 내용이 그 아래로 지나가므로 화면 배경과 같은 Background/3 으로 가린다
describe('ScheduleScreen — 탑 내비 색 (#201)', () => {
  beforeEach(() => {
    holdNativeAnimations();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const expectNavColors = () => {
    // 상태 표시줄 뒤(안전 영역)도 화면 배경이다
    expect(screen.root).toHaveStyle({ backgroundColor: colors.background[3] });
    expect(autoHideHeader()).toHaveStyle({
      backgroundColor: colors.background[3],
    });
    expect(
      StyleSheet.flatten(autoHideHeader().props.style).boxShadow,
    ).toBeUndefined();
    expect(
      backgroundBehind(screen.getByRole('header', { name: '내 일정' })),
    ).toBe(colors.background[3]);
    // 제목 Body/XL/Semibold #000000 (3754:6273)
    expect(screen.getByRole('header', { name: '내 일정' })).toHaveStyle({
      color: colors.black,
    });
    // 하위 탭 줄(3754:6462·3754:6944) 아래에 회색 선이 없다
    const tablist = screen.getByRole('tab', { name: /^확정 일정/ })
      .parent as HostElement;
    expect(StyleSheet.flatten(tablist.props.style).borderBottomWidth ?? 0).toBe(
      0,
    );
  };

  it.each([
    ['확정 일정', 'schedule-confirmed-list'],
    ['응답 필요', 'schedule-pending-list'],
  ] as const)(
    '%s: 탑 내비는 스크롤 전·후 모두 화면 바탕(Background/3)과 같고 그림자가 없다',
    async (tabLabel, listTestID) => {
      await renderSchedule();
      if (tabLabel === '응답 필요') {
        await userEvent.press(
          screen.getByRole('tab', { name: '응답 필요 2건' }),
        );
      }
      expectNavColors();

      await scrollDownFromTop(screen.getByTestId(listTestID));
      expectNavColors();
    },
  );
});

// #148: 아래로 스크롤하면 제목 줄(상단 바)이 숨고 하위 탭은 화면 맨 위에 남는다. 위로 스크롤을 시작하면 다시 보인다
describe('ScheduleScreen — 상단 바 자동 숨김', () => {
  let finishAnimations: () => Promise<void>;
  beforeEach(() => {
    finishAnimations = holdNativeAnimations().finish;
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** 제목 줄과 그 아래 여백(탭과의 간격). 숨는 거리다 */
  const TITLE_BAR = TAB_HEADER_HEIGHT + 16;
  /** 머리 전체: 제목 줄 + 하위 탭 + 그 아래 1 (Figma 머리 167, 탭 아래 끝 166) */
  const HEADER = TITLE_BAR + UNDERLINE_TABS_HEIGHT + 1;
  const confirmedList = () => screen.getByTestId('schedule-confirmed-list');
  const pendingList = () => screen.getByTestId('schedule-pending-list');

  it('제목 줄과 하위 탭은 리스트 위에 겹쳐 그린 머리 안에 있고, 내용은 그 아래에서 시작한다', async () => {
    await renderSchedule();

    expect(
      within(autoHideHeader()).getByRole('header', { name: '내 일정' }),
    ).toBeOnTheScreen();
    expect(
      within(autoHideHeader()).getByRole('tab', { name: '확정 일정 2건' }),
    ).toBeOnTheScreen();
    expect(
      StyleSheet.flatten(confirmedList().props.contentContainerStyle),
    ).toMatchObject({ paddingTop: HEADER });
  });

  // 상단 바는 당겨도 맨 위에 붙어 있으므로(#178) 두 플랫폼 모두 표시를 머리(제목 줄 + 하위 탭) 아래로 내린다
  it.each(['ios', 'android'] as const)(
    '당겨서 새로고침 표시는 머리 아래에서 나온다 (%s)',
    async os => {
      jest.replaceProperty(Platform, 'OS', os);
      await renderSchedule();
      expect(confirmedList()).toHaveProp('progressViewOffset', HEADER);
    },
  );

  it('아래로 스크롤하면 제목 줄만 숨고 하위 탭은 남으며, 위로 스크롤을 시작하면 다시 보인다', async () => {
    await renderSchedule();

    await scrollDownFromTop(confirmedList());
    await finishAnimations();
    expect(autoHideHeaderOffset()).toBe(-TITLE_BAR);
    expect(
      within(autoHideHeader()).getByRole('tab', { name: '응답 필요 2건' }),
    ).toBeOnTheScreen();

    await scrollListTo(confirmedList(), 280);
    await finishAnimations();
    expect(autoHideHeaderOffset()).toBe(0);
  });

  // 하위 탭마다 리스트가 따로다. 새로 그린 리스트는 맨 위이므로 상단 바를 다시 보인다
  // 두 하위 탭은 같은 자리의 리스트 하나를 data 만 바꿔 쓴다(스크롤 위치·레이아웃 그대로). 탭을 누르면 다시 보인다
  it('하위 탭을 바꾸면 상단 바를 다시 보이고, 바꾼 리스트를 스크롤해도 숨는다', async () => {
    await renderSchedule();
    await scrollDownFromTop(confirmedList());
    await finishAnimations();
    expect(autoHideHeaderOffset()).toBe(-TITLE_BAR);

    await userEvent.press(screen.getByRole('tab', { name: '응답 필요 2건' }));
    await finishAnimations();
    expect(autoHideHeaderOffset()).toBe(0);

    await scrollDownFromTop(pendingList());
    await finishAnimations();
    expect(autoHideHeaderOffset()).toBe(-TITLE_BAR);
  });

  // 달력을 만지는 동안 리스트 스크롤을 막는다 (#99). 막았다 풀어도 스크롤에 따라 숨는 것은 그대로다
  it('달력을 만져 리스트 스크롤을 막았다 풀어도 스크롤하면 숨는다', async () => {
    await renderSchedule();
    const strip = screen.getByTestId('week-strip');

    await act(() => {
      const event = touchesEvent({ changed: [0], touches: [0] });
      confirmedList().props.onTouchStartCapture(event);
      strip.props.onTouchStart(event);
    });
    expect(confirmedList().props.scrollEnabled).toBe(false);
    await act(() =>
      strip.props.onTouchEnd(touchesEvent({ changed: [0], touches: [] })),
    );
    expect(confirmedList().props.scrollEnabled).toBe(true);

    await scrollDownFromTop(confirmedList());
    await finishAnimations();
    expect(autoHideHeaderOffset()).toBe(-TITLE_BAR);
  });
});

describe('ScheduleScreen — 응답 필요', () => {
  // Figma 3754:6804: 머리말 아래 24, 좌우 24, 카드 사이 12, 회색(Background/3) 배경
  it('응답 필요 리스트는 회색 배경 위 위·좌우 24 에 카드를 12 간격으로 놓는다', async () => {
    await renderSchedule();
    await userEvent.press(screen.getByRole('tab', { name: '응답 필요 2건' }));

    const list = scrollViewOf(
      screen.getByText('에어컨 필터 교체') as HostElement,
    );
    expectGrayBehind(list);
    // 겹쳐 그린 머리(제목 줄 + 하위 탭, #148) 아래 24 에서 시작한다
    expect(contentStyleOf(list)).toMatchObject({
      paddingTop: TAB_HEADER_HEIGHT + 16 + UNDERLINE_TABS_HEIGHT + 1 + 24,
      paddingHorizontal: 24,
      paddingBottom: 24,
    });
    expect(screen.getAllByTestId('schedule-card-gap')).toHaveLength(1);
    expect(screen.getByTestId('schedule-card-gap')).toHaveStyle({ height: 12 });
  });

  // #32: 햅틱은 결과다. 수락이 서버에서 성공한 뒤에만 울린다
  it('수락이 성공하면 성공 햅틱을 울리고, 거절·상세에서는 울리지 않는다', async () => {
    jest.mocked(haptic.success).mockClear();
    await renderSchedule();
    await userEvent.press(screen.getByRole('tab', { name: '응답 필요 2건' }));

    await userEvent.press(
      screen.getByRole('button', { name: '수전 교체 거절' }),
    );
    await userEvent.press(
      screen.getByRole('button', { name: /^에어컨 필터 교체 상세/ }),
    );
    expect(haptic.success).not.toHaveBeenCalled();

    await userEvent.press(
      screen.getByRole('button', { name: '에어컨 필터 교체 수락' }),
    );
    expect(haptic.success).toHaveBeenCalledTimes(1);
  });

  it('수락이 실패하면 햅틱을 울리지 않는다', async () => {
    jest.mocked(haptic.success).mockClear();
    await renderSchedule({ onAccept: jest.fn(async () => false) });
    await userEvent.press(screen.getByRole('tab', { name: '응답 필요 2건' }));

    await userEvent.press(
      screen.getByRole('button', { name: '에어컨 필터 교체 수락' }),
    );

    expect(haptic.success).not.toHaveBeenCalled();
  });

  // #197: 수락(POST)은 낙관적으로 반영한다(목록에서 곧바로 빠지는 것은 경로·조회 훅이 한다). 보내는 동안
  // 카드 버튼을 비활성(Disabled 채움)으로 바꾸지 않는다. Figma 3754:6858 거절은 Gray500 테두리·Gray700 글자,
  // 3754:6859 수락은 Primary 채움·흰 글자 그대로다
  it('수락을 보내는 동안에도 그 요청의 거절·수락 모양이 그대로이고, 다시 눌러도 한 번만 보낸다', async () => {
    let finish: (accepted: boolean) => void = () => {};
    const onAccept = jest.fn(
      () =>
        new Promise<boolean>(resolve => {
          finish = resolve;
        }),
    );
    const onReject = jest.fn();
    await renderSchedule({ onAccept, onReject });
    await userEvent.press(screen.getByRole('tab', { name: '응답 필요 2건' }));
    const acceptButton = () =>
      screen.getByRole('button', { name: '에어컨 필터 교체 수락' });
    const rejectButton = () =>
      screen.getByRole('button', { name: '에어컨 필터 교체 거절' });

    await userEvent.press(acceptButton());
    await userEvent.press(acceptButton());
    // 수락을 보낸 요청은 거절 사유로 가지 않는다
    await userEvent.press(rejectButton());

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).not.toHaveBeenCalled();
    expect(acceptButton()).toBeEnabled();
    expect(rejectButton()).toBeEnabled();
    expect(rejectButton()).toHaveStyle({
      borderWidth: 1,
      borderColor: colors.gray[500],
    });
    expect(rejectButton()).not.toHaveStyle({
      backgroundColor: colors.disabled,
    });
    expect(within(rejectButton()).getByText('거절')).toHaveStyle({
      color: colors.gray[700],
    });
    expect(acceptButton()).toHaveStyle({ backgroundColor: colors.primary });
    expect(within(acceptButton()).getByText('수락')).toHaveStyle({
      color: colors.white[100],
    });
    // 다른 요청은 그대로 누를 수 있다
    await userEvent.press(
      screen.getByRole('button', { name: '수전 교체 거절' }),
    );
    expect(onReject).toHaveBeenCalledWith('p2');

    // 실패해 돌아오면 다시 보낼 수 있다
    await act(async () => finish(false));
    await userEvent.press(acceptButton());
    expect(onAccept).toHaveBeenCalledTimes(2);
  });

  it('요청 카드를 보여주고 수락·거절·상세 콜백을 부른다', async () => {
    const onAccept = jest.fn();
    const onReject = jest.fn();
    const onOpenRequest = jest.fn();
    await renderSchedule({ onAccept, onReject, onOpenRequest });

    await userEvent.press(screen.getByRole('tab', { name: '응답 필요 2건' }));

    expect(screen.getByText('에어컨 필터 교체')).toBeOnTheScreen();
    // 시간 뒤 날짜는 카드 표기(formatCardDay)다. 오늘이 아니라 '오늘' 이 붙지 않는다
    expect(screen.getByText('14:00 – 15:00  12. 20. (일)')).toBeOnTheScreen();

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

    // 확정 일정 카드는 그 작업의 상세를 여는 버튼이다 (#221). 주간·월간 어느 보기에서도 같다
    it.each([
      ['주간', false],
      ['월간', true],
    ] as const)(
      '%s: 확정 일정 카드를 누르면 그 작업을 연다',
      async (_label, open) => {
        const onOpenWork = jest.fn();
        await renderSchedule({ onOpenWork });
        if (open) {
          await userEvent.press(
            screen.getByRole('button', { name: '달력 펼치기' }),
          );
        }

        await userEvent.press(
          screen.getByRole('button', { name: /^보일러 점검, 작업전/ }),
        );

        expect(onOpenWork).toHaveBeenCalledTimes(1);
        expect(onOpenWork).toHaveBeenCalledWith('c2');
      },
    );

    it('다른 날을 골라도 그 날의 카드를 누르면 그 작업을 연다', async () => {
      const onOpenWork = jest.fn();
      await renderSchedule({ onOpenWork });
      await userEvent.press(
        screen.getByRole('button', { name: '12월 16일 수요일' }),
      );

      await userEvent.press(
        screen.getByRole('button', { name: /^도어록 교체, 배정됨/ }),
      );

      expect(onOpenWork).toHaveBeenCalledWith('c3');
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
      expect(inset).toBe(24);
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
      onOpenWork: jest.fn(),
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
        onOpenWork={jest.fn()}
        requestedTab="pending"
      />,
    );

    expect(screen.getByRole('tab', { name: /^응답 필요/ })).toBeSelected();
  });
});

describe('ScheduleScreen — 불러오기', () => {
  const loading = { status: 'loading' } as const;
  const failed = (onRetry = jest.fn()) =>
    ({ status: 'error', message: '네트워크 문구', onRetry } as const);

  it('확정 일정을 불러오는 동안 목록 자리에 일정 카드를 닮은 스켈레톤을 보인다 (빈 안내·스피너 대신)', async () => {
    await renderSchedule({ confirmed: [], confirmedLoad: loading });

    expectOnlySkeletons('confirmed-cards-skeleton');
    expect(screen.queryByText('이 날은 일정이 없습니다')).not.toBeOnTheScreen();
  });

  it('응답 필요를 불러오는 동안 요청 카드를 닮은 스켈레톤을 보인다 (빈 안내·스피너 대신)', async () => {
    await renderSchedule({ pending: [], pendingLoad: loading });
    await userEvent.press(screen.getByRole('tab', { name: '응답 필요 0건' }));

    expectOnlySkeletons('pending-requests-skeleton');
    expect(screen.queryByText('응답할 요청이 없습니다')).not.toBeOnTheScreen();
  });

  it('응답 필요를 불러오지 못하면 문구와 다시 시도를 보인다', async () => {
    const onRetry = jest.fn();
    await renderSchedule({ pending: [], pendingLoad: failed(onRetry) });
    await userEvent.press(screen.getByRole('tab', { name: '응답 필요 0건' }));

    expect(screen.getByText('네트워크 문구')).toBeOnTheScreen();
    expect(screen.queryByText('응답할 요청이 없습니다')).not.toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('두 목록 모두 당겨서 새로고침한다', async () => {
    const onRefresh = jest.fn();
    await renderSchedule({ onRefresh, refreshing: true });
    const confirmedList = screen.getByTestId('schedule-confirmed-list');

    expect(confirmedList.props.refreshing).toBe(true);
    await fireEvent(confirmedList, 'refresh');
    await userEvent.press(screen.getByRole('tab', { name: '응답 필요 2건' }));
    await fireEvent(screen.getByTestId('schedule-pending-list'), 'refresh');

    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('고른 날의 달과 펼친 달력의 달이 바뀔 때마다 그 달들을 알린다 (그 달의 일정을 불러온다)', async () => {
    const onVisibleMonthsChange = jest.fn();
    await renderSchedule({ onVisibleMonthsChange });

    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));
    await userEvent.press(screen.getByRole('button', { name: '다음 달' }));
    expect(onVisibleMonthsChange).toHaveBeenLastCalledWith([
      { year: 2026, month: 11 },
      { year: 2027, month: 0 },
    ]);

    await userEvent.press(
      screen.getByRole('button', { name: '1월 4일 월요일' }),
    );
    expect(onVisibleMonthsChange).toHaveBeenLastCalledWith([
      { year: 2027, month: 0 },
    ]);
  });
});

// 켜 둔 채 날짜가 바뀌면(자정, 다른 날 active) 오늘을 보던 화면은 새 오늘로 옮기고, 직접 고른 날은 그대로 둔다 (#114 리뷰)
describe('ScheduleScreen — 날짜가 바뀌면', () => {
  const props = {
    confirmed,
    pending,
    onAccept: jest.fn(async () => true),
    onReject: jest.fn(),
    onOpenRequest: jest.fn(),
    onOpenWork: jest.fn(),
  };

  it('오늘을 고르고 있었으면 새 오늘을 고르고 그 달을 알린다', async () => {
    const onVisibleMonthsChange = jest.fn();
    const { rerender } = await render(
      <ScheduleScreen
        {...props}
        today={new Date(2026, 11, 31)}
        onVisibleMonthsChange={onVisibleMonthsChange}
      />,
    );

    await rerender(
      <ScheduleScreen
        {...props}
        today={new Date(2027, 0, 1)}
        onVisibleMonthsChange={onVisibleMonthsChange}
      />,
    );

    expect(screen.getByText('2027년 1월 1일 (금)')).toBeOnTheScreen();
    expect(onVisibleMonthsChange).toHaveBeenLastCalledWith([
      { year: 2027, month: 0 },
    ]);
  });

  // 넘김이 끝나기 전에 날짜가 바뀌어 새 오늘의 주·달로 옮기면 그 넘김은 버린다 (#202)
  it('주간: 다음 주로 미끄러지는 중에 새 주의 오늘로 넘어가면 새 오늘의 주에 머문다', async () => {
    const { finish } = holdNativeAnimations();
    const { rerender } = await render(
      <ScheduleScreen {...props} today={new Date(2026, 11, 19)} />,
    );
    await fireEvent(screen.getByTestId('week-strip-track'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 345, height: 69 } },
    });

    await drag(weekStrip(), { dx: -80 });
    await rerender(
      <ScheduleScreen {...props} today={new Date(2026, 11, 20)} />,
    );
    await finish();

    expect(visibleSelectedDays()).toEqual(['12월 20일 일요일']);
    expect(
      screen.queryByRole('button', { name: '12월 27일 일요일' }),
    ).not.toBeOnTheScreen();
    jest.restoreAllMocks();
  });

  it('월간: 다음 달로 미끄러지는 중에 새 달의 오늘로 넘어가면 새 오늘의 달에 머문다', async () => {
    const { finish } = holdNativeAnimations();
    const { rerender } = await render(
      <ScheduleScreen {...props} today={new Date(2026, 11, 31)} />,
    );
    await userEvent.press(screen.getByRole('button', { name: '달력 펼치기' }));
    await fireEvent(screen.getByTestId('month-calendar-track'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 345, height: 400 } },
    });

    await fireEvent.press(screen.getByRole('button', { name: '다음 달' }));
    await rerender(<ScheduleScreen {...props} today={new Date(2027, 0, 1)} />);
    await finish();

    expect(screen.getByText('2027년 1월')).toBeOnTheScreen();
    expect(visibleSelectedDays()).toEqual(['1월 1일 금요일']);
    jest.restoreAllMocks();
  });

  it('다른 날을 직접 골라 보고 있었으면 그대로 둔다', async () => {
    const { rerender } = await render(
      <ScheduleScreen {...props} today={new Date(2026, 11, 15)} />,
    );
    await userEvent.press(
      screen.getByRole('button', { name: '12월 17일 목요일' }),
    );

    await rerender(
      <ScheduleScreen {...props} today={new Date(2026, 11, 16)} />,
    );

    expect(screen.getByText('2026년 12월 17일 (목)')).toBeOnTheScreen();
  });
});

// #196: Figma 내 스케줄 화면 - 확정 일정 (기본) 51019:15863(주간)·51019:15902(달력). 일정이 없는 날은 아이콘·설명 없이
// '이 날은 일정이 없습니다' 한 줄(Body/XS/Regular, Gray600, 화면 폭 가운데)이 날짜 블록 아래 60 에 놓인다
describe('ScheduleScreen — 일정이 없을 때 (#196)', () => {
  it.each([
    ['주간 줄', 'week-strip', false],
    ['펼친 달력', 'month-calendar', true],
  ] as const)(
    '%s 아래: 아이콘 없이 Body/XS/Regular Gray600 가운데 글 한 줄이 날짜 블록 아래 60 에 놓인다',
    async (_label, testID, open) => {
      await renderSchedule({ confirmed: [] });
      if (open) {
        await userEvent.press(
          screen.getByRole('button', { name: '달력 펼치기' }),
        );
      }

      const message = screen.getByText('이 날은 일정이 없습니다');
      expect(message).toHaveStyle({
        ...typography['Body/XS/Regular'],
        color: colors.gray[600],
        textAlign: 'center',
      });
      expectMessageOnly(message);
      // 날짜 블록처럼 화면 폭을 차지한다 (Figma 글 상자 x 0, 폭 393)
      expect(stylePt(message, 'paddingHorizontal')).toBe(0);
      const dateArea = screen.getByTestId(testID).parent as HostElement;
      expect(
        stylePt(dateArea, 'paddingBottom') + stylePt(message, 'paddingTop'),
      ).toBe(60);
    },
  );

  // Figma 에 응답 필요 빈 상태 프레임이 없어 확정 일정의 빈 상태와 같은 모양·간격으로 둔다 (기본안)
  it('응답 필요에 요청이 없으면 확정 일정과 같은 모양으로 하위 탭 아래 60 에 안내한다', async () => {
    await renderSchedule({ pending: [] });
    await userEvent.press(screen.getByRole('tab', { name: '응답 필요 0건' }));

    const message = screen.getByText('응답할 요청이 없습니다');
    expect(message).toHaveStyle({
      ...typography['Body/XS/Regular'],
      color: colors.gray[600],
      textAlign: 'center',
    });
    expectMessageOnly(message);
    // 겹쳐 그린 머리(제목 줄 + 하위 탭)를 잰 높이에서 리스트 내용이 시작하는 자리를 읽어, 머리 아래 끝에서 글까지가 60 인지 본다
    const HEADER = 150;
    await fireEvent(autoHideHeader(), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: HEADER } },
    });
    const contentTop = contentStyleOf(
      screen.getByTestId('schedule-pending-list'),
    ).paddingTop as number;
    expect(contentTop - HEADER + stylePt(message, 'paddingTop')).toBe(60);
  });
});
