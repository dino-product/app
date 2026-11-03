import {
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import { drag } from '../../../../jest/gesture';
import { holdNativeAnimations } from '../../../../jest/nativeAnimation';
import { colors, typography } from '../../../shared/design-system';
import { gestureExclusionStyle } from '../../../shared/native/gestureExclusion';
import type { HostElement } from '../../../shared/testing/touchTarget';
import { addWeeks, weekDays } from '../model';
import { WeekStrip } from './WeekStrip';

const selected = new Date(2026, 11, 15); // 화요일

const renderStrip = async (date = selected) => {
  const props = { onSelect: jest.fn(), onPrev: jest.fn(), onNext: jest.fn() };
  const view = await render(
    <WeekStrip days={weekDays(date)} selected={date} {...props} />,
  );
  return { ...props, ...view };
};

const strip = () => screen.getByTestId('week-strip').props;

describe('WeekStrip', () => {
  it('날짜를 누르면 그 날을 고른다', async () => {
    const { onSelect } = await renderStrip();

    await userEvent.press(
      screen.getByRole('button', { name: '12월 17일 목요일' }),
    );

    expect(onSelect).toHaveBeenCalledWith(new Date(2026, 11, 17));
  });

  it('왼쪽으로 밀면 다음 주, 오른쪽으로 밀면 이전 주로 간다', async () => {
    const { onPrev, onNext } = await renderStrip();

    await drag(strip(), { dx: -80 });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();

    await drag(strip(), { dx: 80 });
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('세로로 밀면 주를 옮기지 않는다', async () => {
    const { onPrev, onNext } = await renderStrip();

    await drag(strip(), { dx: -60, dy: 120 });
    await drag(strip(), { dx: 60, dy: -120 });

    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('VoiceOver 는 날짜 버튼의 이전 주·다음 주 동작으로 그 칸의 요일을 앞뒤 주에서 고르고 읽어 준다', async () => {
    const announce = jest.mocked(
      AccessibilityInfo.announceForAccessibilityWithOptions,
    );
    announce.mockClear();
    const { onSelect, onPrev, onNext } = await renderStrip();
    // 선택은 15일 화요일, VoiceOver 포커스는 16일 수요일
    const day = screen.getByRole('button', { name: '12월 16일 수요일' });

    expect(day.props.accessibilityActions).toEqual([
      { name: 'prevWeek', label: '이전 주' },
      { name: 'nextWeek', label: '다음 주' },
    ]);

    await fireEvent(day, 'accessibilityAction', {
      nativeEvent: { actionName: 'nextWeek' },
    });
    expect(onSelect).toHaveBeenLastCalledWith(new Date(2026, 11, 23));
    expect(announce).toHaveBeenLastCalledWith('12월 23일 수요일', {
      queue: true,
    });

    await fireEvent(day, 'accessibilityAction', {
      nativeEvent: { actionName: 'prevWeek' },
    });
    expect(onSelect).toHaveBeenLastCalledWith(new Date(2026, 11, 9));
    expect(announce).toHaveBeenLastCalledWith('12월 9일 수요일', {
      queue: true,
    });
    // 밀기 콜백은 부르지 않는다 (선택 요일을 따르는 밀기와 달리 포커스한 칸 기준)
    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('주가 바뀌어도 요일 칸은 그대로 남아 VoiceOver 포커스가 같은 요일에 머문다', async () => {
    const { rerender, onSelect, onPrev, onNext } = await renderStrip();
    const wednesday = screen.getByRole('button', { name: '12월 16일 수요일' });

    const next = new Date(2026, 11, 22);
    await rerender(
      <WeekStrip
        days={weekDays(next)}
        selected={next}
        onSelect={onSelect}
        onPrev={onPrev}
        onNext={onNext}
      />,
    );

    // 실패 메시지가 순환 구조인 요소 전체를 찍지 않게 같은 요소인지만 비교한다
    const sameCell =
      screen.getByRole('button', { name: '12월 23일 수요일' }) === wednesday;
    expect(sameCell).toBe(true);
  });
});

// 밀면 손가락을 따라 옆 주가 드러나고, 다 넘어간 뒤에 주가 바뀐다 (#65)
describe('WeekStrip 넘김', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const hidden = { includeHiddenElements: true };
  /** 날짜 칸이 든 페이지 (칸 › 주 줄 › 페이지) */
  const pageOf = (day: HostElement) => day.parent?.parent as HostElement;
  const layoutTrack = () =>
    fireEvent(screen.getByTestId('week-strip-track'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 69 } },
    });

  // ScheduleScreen 처럼 밀어 넘기면 같은 요일을 앞뒤 주에서 고른다
  function StatefulStrip() {
    const [date, setDate] = useState(selected);
    return (
      <WeekStrip
        days={weekDays(date)}
        selected={date}
        onSelect={setDate}
        onPrev={() => setDate(addWeeks(date, -1))}
        onNext={() => setDate(addWeeks(date, 1))}
      />
    );
  }

  it('앞뒤 주를 옆 페이지로 그려 두지만 스크린리더는 읽지 않고 누를 수도 없다', async () => {
    await renderStrip();

    for (const name of ['12월 8일 화요일', '12월 22일 화요일']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
      const page = pageOf(screen.getByRole('button', { name, ...hidden }));
      expect(page.props).toMatchObject({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      });
      expect(page).toHaveStyle({ pointerEvents: 'none' });
    }
  });

  // 밀어 넘기면 같은 요일을 고르므로 넘어간 뒤의 모습과 같다
  it('옆 주는 같은 요일을 고른 모습으로 그린다', async () => {
    await renderStrip();

    expect(
      screen.getByRole('button', { name: '12월 22일 화요일', ...hidden }),
    ).toBeSelected();
    expect(
      screen.getByRole('button', { name: '12월 23일 수요일', ...hidden }),
    ).not.toBeSelected();
  });

  it('밀어서 넘긴 뒤에도 요일 칸이 그대로 남아 포커스가 같은 요일에 머문다', async () => {
    const { finish } = holdNativeAnimations();
    await render(<StatefulStrip />);
    await layoutTrack();
    const wednesday = screen.getByRole('button', { name: '12월 16일 수요일' });

    await drag(screen.getByTestId('week-strip').props, { dx: -80 });
    // 다 넘어가기 전에는 주가 그대로다
    expect(
      screen.getByRole('button', { name: '12월 15일 화요일' }),
    ).toBeSelected();
    await finish();

    expect(
      screen.getByRole('button', { name: '12월 22일 화요일' }),
    ).toBeSelected();
    const sameCell =
      screen.getByRole('button', { name: '12월 23일 수요일' }) === wednesday;
    expect(sameCell).toBe(true);
  });
});

// Figma DesignSystem › Calendar Contents (View=Week). 12월 13일(일) ~ 19일(토), 15일(화) 선택 (#77)
describe('WeekStrip 표시', () => {
  const textIn = (name: string, text: string) =>
    within(screen.getByRole('button', { name })).getByText(text);

  it('일요일은 Warning1, 토요일은 Accents/Blue, 평일은 Gray900 이고 요일 글자도 같은 색이다', async () => {
    await renderStrip();

    for (const [name, date, weekday, color] of [
      ['12월 13일 일요일', '13', '일', colors.warning[1]],
      ['12월 19일 토요일', '19', '토', colors.accents.blue],
      ['12월 16일 수요일', '16', '수', colors.gray[900]],
    ]) {
      expect(textIn(name, date)).toHaveStyle({ color });
      expect(textIn(name, weekday)).toHaveStyle({ color, opacity: 0.6 });
    }
  });

  it('칸은 높이 69, 반경 10 이고 선택한 날은 Primary 배경에 흰 SemiBold 숫자다', async () => {
    await renderStrip();

    const day = screen.getByRole('button', { name: '12월 15일 화요일' });
    expect(day).toHaveStyle({
      height: 69,
      borderRadius: 10,
      backgroundColor: colors.primary,
    });
    expect(textIn('12월 15일 화요일', '15')).toHaveStyle({
      color: colors.white[100],
      fontFamily: typography['Body/XS/SemiBold'].fontFamily,
    });
    expect(textIn('12월 16일 수요일', '16')).toHaveStyle({
      fontFamily: typography['Body/XS/Medium'].fontFamily,
    });
  });
});

// 제스처 내비게이션에서는 가장자리에서 시작한 밀기를 시스템이 먼저 받아 뒤로 가기(홈 탭)로 쓴다 (#58)
describe('WeekStrip Android 가장자리 밀기', () => {
  const renderOn = async (os: 'ios' | 'android') => {
    jest.replaceProperty(Platform, 'OS', os);
    await render(
      <WeekStrip
        days={weekDays(selected)}
        selected={selected}
        edgeInset={24}
        onSelect={jest.fn()}
        onPrev={jest.fn()}
        onNext={jest.fn()}
      />,
    );
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Android 에서는 주간 줄 전체를 부모 여백까지 넓혀 시스템 제스처에서 뺀다', async () => {
    await renderOn('android');

    expect(
      StyleSheet.flatten(screen.getByTestId('gesture-exclusion').props.style),
    ).toEqual(gestureExclusionStyle({ edgeInset: 24 }));
  });

  // 여백에서 시작한 터치도 밀기 핸들러가 있는 루트로 올라간다. 뒤 형제인 날짜 칸이 먼저 터치를 받는다
  it('제외 영역은 루트의 첫 자식이다', async () => {
    await renderOn('android');

    expect(screen.getByTestId('week-strip').children[0]).toBe(
      screen.getByTestId('gesture-exclusion'),
    );
  });

  it('iOS 에서는 제외 영역을 두지 않는다', async () => {
    await renderOn('ios');

    expect(screen.queryByTestId('gesture-exclusion')).toBeNull();
  });
});
