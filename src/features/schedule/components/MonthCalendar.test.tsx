import { render, screen, userEvent } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { drag } from '../../../../jest/gesture';
import { gestureExclusionStyle } from '../../../shared/native/gestureExclusion';
import type { HostElement } from '../../../shared/testing/touchTarget';
import { MonthCalendar } from './MonthCalendar';

const renderCalendar = async () => {
  const props = { onSelect: jest.fn(), onPrev: jest.fn(), onNext: jest.fn() };
  await render(
    <MonthCalendar
      year={2026}
      month={11}
      selected={new Date(2026, 11, 15)}
      markedKeys={new Set()}
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
        markedKeys={new Set()}
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

  // 날짜 칸 40, 주 사이 12. 어느 달이든 넷째 주까지는 있어 그 구간은 달을 넘겨도 같다
  it.each([
    { label: '2026년 2월 (4주)', month: 1, height: 4 * 40 + 3 * 12 },
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
