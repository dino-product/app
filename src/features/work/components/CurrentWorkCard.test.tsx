import { render, screen, userEvent } from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import { currentWork } from '../mockData';
import { CurrentWorkCard } from './CurrentWorkCard';

describe('CurrentWorkCard', () => {
  it('작업명, 시간, 고객·주소를 보여준다', async () => {
    await render(
      <CurrentWorkCard
        work={currentWork}
        started={false}
        onStart={jest.fn()}
        onOpen={jest.fn()}
      />,
    );

    expect(screen.getByText('보일러 점검')).toBeOnTheScreen();
    expect(screen.getByText('11:00 -12:00')).toBeOnTheScreen();
    expect(screen.getByText('이수연')).toBeOnTheScreen();
    expect(screen.getByText('서울 송파구 올림픽로 88')).toBeOnTheScreen();
  });

  it('시작 전이면 Secondary "작업 시작" CTA 로 onStart 를 호출한다', async () => {
    const onStart = jest.fn();
    await render(
      <CurrentWorkCard
        work={currentWork}
        started={false}
        onStart={onStart}
        onOpen={jest.fn()}
      />,
    );

    const cta = screen.getByRole('button', { name: '작업 시작' });
    expect(cta).toHaveStyle({ backgroundColor: colors.secondary });
    await userEvent.press(cta);

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('시작 후에는 Primary "작업 수행중" CTA 로 상세를 연다', async () => {
    const onOpen = jest.fn();
    await render(
      <CurrentWorkCard
        work={currentWork}
        started
        onStart={jest.fn()}
        onOpen={onOpen}
      />,
    );

    const cta = screen.getByRole('button', { name: '작업 수행중' });
    expect(cta).toHaveStyle({ backgroundColor: colors.primary });
    await userEvent.press(cta);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('카드 머리(작업명 줄)를 누르면 상세를 연다', async () => {
    const onOpen = jest.fn();
    await render(
      <CurrentWorkCard
        work={currentWork}
        started={false}
        onStart={jest.fn()}
        onOpen={onOpen}
      />,
    );

    await userEvent.press(
      screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
    );

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('렌치 일러스트와 상세 화살표를 그린다', async () => {
    await render(
      <CurrentWorkCard
        work={currentWork}
        started={false}
        onStart={jest.fn()}
        onOpen={jest.fn()}
      />,
    );

    expect(
      screen.getByTestId('work-illustration', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByTestId('icon-chevron-right', { includeHiddenElements: true }),
    ).toBeTruthy();
  });
});
