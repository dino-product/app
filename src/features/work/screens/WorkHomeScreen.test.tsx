import { render, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from '../../../shared/design-system';
import { iconSvgs } from '../../../shared/design-system/icons/svgs';
import { isInsideScrollView } from '../../../shared/testing/scroll';
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
      onOpenNotifications={jest.fn()}
      {...overrides}
    />,
  );

describe('WorkHomeScreen', () => {
  // #96: Figma 메인화면에는 늘 종이 있고, 알림센터로 가는 버튼이다
  it('종은 알림센터 버튼이고 누르면 알림센터를 연다', async () => {
    const onOpenNotifications = jest.fn();
    await renderHome({ onOpenNotifications });

    await userEvent.press(screen.getByRole('button', { name: '알림센터' }));

    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
  });

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
    const titles = weeklySchedule.map(item => item.title);
    const [top, ...rest] = screen.getAllByText(
      new RegExp(
        `^(현재 진행 중인 작업이 없습니다|일정|${[...new Set(titles)].join(
          '|',
        )})$`,
      ),
    );
    expect(top).toHaveTextContent('현재 진행 중인 작업이 없습니다');
    expect(rest.map(node => node.props.children)).toEqual(['일정', ...titles]);
    expect(screen.queryByText('이번 주 일정이 없어요')).not.toBeOnTheScreen();
  });

  it('진행할 작업은 있고 이번 주 일정만 없으면 작업 카드 아래에 일정 빈 상태를 보여 준다', async () => {
    await renderHome({ schedule: [] });

    expect(screen.getByRole('button', { name: '작업 시작' })).toBeOnTheScreen();
    expect(screen.getByText('이번 주 일정이 없어요')).toBeOnTheScreen();
  });

  it('이번 주 일정이 없으면 일정 자리에 회색 달력 아이콘과 안내 문구를 보여 준다', async () => {
    await renderHome({ currentWork: null, schedule: [] });

    expect(screen.getByText('이번 주 일정이 없어요')).toHaveStyle({
      fontSize: 20,
      color: colors.primary,
      textAlign: 'center',
    });
    expect(screen.getByText('새 작업이 배정되면 여기에 표시돼요')).toHaveStyle({
      fontSize: 14,
      color: colors.gray[600],
      textAlign: 'center',
    });
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
    // 버튼은 상단 바의 종뿐이다
    expect(
      screen
        .queryAllByRole('button')
        .map(button => button.props.accessibilityLabel),
    ).toEqual(['알림센터']);
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

describe('WorkHomeScreen Figma 배치 (메인화면 - 시작 가능 3255:17530)', () => {
  it('본문은 좌우 24 여백이고, 목록 끝은 아래 흐림(83) 위에서 끝난다', async () => {
    await renderHome();

    // 본문 여백은 스크롤 뷰의 contentContainerStyle 로 준다
    let list = screen.getAllByRole('button', { name: /세탁기 설치/ })[0].parent;
    while (list && list.type !== 'RCTScrollView') {
      list = list.parent;
    }
    expect(StyleSheet.flatten(list?.props.contentContainerStyle)).toMatchObject(
      { paddingHorizontal: 24, paddingBottom: 83 },
    );
  });

  // #103: 탭 첫 화면 공통 상단 바. Figma 3463:17455 는 카드와 같은 좌우 24 에서 시작한다
  it('제목 줄(상단 바)은 스크롤 뷰 밖에 고정되고, 상태 표시줄 아래 12·좌우 24 에서 시작한다', async () => {
    await renderHome({ onOpenNotifications: jest.fn() });

    const title = screen.getByRole('header', { name: '내 작업' });
    expect(isInsideScrollView(title)).toBe(false);
    expect(
      isInsideScrollView(screen.getByRole('button', { name: '알림센터' })),
    ).toBe(false);
    expect(title.parent?.parent).toHaveStyle({
      paddingTop: 12,
      paddingHorizontal: 24,
    });
  });

  it('진행 중 작업 카드는 상단 바 아래 20 에서 시작한다 (Figma 제목 줄 아래 106 → 카드 126)', async () => {
    await renderHome();

    let list = screen.getAllByRole('button', { name: /세탁기 설치/ })[0].parent;
    while (list && list.type !== 'RCTScrollView') {
      list = list.parent;
    }
    expect(StyleSheet.flatten(list?.props.contentContainerStyle)).toMatchObject(
      { paddingTop: 20 },
    );
  });

  it('일정 줄은 카드보다 6.84 안쪽에서 시작하고, 첫 일정 카드는 그 아래 12 에서 시작한다', async () => {
    await renderHome();

    const sectionRow = screen.getByRole('header', { name: '일정' }).parent
      ?.parent;
    expect(sectionRow).toHaveStyle({ marginLeft: 6.84 });
    expect(sectionRow?.parent).toHaveStyle({ paddingBottom: 12 });
  });

  it('주 표시는 Gray700 이다', async () => {
    await renderHome();

    expect(screen.getByText('9. 14. – 9. 20.')).toHaveStyle({
      color: colors.gray[700],
    });
  });

  it('탭 바 위 83pt 에서 목록이 배경색으로 흐려지고, 터치는 그대로 아래로 간다', async () => {
    await renderHome();

    const fade = screen.getByTestId('home-bottom-fade', {
      includeHiddenElements: true,
    });
    expect(fade).toHaveStyle({
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 83,
      pointerEvents: 'none',
      backgroundImage:
        'linear-gradient(to bottom, rgba(245, 246, 248, 0) 20%, rgba(245, 246, 248, 0.65) 100%)',
    });
    // 스크린리더에서는 숨는다 (기본 쿼리는 숨은 요소를 찾지 않는다)
    expect(screen.queryByTestId('home-bottom-fade')).not.toBeOnTheScreen();
  });

  it('일정이 없으면 흐림을 깔지 않는다 (작은 화면에서 빈 상태 안내가 흐려지지 않게)', async () => {
    await renderHome({ schedule: [] });

    expect(
      screen.queryByTestId('home-bottom-fade', { includeHiddenElements: true }),
    ).not.toBeOnTheScreen();
  });

  it('일정 빈 상태는 일정 줄 아래 118 에서 시작한다 (메인화면 - 일정(무) 3278:23276)', async () => {
    await renderHome({ currentWork: null, schedule: [] });

    const header = screen.getByRole('header', { name: '일정' }).parent?.parent
      ?.parent;
    const empty = screen.getByTestId('empty-schedule-icon', {
      includeHiddenElements: true,
    }).parent;
    expect(
      Number(StyleSheet.flatten(header?.props.style).paddingBottom) +
        Number(StyleSheet.flatten(empty?.props.style).paddingTop),
    ).toBe(118);
  });
});
