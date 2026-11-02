import { render, screen, userEvent } from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import { iconSvgs } from '../../../shared/design-system/icons/svgs';
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

  it('진행할 작업이 없으면 작업 카드 대신 "현재 진행 중인 작업이 없습니다" 카드를 보여 준다', async () => {
    await renderHome({ currentWork: null });

    expect(
      screen.queryByRole('button', { name: '작업 시작' }),
    ).not.toBeOnTheScreen();
    expect(screen.getByText('현재 진행 중인 작업이 없습니다')).toHaveStyle({
      color: colors.white[60],
    });
  });

  it('진행할 작업은 없고 이번 주 일정은 있으면 빈 상태 카드 아래에 일정 목록을 그린다', async () => {
    await renderHome({ currentWork: null });

    // 찾은 순서가 화면 위→아래 순서다
    const [top, ...rest] = screen.getAllByText(
      /^(현재 진행 중인 작업이 없습니다|일정|세탁기 설치)$/,
    );
    expect(top).toHaveTextContent('현재 진행 중인 작업이 없습니다');
    expect(rest.map(node => node.props.children)).toEqual([
      '일정',
      ...weeklySchedule.map(item => item.title),
    ]);
    expect(screen.queryByText('이번 주 일정이 없어요')).not.toBeOnTheScreen();
  });

  it('진행할 작업은 있고 이번 주 일정만 없으면 작업 카드 아래에 일정 빈 상태를 보여 준다', async () => {
    await renderHome({ schedule: [] });

    expect(screen.getByRole('button', { name: '작업 시작' })).toBeOnTheScreen();
    expect(screen.getByText('이번 주 일정이 없어요')).toBeOnTheScreen();
  });

  it('이번 주 일정이 없으면 일정 자리에 회색 달력 아이콘과 안내 문구를 보여 준다', async () => {
    await renderHome({ currentWork: null, schedule: [] });

    expect(screen.getByText('이번 주 일정이 없어요')).toBeOnTheScreen();
    expect(
      screen.getByText('새 작업이 배정되면 여기에 표시돼요'),
    ).toBeOnTheScreen();
    // Figma App Icon · Calendar · Active 를 40pt, Gray300 으로 쓴다
    const icon = screen.getByTestId('empty-schedule-icon', {
      includeHiddenElements: true,
    });
    expect(icon).toHaveStyle({ width: 40, height: 40 });
    const [svg] = icon.children;
    expect(typeof svg === 'string' ? svg : svg.props.color).toBe(
      colors.gray[300],
    );
    const pathsOf = (xml: string) =>
      [...xml.matchAll(/ d="([^"]+)"/g)].map(([, d]) => d);
    expect(
      icon
        .queryAll(node => typeof node.props.d === 'string')
        .map(node => node.props.d),
    ).toEqual(pathsOf(iconSvgs['tab-calendar-active'].xml));
  });

  it('빈 상태 문구는 스크린리더에 글자로 읽히고 버튼으로 읽히지 않는다', async () => {
    await renderHome({ currentWork: null, schedule: [] });

    for (const text of [
      '현재 진행 중인 작업이 없습니다',
      '이번 주 일정이 없어요',
      '새 작업이 배정되면 여기에 표시돼요',
    ]) {
      expect(screen.getByText(text)).toBeOnTheScreen();
    }
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('일정 카드는 상태와 주소까지 스크린리더에 읽힌다', async () => {
    await renderHome();

    expect(
      screen.getAllByRole('button', {
        name: '세탁기 설치, 작업전, 11:00 – 12:00 오늘 · 9. 19. (토), 한빛 설비 정다은 · 서울 용산구 이태원로 202',
      }),
    ).toHaveLength(3);
  });
});
