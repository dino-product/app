import {
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { drag } from '../../../../jest/gesture';
import { colors, typography } from '../../../shared/design-system';
import { iconSvgs } from '../../../shared/design-system/icons/svgs';
import { gestureExclusionStyle } from '../../../shared/native/gestureExclusion';
import { iconSvgIn } from '../../../shared/testing/icon';
import type { HostElement } from '../../../shared/testing/touchTarget';
import { MonthCalendar } from './MonthCalendar';

const renderCalendar = async () => {
  const props = { onSelect: jest.fn(), onPrev: jest.fn(), onNext: jest.fn() };
  await render(
    <MonthCalendar
      year={2026}
      month={11}
      selected={new Date(2026, 11, 15)}
      eventCounts={new Map()}
      {...props}
    />,
  );
  return props;
};

const calendar = () => screen.getByTestId('month-calendar').props;

describe('MonthCalendar', () => {
  it('왼쪽으로 밀면 다음 달, 오른쪽으로 밀면 이전 달로 간다', async () => {
    const { onPrev, onNext } = await renderCalendar();

    await drag(calendar(), { dx: -80 });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();

    await drag(calendar(), { dx: 80 });
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('세로로 밀면 달을 옮기지 않는다', async () => {
    const { onPrev, onNext } = await renderCalendar();

    await drag(calendar(), { dx: -60, dy: -120 });
    await drag(calendar(), { dx: 60, dy: 120 });

    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('이전·다음 달 버튼도 밀기와 같은 콜백을 부른다', async () => {
    const { onPrev, onNext } = await renderCalendar();

    await userEvent.press(screen.getByRole('button', { name: '다음 달' }));
    await userEvent.press(screen.getByRole('button', { name: '이전 달' }));

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });
});

// 날짜 칸 버튼 안의 일정 점
const dotsOf = (name: string) =>
  within(screen.getByRole('button', { name })).queryAllByTestId('event-dot');

// Figma 내 일정 › 달력 펼침 (2714:13093) 의 Calendar Contents 칸
describe('MonthCalendar 표시', () => {
  // 2026년 12월: 11월 29일(일) ~ 1월 2일(토) 5주
  const renderDecember = (
    eventCounts = new Map<string, number>(),
    selected = new Date(2026, 11, 15),
  ) =>
    render(
      <MonthCalendar
        year={2026}
        month={11}
        selected={selected}
        eventCounts={eventCounts}
        onSelect={jest.fn()}
        onPrev={jest.fn()}
        onNext={jest.fn()}
      />,
    );

  it('일정 개수만큼 점을 그리고, 3건이 넘어도 점은 3개다', async () => {
    await renderDecember(
      new Map([
        ['2026-12-03', 1],
        ['2026-12-08', 2],
        ['2026-12-10', 5],
      ]),
    );

    expect(dotsOf('12월 3일 목요일')).toHaveLength(1);
    expect(dotsOf('12월 8일 화요일')).toHaveLength(2);
    expect(dotsOf('12월 10일 목요일')).toHaveLength(3);
    expect(dotsOf('12월 9일 수요일')).toHaveLength(0);
  });

  it('점은 연보라이고, 선택한 날은 흰색이다', async () => {
    await renderDecember(
      new Map([
        ['2026-12-08', 2],
        ['2026-12-15', 3],
      ]),
    );

    for (const dot of dotsOf('12월 8일 화요일')) {
      expect(dot).toHaveStyle({ backgroundColor: colors.primary100 });
    }
    for (const dot of dotsOf('12월 15일 화요일')) {
      expect(dot).toHaveStyle({ backgroundColor: colors.white[100] });
    }
  });

  it('선택한 날은 Primary 배경의 모서리 둥근 사각형이고 숫자는 흰색이다', async () => {
    await renderDecember();

    const day = screen.getByRole('button', { name: '12월 15일 화요일' });
    expect(day).toHaveStyle({
      backgroundColor: colors.primary,
      borderRadius: 12,
    });
    expect(within(day).getByText('15')).toHaveStyle({
      color: colors.white[100],
    });
    expect(
      screen.getByRole('button', { name: '12월 16일 수요일' }),
    ).not.toHaveStyle({ backgroundColor: colors.primary });
  });

  it('선택한 날은 일·토요일이어도 숫자가 흰색이다', async () => {
    await renderDecember(new Map(), new Date(2026, 11, 6));

    const sunday = screen.getByRole('button', { name: '12월 6일 일요일' });
    expect(within(sunday).getByText('6')).toHaveStyle({
      color: colors.white[100],
    });
  });

  // DesignSystem › Calendar Contents (View=Month): 일요일 Warning1, 토요일 Accents/Blue, 평일 Gray800 (#77)
  it('이번 달은 일요일 빨강·토요일 파랑·평일 Gray800 이고, 다른 달은 회색이다', async () => {
    await renderDecember();

    const dateText = (name: string, date: string) =>
      within(screen.getByRole('button', { name })).getByText(date);
    expect(dateText('12월 6일 일요일', '6')).toHaveStyle({
      color: colors.warning[1],
    });
    expect(dateText('12월 5일 토요일', '5')).toHaveStyle({
      color: colors.accents.blue,
    });
    expect(dateText('12월 9일 수요일', '9')).toHaveStyle({
      color: colors.gray[800],
    });
    // 다른 달은 일·토요일도 회색이다
    expect(dateText('11월 29일 일요일', '29')).toHaveStyle({
      color: colors.gray[400],
    });
    expect(dateText('1월 2일 토요일', '2')).toHaveStyle({
      color: colors.gray[400],
    });
  });

  it('월 제목은 Body/S/SemiBold, Gray800 이다', async () => {
    await renderDecember();

    expect(screen.getByText('2026년 12월')).toHaveStyle({
      fontSize: typography['Body/S/SemiBold'].fontSize,
      fontFamily: typography['Body/S/SemiBold'].fontFamily,
      color: colors.gray[800],
    });
  });

  // Figma 요일 줄은 높이 34 안 가운데에 글자가 있고, 바로 아래에 날짜 칸이 붙는다
  it('요일 줄은 높이 34 가운데 정렬이고 날짜 칸과 사이 간격이 없다', async () => {
    await renderDecember();

    const weekdays = screen.getByText('일').parent as HostElement;
    expect(weekdays).toHaveStyle({ height: 34, alignItems: 'center' });
    const grid = weekdays.parent as HostElement;
    expect(StyleSheet.flatten(grid.props.style)?.gap).toBeUndefined();
  });

  // Figma 요일 줄은 날짜 칸과 다른 Type Color 를 쓴다
  it('요일 줄은 Body/XS/Medium 이고 일 Type Color/Red, 토 Type Color/Blue, 평일 Gray800 이다', async () => {
    await renderDecember();

    expect(screen.getByText('일')).toHaveStyle({
      color: colors.typeColor.red,
      fontSize: typography['Body/XS/Medium'].fontSize,
    });
    expect(screen.getByText('토')).toHaveStyle({
      color: colors.typeColor.blue,
    });
    expect(screen.getByText('수')).toHaveStyle({ color: colors.gray[800] });
  });

  it('스크린리더는 날짜 레이블 그대로 읽고, 일정이 있으면 건수를 값으로 읽는다', async () => {
    await renderDecember(new Map([['2026-12-10', 5]]));

    expect(
      screen.getByRole('button', { name: '12월 10일 목요일' }),
    ).toHaveAccessibilityValue({ text: '일정 5건' });
    expect(
      screen.getByRole('button', { name: '12월 9일 수요일' }).props
        .accessibilityValue?.text,
    ).toBeUndefined();
  });

  it('이전·다음 달 버튼은 Figma 의 회색 채운 삼각형이다', async () => {
    await renderDecember();

    const prev = iconSvgIn(screen.getByRole('button', { name: '이전 달' }));
    const next = iconSvgIn(screen.getByRole('button', { name: '다음 달' }));
    expect(prev.props.xml).toBe(iconSvgs['triangle-left'].xml);
    expect(next.props.xml).toBe(iconSvgs['triangle-right'].xml);
    expect(prev.props.color).toBe(colors.gray[300]);
    expect(next.props.color).toBe(colors.gray[300]);
  });
});

// 제스처 내비게이션에서는 가장자리에서 시작한 밀기를 시스템이 먼저 받아 뒤로 가기(홈 탭)로 쓴다 (#58).
// 시스템은 한쪽 가장자리마다 세로 200dp 까지만 빼 주므로 날짜 칸 첫 주부터 200dp 를 뺀다
describe('MonthCalendar Android 가장자리 밀기', () => {
  const renderMonthOn = async (
    os: 'ios' | 'android',
    year = 2026,
    month = 9,
  ) => {
    jest.replaceProperty(Platform, 'OS', os);
    await render(
      <MonthCalendar
        year={year}
        month={month}
        selected={new Date(year, month, 15)}
        eventCounts={new Map()}
        edgeInset={24}
        onSelect={jest.fn()}
        onPrev={jest.fn()}
        onNext={jest.fn()}
      />,
    );
  };
  const area = () => screen.getByTestId('gesture-exclusion');

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // 날짜 칸 69, 주 사이 4. 가장 짧은 4주 달(288)도 200dp 를 넘어 어느 달이든 같다
  it.each([
    { label: '2026년 2월 (4주)', month: 1, height: 200 },
    { label: '2026년 10월 (5주)', month: 9, height: 200 },
    { label: '2026년 8월 (6주)', month: 7, height: 200 },
  ])(
    '$label: 첫 주부터 $height dp 를 부모 여백까지 넓혀 뺀다',
    async ({ month, height }) => {
      await renderMonthOn('android', 2026, month);

      expect(StyleSheet.flatten(area().props.style)).toEqual(
        gestureExclusionStyle({ edgeInset: 24, top: 0, height }),
      );
    },
  );

  // 제목 줄에는 이전·다음 달 버튼이 있다. 날짜 칸은 같은 주의 뒤 형제라 제외 영역보다 먼저 터치를 받는다
  it('제외 영역은 첫 주의 첫 자식이라 제목·요일 줄은 빼지 않는다', async () => {
    await renderMonthOn('android');

    const firstWeek = screen.getByRole('button', { name: '9월 27일 일요일' })
      .parent as HostElement;
    expect(firstWeek.children[0]).toBe(area());
  });

  it('iOS 에서는 제외 영역을 두지 않는다', async () => {
    await renderMonthOn('ios');

    expect(screen.queryByTestId('gesture-exclusion')).toBeNull();
  });
});
