import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { drag } from '../../../../jest/gesture';
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

    await drag(strip(), { dx: 10, dy: 120 });

    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('VoiceOver 는 날짜 버튼의 이전 주·다음 주 동작으로 주를 옮긴다', async () => {
    const { onPrev, onNext } = await renderStrip();
    const day = screen.getByRole('button', { name: '12월 16일 수요일' });

    expect(day.props.accessibilityActions).toEqual([
      { name: 'prevWeek', label: '이전 주' },
      { name: 'nextWeek', label: '다음 주' },
    ]);

    await fireEvent(day, 'accessibilityAction', {
      nativeEvent: { actionName: 'nextWeek' },
    });
    expect(onNext).toHaveBeenCalledTimes(1);

    await fireEvent(day, 'accessibilityAction', {
      nativeEvent: { actionName: 'prevWeek' },
    });
    expect(onPrev).toHaveBeenCalledTimes(1);
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
