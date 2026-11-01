import { render, screen, userEvent } from '@testing-library/react-native';
import { drag } from '../../../../jest/gesture';
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

    await drag(calendar(), { dx: -10, dy: -120 });

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
