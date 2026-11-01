import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import { drag } from '../../../../jest/gesture';
import { gestureExclusionStyle } from '../../../shared/native/gestureExclusion';
import {
  expectMinTouchTarget,
  hitSlopOf,
  minLineHeight,
  stylePt,
  type HostElement,
} from '../../../shared/testing/touchTarget';
import { weekDays } from '../model';
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

// 칸 사이 간격은 화면 폭에 따라 정해져 ScheduleScreen.test 에서 확인한다

const touchDate = new Date(2026, 9, 15);

const renderTouchStrip = () =>
  render(
    <WeekStrip
      days={weekDays(touchDate)}
      selected={touchDate}
      onSelect={jest.fn()}
      onPrev={jest.fn()}
      onNext={jest.fn()}
    />,
  );

const getDay = (name = '10월 15일 목요일') =>
  screen.getByRole('button', { name });

describe('WeekStrip 터치 영역', () => {
  it('날짜 칸은 폭 40 그대로 넓혀 44pt 를 채운다', async () => {
    await renderTouchStrip();

    const day = getDay();
    // 날짜 숫자·요일 글자는 40 보다 좁아 minWidth 가 폭이 된다
    expectMinTouchTarget(day, {
      width: stylePt(day, 'minWidth'),
      height:
        stylePt(day, 'paddingVertical') * 2 +
        minLineHeight(screen.getByText('15')) +
        stylePt(day, 'gap') +
        minLineHeight(screen.getByText('목')),
    });
  });

  // 칸이 붙으면(320pt 화면, 큰 글씨) 넓힌 영역이 옆 칸에 겹친다. 겹친 곳은 뒤 형제가 먼저 받으므로
  // 뒤 칸 쪽으로만 넓히면 옆 칸을 가로채지 않는다
  it('칸이 붙어도 앞 칸을 가로채지 않도록 앞쪽으로는 넓히지 않는다', async () => {
    await renderTouchStrip();

    expect(hitSlopOf(getDay()).left).toBe(0);
  });

  // 루트가 네이티브 뷰가 되면(testID·제스처 핸들러) 그 경계 밖의 터치는 자식에게 가지 않는다
  it('마지막 칸이 루트 밖으로 넓힌 영역은 루트의 터치 영역 안에 든다', async () => {
    await renderTouchStrip();

    const saturday = getDay('10월 17일 토요일');
    const root = saturday.parent as HostElement;
    expect(hitSlopOf(saturday).right).toBeLessThanOrEqual(
      hitSlopOf(root).right,
    );
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
