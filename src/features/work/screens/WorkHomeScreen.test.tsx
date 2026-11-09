import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { colors, typography } from '../../../shared/design-system';
import { iconSvgs } from '../../../shared/design-system/icons/svgs';
import { appStorage } from '../../../shared/storage/appStorage';
import { iconSvgIn } from '../../../shared/testing/icon';
import { isInsideScrollView } from '../../../shared/testing/scroll';
import { expectOnlySkeletons } from '../../../shared/testing/skeleton';
import { stylePt, type HostElement } from '../../../shared/testing/touchTarget';
import { holdNativeAnimations } from '../../../../jest/nativeAnimation';
import {
  autoHideHeader,
  autoHideHeaderOffset,
  scrollDownFromTop,
  scrollListTo,
} from '../../../shared/testing/autoHideHeader';
import { TAB_HEADER_HEIGHT } from '../../../shared/layout/TabHeader';
import { currentWork, homeToday, weeklySchedule } from '../mockData';
import type { ScheduleItem } from '../model';
import { HOME_VIEW_KEY, loadHomeView, saveHomeView } from '../homeView';
import { WorkHomeScreen, type WorkHomeScreenProps } from './WorkHomeScreen';

const renderHome = (overrides: Partial<WorkHomeScreenProps> = {}) =>
  render(
    <WorkHomeScreen
      currentWork={currentWork}
      schedule={weeklySchedule}
      today={homeToday}
      weekLabel="9. 14. – 9. 20."
      started={false}
      onStartWork={jest.fn()}
      onOpenWork={jest.fn()}
      onOpenNotifications={jest.fn()}
      {...overrides}
    />,
  );

describe('WorkHomeScreen', () => {
  // 이 묶음은 목록 보기 화면을 본다. 기본은 블록 보기라(#147) 목록 보기를 골라 둔 기기로 연다
  beforeEach(() => saveHomeView('list'));

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
    // 버튼은 상단 바의 종과 보기 전환뿐이다. 스크린리더도 블록 보기를 먼저 읽는다 (#179)
    expect(
      screen
        .queryAllByRole('button')
        .map(button => button.props.accessibilityLabel),
    ).toEqual(['알림센터', '블록 보기', '목록 보기']);
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
  // 목록 보기 프레임(3255:17530) 값을 본다. 기본은 블록 보기라(#147) 목록 보기를 골라 둔 기기로 연다
  beforeEach(() => saveHomeView('list'));

  // #95: 하단 흐림을 빼면서 남던 아래 여백(83)도 정리한다. 화면은 탭 바 위에서 끝나 마지막 카드가 가려지지 않는다
  it('본문은 좌우 24 여백이고, 목록 끝은 아래 24 여백 뒤에서 끝난다', async () => {
    await renderHome();

    // 본문 여백은 스크롤 뷰의 contentContainerStyle 로 준다
    let list = screen.getAllByRole('button', { name: /세탁기 설치/ })[0].parent;
    while (list && list.type !== 'RCTScrollView') {
      list = list.parent;
    }
    expect(StyleSheet.flatten(list?.props.contentContainerStyle)).toMatchObject(
      { paddingHorizontal: 24, paddingBottom: 24 },
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

  // #148: 상단 바는 리스트 위에 겹쳐 그리므로 내용 위 여백에 상단 바 높이를 더한다
  it('진행 중 작업 카드는 상단 바 아래 20 에서 시작한다 (Figma 제목 줄 아래 106 → 카드 126)', async () => {
    await renderHome();

    let list = screen.getAllByRole('button', { name: /세탁기 설치/ })[0].parent;
    while (list && list.type !== 'RCTScrollView') {
      list = list.parent;
    }
    expect(StyleSheet.flatten(list?.props.contentContainerStyle)).toMatchObject(
      { paddingTop: TAB_HEADER_HEIGHT + 20 },
    );
  });

  // Figma 3463:17452: 일정 줄(3463:17526)은 폭 339 로 카드(345)보다 6 좁고 오른쪽 끝은 카드와 같다
  it('일정 줄은 카드보다 6 안쪽에서 시작하고, 첫 일정 카드는 그 아래 12 에서 시작한다', async () => {
    await renderHome();

    const sectionRow = screen.getByRole('header', { name: '일정' }).parent
      ?.parent;
    expect(sectionRow).toHaveStyle({ marginLeft: 6 });
    expect(sectionRow?.parent?.parent).toHaveStyle({ paddingBottom: 12 });
  });

  it('주 표시는 Gray700 이다', async () => {
    await renderHome();

    expect(screen.getByText('9. 14. – 9. 20.')).toHaveStyle({
      color: colors.gray[700],
    });
  });

  // #95: 흐림은 작업 상세 '완료 보고 작성하기' 버튼 뒤에만 둔다 (사용자 결정)
  it('목록 아래에 흐림(그라데이션)을 깔지 않는다', async () => {
    const { container } = await renderHome();

    expect(
      screen.queryByTestId('home-bottom-fade', { includeHiddenElements: true }),
    ).not.toBeOnTheScreen();
    expect(
      container.queryAll(
        node => StyleSheet.flatten(node.props.style)?.backgroundImage != null,
      ),
    ).toHaveLength(0);
  });

  it('일정 빈 상태는 일정 줄 아래 118 에서 시작한다 (메인화면 - 일정(무) 3278:23276)', async () => {
    await renderHome({ currentWork: null, schedule: [] });

    const header = screen.getByRole('header', { name: '일정' }).parent?.parent
      ?.parent?.parent;
    const empty = screen.getByTestId('empty-schedule-icon', {
      includeHiddenElements: true,
    }).parent;
    expect(
      Number(StyleSheet.flatten(header?.props.style).paddingBottom) +
        Number(StyleSheet.flatten(empty?.props.style).paddingTop),
    ).toBe(118);
  });
});

// #94: Figma 작업 수행 › 메인화면 - 시작 가능 (3463:17452) 이 블록 보기다
describe('WorkHomeScreen 블록 보기', () => {
  // 목 데이터 기준일(오늘)은 9. 19. (토). 이번 주는 9. 14. (월) ~ 9. 20. (일)
  const item = (id: string, dateKey: string, title: string): ScheduleItem => ({
    ...weeklySchedule[0],
    id,
    dateKey,
    title,
  });
  const schedule = [
    item('a', '2026-09-15', '에어컨 설치'),
    item('b', '2026-09-19', '세탁기 설치'),
    item('c', '2026-09-19', '보일러 점검'),
  ];
  // 저장한 보기가 없으면 블록 보기로 연다 (#147)
  const renderBlock = (overrides: Partial<WorkHomeScreenProps> = {}) =>
    renderHome({ schedule, ...overrides });

  const toggle = (name: '목록 보기' | '블록 보기') =>
    screen.getByRole('button', { name });
  const day = (name: string) => screen.getByRole('button', { name });
  const days = () =>
    screen.queryAllByRole('button', { name: /^9월 \d+일 .요일$/ });
  const cardTitles = () =>
    screen
      .queryAllByRole('button', { name: /, 작업전, / })
      .map(card => card.props.accessibilityLabel.split(',')[0]);

  describe('보기 전환', () => {
    // #147: 블록 보기가 기본이다
    it('처음 설치(저장한 보기 없음)면 블록 보기다. 블록 아이콘이 선택, 목록 아이콘이 비선택이고 날짜 칸이 있다', async () => {
      await renderHome({ schedule });

      expect(toggle('블록 보기')).toBeSelected();
      expect(toggle('목록 보기')).not.toBeSelected();
      expect(days()).toHaveLength(7);
      expect(cardTitles()).toEqual(['세탁기 설치', '보일러 점검']);
    });

    // #179 사용자 결정: 기본인 블록 보기를 왼쪽, 목록 보기를 오른쪽에 둔다.
    // Figma 메인화면(3255:17608·3463:17530 등)은 아직 목록 아이콘이 왼쪽이지만 순서는 사용자 지시를 따른다.
    // 크기 26·간격 4·선택 표시(Primary 바탕 흰 그림 / Gray100 바탕 Gray700 그림)는 Figma 그대로다
    it('전환 버튼은 블록 보기, 목록 보기 순서로 놓인다 (블록 왼쪽, 목록 오른쪽)', async () => {
      await renderHome();

      expect(toggle('블록 보기').parent).toBe(toggle('목록 보기').parent);
      const row = toggle('블록 보기').parent;
      expect(row).toHaveStyle({ flexDirection: 'row' });
      expect(
        row?.children
          .filter(child => typeof child !== 'string')
          .map(child => child.props.accessibilityLabel),
      ).toEqual(['블록 보기', '목록 보기']);
    });

    it('목록 아이콘을 누르면 목록 보기가 되고, 블록 아이콘을 누르면 되돌아간다', async () => {
      await renderHome({ schedule });

      await userEvent.press(toggle('목록 보기'));
      expect(toggle('목록 보기')).toBeSelected();
      expect(toggle('블록 보기')).not.toBeSelected();
      expect(days()).toHaveLength(0);
      expect(cardTitles()).toEqual([
        '에어컨 설치',
        '세탁기 설치',
        '보일러 점검',
      ]);

      await userEvent.press(toggle('블록 보기'));
      expect(toggle('블록 보기')).toBeSelected();
      expect(toggle('목록 보기')).not.toBeSelected();
      expect(days()).toHaveLength(7);
      expect(cardTitles()).toEqual(['세탁기 설치', '보일러 점검']);
    });

    // #147: 기사마다 선호가 달라 마지막으로 고른 보기를 기기에 남긴다
    it.each([
      ['목록 보기', 'list'],
      ['블록 보기', 'block'],
    ] as const)('저장한 보기가 %s 면 그 보기로 연다', async (name, saved) => {
      saveHomeView(saved);
      await renderHome({ schedule });

      expect(toggle(name)).toBeSelected();
      expect(days()).toHaveLength(saved === 'block' ? 7 : 0);
    });

    // 다시 열 때 읽는 것은 위 '저장한 보기가 … 면 그 보기로 연다', 앱을 끄고 다시 켜는 흐름은 App.restore.test 가 본다
    it('고른 보기를 기기에 저장한다', async () => {
      await renderHome({ schedule });

      await userEvent.press(toggle('목록 보기'));
      expect(loadHomeView()).toBe('list');

      await userEvent.press(toggle('블록 보기'));
      expect(loadHomeView()).toBe('block');
    });

    it('이미 고른 보기를 다시 누르면 기기에 다시 쓰지 않는다', async () => {
      await renderHome({ schedule });
      const write = jest.spyOn(appStorage, 'set');

      await userEvent.press(toggle('블록 보기'));

      expect(write).not.toHaveBeenCalled();
      write.mockRestore();
    });

    it('저장한 값이 깨졌으면 블록 보기로 연다', async () => {
      appStorage.set(HOME_VIEW_KEY, 'grid');
      await renderHome({ schedule });

      expect(toggle('블록 보기')).toBeSelected();
      expect(days()).toHaveLength(7);
    });

    // Figma: 선택은 Primary 채움에 흰 아이콘, 비선택은 Gray100 채움에 Gray700 아이콘 (26, 모서리 6)
    it('선택한 보기 아이콘은 검정 채움, 다른 아이콘은 회색 채움이다', async () => {
      await renderHome();

      expect(iconSvgIn(toggle('목록 보기')).props.xml).toBe(iconSvgs.list.xml);
      expect(iconSvgIn(toggle('블록 보기')).props.xml).toBe(
        iconSvgs['grid-active'].xml,
      );

      await userEvent.press(toggle('목록 보기'));
      expect(iconSvgIn(toggle('목록 보기')).props.xml).toBe(
        iconSvgs['list-active'].xml,
      );
      expect(iconSvgIn(toggle('블록 보기')).props.xml).toBe(iconSvgs.grid.xml);
    });

    // 글자 크기 설정을 크게 해도 보기 전환 버튼이 화면 밖으로 밀리지 않도록 '일정'·주 표시 묶음이 줄어들고 줄바꿈된다
    it('큰 글자에서는 일정 제목 묶음이 줄어들어 보기 버튼 자리를 남긴다', async () => {
      await renderHome();

      expect(screen.getByRole('header', { name: '일정' }).parent).toHaveStyle({
        flexShrink: 1,
        flexWrap: 'wrap',
      });
    });

    it('보기 아이콘의 채움·그림 색은 Figma 값이다', () => {
      const fills = (xml: string) =>
        [...xml.matchAll(/<(?:rect|path)[^>]* fill="([^"]+)"/g)].map(
          ([, fill]) => fill,
        );
      expect(fills(iconSvgs['list-active'].xml)).toEqual([
        colors.primary,
        'white',
      ]);
      expect(fills(iconSvgs.list.xml)).toEqual([
        colors.gray[100],
        colors.gray[700],
      ]);
      expect(fills(iconSvgs['grid-active'].xml)).toEqual([
        colors.primary,
        'white',
      ]);
      expect(fills(iconSvgs.grid.xml)).toEqual([
        colors.gray[100],
        colors.gray[700],
      ]);
    });
  });

  describe('이번 주 날짜 칸', () => {
    it('월~일 7칸을 "9월 15일 화요일" 처럼 읽고, 처음 선택은 오늘이다', async () => {
      await renderBlock();

      expect(days().map(cell => cell.props.accessibilityLabel)).toEqual([
        '9월 14일 월요일',
        '9월 15일 화요일',
        '9월 16일 수요일',
        '9월 17일 목요일',
        '9월 18일 금요일',
        '9월 19일 토요일',
        '9월 20일 일요일',
      ]);
      expect(
        days().filter(cell => cell.props.accessibilityState?.selected),
      ).toHaveLength(1);
      expect(day('9월 19일 토요일')).toBeSelected();
    });

    it('오늘의 일정만 보여 준다', async () => {
      await renderBlock();

      expect(cardTitles()).toEqual(['세탁기 설치', '보일러 점검']);
    });

    it('날짜 칸을 누르면 그 날짜만 선택되고, 아래 카드는 그 날의 일정만 보여 준다', async () => {
      await renderBlock();

      await userEvent.press(day('9월 15일 화요일'));

      expect(day('9월 15일 화요일')).toBeSelected();
      expect(day('9월 19일 토요일')).not.toBeSelected();
      expect(
        days().filter(cell => cell.props.accessibilityState?.selected),
      ).toHaveLength(1);
      expect(cardTitles()).toEqual(['에어컨 설치']);
    });

    it('고른 날에 일정이 없으면 일정(무) 모양으로 빈 상태를 보여 준다', async () => {
      await renderBlock();

      await userEvent.press(day('9월 16일 수요일'));

      expect(cardTitles()).toEqual([]);
      expect(screen.getByText('이 날은 일정이 없어요')).toHaveStyle({
        fontSize: 20,
        color: colors.primary,
        textAlign: 'center',
      });
      expect(
        screen.getByText('새 작업이 배정되면 여기에 표시돼요'),
      ).toHaveStyle({ color: colors.gray[600] });
      expect(
        screen.getByTestId('empty-schedule-icon', {
          includeHiddenElements: true,
        }),
      ).toHaveStyle({ width: 40, height: 40 });
    });

    it('일정 카드를 누르면 그 작업의 상세를 연다', async () => {
      const onOpenWork = jest.fn();
      await renderBlock({ onOpenWork });

      await userEvent.press(
        screen.getAllByRole('button', { name: /^보일러 점검, / })[0],
      );

      expect(onOpenWork).toHaveBeenCalledWith('c');
    });
  });

  describe('Figma 값', () => {
    const textOf = (cell: HostElement, index: number) =>
      within(cell).getAllByText(/.+/, { includeHiddenElements: true })[index];

    // Calendar Contents 45×69 (화면 폭에 맞춰 7칸이 나눠 갖는다), 모서리 10, 칸 사이 5
    it('칸은 높이 69·모서리 10, 비선택 흰색·선택 Primary 이고 칸 사이 5 다', async () => {
      await renderBlock();

      const selected = day('9월 19일 토요일');
      const other = day('9월 15일 화요일');
      expect(selected).toHaveStyle({
        minHeight: 69,
        borderRadius: 10,
        backgroundColor: colors.primary,
      });
      expect(other).toHaveStyle({
        minHeight: 69,
        borderRadius: 10,
        backgroundColor: colors.white[100],
      });
      expect(other.parent).toHaveStyle({ flexDirection: 'row', gap: 5 });
    });

    it('날짜는 Body/XS/Medium, 요일은 Caption/M/Medium 60% 이고, 선택한 날은 Body/XS/SemiBold 흰 글자다', async () => {
      await renderBlock();

      const tue = day('9월 15일 화요일');
      expect(textOf(tue, 0)).toHaveStyle({
        ...typography['Body/XS/Medium'],
        color: colors.gray[900],
      });
      expect(textOf(tue, 1)).toHaveStyle({
        ...typography['Caption/M/Medium'],
        color: colors.gray[900],
        opacity: 0.6,
      });
      const sat = day('9월 19일 토요일');
      expect(textOf(sat, 0)).toHaveStyle({
        ...typography['Body/XS/SemiBold'],
        color: colors.white[100],
      });
      expect(textOf(sat, 1)).toHaveStyle({
        color: colors.white[100],
        opacity: 0.6,
      });
    });

    // 패널 값: 토(19) 날짜·요일 Warning/1, 일(20) Accents/Blue. 내 일정(일 빨강·토 파랑)과 자리가 반대지만 화면별 Figma 값을 따른다
    it('토요일 칸은 Warning/1, 일요일 칸은 Accents/Blue 글자다', async () => {
      await renderBlock();
      await userEvent.press(day('9월 15일 화요일'));

      for (const [name, color] of [
        ['9월 19일 토요일', colors.warning[1]],
        ['9월 20일 일요일', colors.accents.blue],
      ]) {
        expect(textOf(day(name), 0)).toHaveStyle({ color });
        expect(textOf(day(name), 1)).toHaveStyle({ color });
      }
    });

    // 일정 줄 아래 12 에 날짜 줄(3463:18538), 그 아래 14 에 첫 카드(3463:18565)
    it('날짜 줄은 일정 줄 아래 12, 첫 일정 카드는 날짜 줄 아래 14 에서 시작한다', async () => {
      await renderBlock();

      const row = day('9월 15일 화요일').parent as HostElement;
      const schedulePart = row.parent as HostElement;
      expect(schedulePart).toHaveStyle({ gap: 12 });
      expect(stylePt(schedulePart.parent as HostElement, 'paddingBottom')).toBe(
        14,
      );
    });

    it('보기 아이콘은 26 크기 두 개가 4 간격으로 놓인다', async () => {
      await renderHome();

      const list = toggle('목록 보기');
      expect(list.children[0]).toHaveStyle({ width: 26, height: 26 });
      expect(list.parent).toHaveStyle({ flexDirection: 'row', gap: 4 });
    });
  });
});

describe('WorkHomeScreen — 불러오기', () => {
  // 홈은 마지막으로 고른 보기로 열린다 (#147). 스켈레톤도 그 보기를 닮는다
  it('블록 보기로 여는 기사(처음 설치 포함)는 스켈레톤에도 날짜 칸 일곱 자리가 있다', async () => {
    await renderHome({
      currentWork: null,
      schedule: [],
      load: { status: 'loading' },
    });

    expect(screen.getAllByTestId('week-day-skeleton')).toHaveLength(7);
  });

  it('목록 보기로 여는 기사는 스켈레톤에 날짜 칸 자리가 없다', async () => {
    saveHomeView('list');
    await renderHome({
      currentWork: null,
      schedule: [],
      load: { status: 'loading' },
    });

    expect(screen.getByTestId('work-home-skeleton')).toBeOnTheScreen();
    expect(screen.queryAllByTestId('week-day-skeleton')).toHaveLength(0);
  });

  it('불러오는 동안 제목 아래에 스켈레톤만 보인다 (진행할 작업 없음 카드·빈 일정 대신)', async () => {
    await renderHome({
      currentWork: null,
      schedule: [],
      load: { status: 'loading' },
    });

    expect(screen.getByRole('header', { name: '내 작업' })).toBeOnTheScreen();
    // 진행할 작업 카드·일정 카드를 닮은 스켈레톤이고 스피너는 없다 (#139)
    expectOnlySkeletons('work-home-skeleton');
    expect(screen.getByTestId('work-home-skeleton-current')).toBeOnTheScreen();
    expect(
      screen.queryByText('현재 진행 중인 작업이 없습니다'),
    ).not.toBeOnTheScreen();
    // 기본인 블록 보기의 빈 상태 문구와 목록 보기의 빈 상태 문구 둘 다 없다
    expect(screen.queryByText('이 날은 일정이 없어요')).not.toBeOnTheScreen();
    expect(screen.queryByText('이번 주 일정이 없어요')).not.toBeOnTheScreen();
  });

  it('불러오지 못하면 문구와 다시 시도를 보인다', async () => {
    const onRetry = jest.fn();
    await renderHome({
      currentWork: null,
      schedule: [],
      load: { status: 'error', message: '네트워크 문구', onRetry },
    });

    expect(screen.getByText('네트워크 문구')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('당겨서 새로고침한다', async () => {
    const onRefresh = jest.fn();
    await renderHome({ onRefresh, refreshing: true });
    const list = screen.getByTestId('work-home-list');

    expect(list.props.refreshing).toBe(true);
    await fireEvent(list, 'refresh');

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('작업을 시작하는 동안 "작업 시작" 이 잠기고, 다시 눌러도 한 번만 보낸다', async () => {
    let finish: () => void = () => {};
    const onStartWork = jest.fn(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    await renderHome({ onStartWork });
    const start = () => screen.getByRole('button', { name: '작업 시작' });

    await userEvent.press(start());
    await userEvent.press(start());

    expect(onStartWork).toHaveBeenCalledTimes(1);
    expect(start()).toBeDisabled();

    await act(async () => finish());
    expect(start()).toBeEnabled();
  });
});

// #148: 아래로 스크롤하면 상단 바가 숨고, 위로 스크롤을 시작하면 다시 보인다 (공용 AutoHideHeaderLayout)
describe('WorkHomeScreen — 상단 바 자동 숨김', () => {
  let finishAnimations: () => Promise<void>;
  beforeEach(() => {
    finishAnimations = holdNativeAnimations().finish;
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('제목과 종은 리스트 위에 겹쳐 그린 머리 안에 있다', async () => {
    await renderHome();

    expect(
      within(autoHideHeader()).getByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
    expect(
      within(autoHideHeader()).getByRole('button', { name: '알림센터' }),
    ).toBeOnTheScreen();
  });

  it('아래로 스크롤하면 상단 바가 숨고, 위로 스크롤을 시작하면 다시 보인다', async () => {
    await renderHome();
    const list = screen.getByTestId('work-home-list');

    await scrollDownFromTop(list);
    await finishAnimations();
    expect(autoHideHeaderOffset()).toBe(-TAB_HEADER_HEIGHT);

    await scrollListTo(list, 280);
    await finishAnimations();
    expect(autoHideHeaderOffset()).toBe(0);
  });

  // 불러오기를 마쳐 리스트로 바뀌어도 상단 바를 새로 그리지 않는다 (스크린리더 포커스·찾아 둔 요소가 그대로다)
  it('불러오는 동안에도 같은 머리에 상단 바를 두고 스켈레톤은 그 아래에 있으며, 다 불러와도 상단 바는 그대로다', async () => {
    const view = await renderHome({
      currentWork: null,
      schedule: [],
      load: { status: 'loading' },
    });
    const title = screen.getByRole('header', { name: '내 작업' });
    expect(within(autoHideHeader()).getByRole('header')).toBe(title);
    // 불러오는 중으로 읽히는 것은 스켈레톤이고(#139), 그 바로 바깥 자리가 상단 바 높이만큼 내려온다
    expect(screen.getByLabelText('불러오는 중').parent).toHaveStyle({
      paddingTop: TAB_HEADER_HEIGHT,
    });

    await view.rerender(
      <WorkHomeScreen
        currentWork={currentWork}
        schedule={weeklySchedule}
        today={homeToday}
        weekLabel="9. 14. – 9. 20."
        started={false}
        onStartWork={jest.fn()}
        onOpenWork={jest.fn()}
        onOpenNotifications={jest.fn()}
      />,
    );

    expect(screen.getByTestId('work-home-list')).toBeOnTheScreen();
    expect(title).toBeOnTheScreen();
  });

  // 상단 바는 당겨도 맨 위에 붙어 있으므로(#178) 두 플랫폼 모두 표시를 상단 바 아래로 내린다
  it.each(['ios', 'android'] as const)(
    '당겨서 새로고침 표시는 상단 바 아래에서 나온다 (%s)',
    async os => {
      jest.replaceProperty(Platform, 'OS', os);
      await renderHome({ onRefresh: jest.fn() });
      expect(screen.getByTestId('work-home-list')).toHaveProp(
        'progressViewOffset',
        TAB_HEADER_HEIGHT,
      );
    },
  );

  // 숨은 채 리스트가 로딩·오류 화면으로 바뀌면 스크롤이 없어 다시 보일 길이 없다. 그 자리가 그려지면 다시 보인다
  it('상단 바가 숨은 채 불러오기 화면으로 바뀌면 다시 보인다', async () => {
    const view = await renderHome();
    await scrollDownFromTop(screen.getByTestId('work-home-list'));
    await finishAnimations();
    expect(autoHideHeaderOffset()).toBe(-TAB_HEADER_HEIGHT);

    await view.rerender(
      <WorkHomeScreen
        currentWork={null}
        schedule={[]}
        today={homeToday}
        weekLabel="9. 14. – 9. 20."
        started={false}
        onStartWork={jest.fn()}
        onOpenWork={jest.fn()}
        onOpenNotifications={jest.fn()}
        load={{ status: 'loading' }}
      />,
    );
    await fireEvent(
      screen.getByLabelText('불러오는 중').parent as HostElement,
      'layout',
      { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 600 } } },
    );
    await finishAnimations();

    expect(autoHideHeaderOffset()).toBe(0);
  });
});

// 켜 둔 채 날짜가 바뀌면 블록 보기에서 오늘을 고르고 있던 선택은 새 오늘로 옮긴다 (#114 리뷰)
describe('WorkHomeScreen — 날짜가 바뀌면', () => {
  const props = {
    currentWork,
    schedule: weeklySchedule,
    weekLabel: '9. 14. – 9. 20.',
    started: false,
    onStartWork: jest.fn(),
    onOpenWork: jest.fn(),
    onOpenNotifications: jest.fn(),
  };

  it('블록 보기에서 오늘을 고르고 있었으면 새 오늘을 고른다', async () => {
    const { rerender } = await render(
      <WorkHomeScreen {...props} today={new Date(2026, 8, 19)} />,
    );
    expect(screen.getByRole('button', { name: '블록 보기' })).toBeSelected();

    await rerender(<WorkHomeScreen {...props} today={new Date(2026, 8, 20)} />);

    expect(screen.getByRole('button', { name: /^9월 20일 / })).toBeSelected();
  });
});
