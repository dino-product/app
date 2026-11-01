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

    await drag(calendar(), { dx: -60, dy: -120 });
    await drag(calendar(), { dx: 60, dy: 120 });

    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('밀기를 받는 루트가 화살표의 위쪽 터치 영역을 자르지 않는다', async () => {
    await renderCalendar();
    // 제스처 핸들러가 있는 View 는 네이티브 뷰가 되고, 그 경계 밖 터치는 자식에게 가지 않는다.
    // 화살표는 루트 맨 위에 있으므로 위쪽 hitSlop 만큼 루트도 넓혀야 한다
    const top = (slop: unknown) =>
      typeof slop === 'number' ? slop : (slop as { top?: number })?.top ?? 0;

    for (const name of ['이전 달', '다음 달']) {
      expect(
        top(screen.getByTestId('month-calendar').props.hitSlop),
      ).toBeGreaterThanOrEqual(
        top(screen.getByRole('button', { name }).props.hitSlop),
      );
    }
  });

  it('이전·다음 달 버튼도 밀기와 같은 콜백을 부른다', async () => {
    const { onPrev, onNext } = await renderCalendar();

    await userEvent.press(screen.getByRole('button', { name: '다음 달' }));
    await userEvent.press(screen.getByRole('button', { name: '이전 달' }));

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });
});
