import { render, screen, userEvent } from '@testing-library/react-native';
import { currentWork, weeklySchedule } from '../mockData';
import { WorkHomeScreen } from './WorkHomeScreen';

const renderHome = (
  overrides: Partial<Parameters<typeof WorkHomeScreen>[0]> = {},
) =>
  render(
    <WorkHomeScreen
      currentWork={currentWork}
      schedule={weeklySchedule}
      weekLabel="9. 14. – 9. 20."
      started={false}
      onStartWork={jest.fn()}
      onOpenWork={jest.fn()}
      {...overrides}
    />,
  );

describe('WorkHomeScreen', () => {
  it('"내 작업" 헤더와 주간 일정 제목을 보여준다', async () => {
    await renderHome();

    expect(screen.getByRole('header', { name: '내 작업' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: '일정' })).toBeOnTheScreen();
    expect(screen.getByText('9. 14. – 9. 20.')).toBeOnTheScreen();
  });

  it('작업 시작을 누르면 onStartWork 를 호출한다', async () => {
    const onStartWork = jest.fn();
    await renderHome({ onStartWork });

    await userEvent.press(screen.getByRole('button', { name: '작업 시작' }));

    expect(onStartWork).toHaveBeenCalledTimes(1);
  });

  it('시작한 작업이면 "작업 수행중" CTA 로 그 작업의 상세를 연다', async () => {
    const onOpenWork = jest.fn();
    await renderHome({ started: true, onOpenWork });

    expect(
      screen.queryByRole('button', { name: '작업 시작' }),
    ).not.toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '작업 수행중' }));

    expect(onOpenWork).toHaveBeenCalledWith(currentWork.id);
  });

  it('일정 카드를 그리고, 누르면 그 작업의 상세를 연다', async () => {
    const onOpenWork = jest.fn();
    await renderHome({ onOpenWork });

    const first = weeklySchedule[0];
    expect(screen.getAllByText(first.title).length).toBeGreaterThan(0);

    await userEvent.press(
      screen.getAllByRole('button', { name: /세탁기 설치/ })[0],
    );

    expect(onOpenWork).toHaveBeenCalledWith(first.id);
  });

  it('진행할 작업이 없으면 작업 카드를 그리지 않는다', async () => {
    await renderHome({ currentWork: null });

    expect(
      screen.queryByRole('button', { name: '작업 시작' }),
    ).not.toBeOnTheScreen();
  });

  it('하단 내비게이션에서 홈이 선택되어 있다', async () => {
    await renderHome();

    expect(screen.getByRole('tab', { name: '홈' })).toBeSelected();
  });

  it('일정 카드는 상태와 주소까지 스크린리더에 읽힌다', async () => {
    await renderHome();

    expect(
      screen.getAllByRole('button', {
        name: '세탁기 설치, 작업전, 11:00 – 12:00 오늘 · 9. 19. (토), 한빛 설비 정다은 · 서울 용산구 이태원로 202',
      }),
    ).toHaveLength(3);
  });

  it('알림 종과 목록·격자 보기 아이콘을 그린다', async () => {
    await renderHome();

    expect(
      screen.getByTestId('icon-bell', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByTestId('icon-list', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByTestId('icon-grid', { includeHiddenElements: true }),
    ).toBeTruthy();
  });
});
