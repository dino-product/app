import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import { swipeFrom } from '../../../../jest/responder';
import {
  colors,
  pressedBackground,
  typography,
} from '../../../shared/design-system';
import { ENTER_OFFSET } from '../../../shared/gesture/enterTransition';
import { SWITCH_DISTANCE } from '../../../shared/gesture/tabSwipe';
import { expectPressedBackground } from '../../../shared/testing/pressFeedback';
import { iconSvgs } from '../../../shared/design-system/icons/svgs';
import { TAB_HEADER_HEIGHT } from '../../../shared/layout/TabHeader';
import { holdNativeAnimations } from '../../../../jest/nativeAnimation';
import {
  autoHideHeader,
  autoHideHeaderOffset,
  scrollDownFromTop,
  scrollListTo,
} from '../../../shared/testing/autoHideHeader';
import { isInsideScrollView } from '../../../shared/testing/scroll';
import type { HostElement } from '../../../shared/testing/touchTarget';
import type { CompletedWork } from '../model';
import {
  WorkHistoryScreen,
  type WorkHistoryScreenProps,
} from './WorkHistoryScreen';

const today = new Date(2026, 8, 28); // 월요일

const base = {
  start: '08:00',
  end: '09:00',
  company: '한빛 설비',
  customerName: '정다은',
  address: '서울 용산구 이태원로 202',
};

const works: CompletedWork[] = [
  { ...base, id: 's1', dateKey: '2026-09-26', title: '세탁기 설치' },
  {
    ...base,
    id: 's2',
    dateKey: '2026-09-26',
    title: '에어컨 청소',
    start: '13:00',
    end: '14:00',
  },
  { ...base, id: 's3', dateKey: '2026-09-03', title: '보일러 점검' },
  { ...base, id: 'a1', dateKey: '2026-08-20', title: '도어록 교체' },
];

const renderHistory = (overrides: Partial<WorkHistoryScreenProps> = {}) =>
  render(
    <WorkHistoryScreen
      today={today}
      works={works}
      onOpenWork={jest.fn()}
      {...overrides}
    />,
  );

const rows = () => screen.getAllByRole('button', { name: /, 완료, / });
const rowTitles = () =>
  rows().map(row => row.props.accessibilityLabel.split(',')[0]);
const prevMonth = () => screen.getByRole('button', { name: '이전 달' });
const FAR = SWITCH_DISTANCE + 30;
/** 목록 영역(행)에서 시작해 민다. 탭 영역 밖이라 시작 자리와 상관없이 목록이 갖는다 */
const swipeRows = (
  options: Omit<Parameters<typeof swipeFrom>[1], 'from'>,
  element: HostElement = rows()[0],
) => swipeFrom(element, { from: { x: 200, y: 500 }, ...options });

/** 목록 영역을 밀어 달을 옮기는 뷰 (리스트를 감싼다) */
function monthSwipeArea(): HostElement {
  for (
    let node: HostElement | null = screen.getByTestId('work-history-list');
    node;
    node = node.parent
  ) {
    if (node.props.onTouchStartCapture && node.props.onMoveShouldSetResponder) {
      return node;
    }
  }
  throw new Error('목록 영역을 찾지 못했다');
}

/** 요소를 품은 목록 칸이 옮겨진 거리. 리스트에 닿기 전까지 transform 을 찾는다 */
function shiftOf(element: HostElement) {
  for (let node: HostElement | null = element; node; node = node.parent) {
    if (node.props.testID === 'work-history-list') {
      return { translateX: 0, opacity: undefined };
    }
    const style = StyleSheet.flatten(node.props.style);
    if (style && 'transform' in style && style.transform) {
      const [{ translateX }] = style.transform as [{ translateX: number }];
      return { translateX, opacity: style.opacity };
    }
  }
  return { translateX: 0, opacity: undefined };
}
const nextMonth = () => screen.getByRole('button', { name: '다음 달' });

describe('WorkHistoryScreen — 화면 구성', () => {
  it('제목, 오늘이 속한 달, 요약 카드(이번 달·누적 완료)를 보여준다', async () => {
    await renderHistory();

    expect(screen.getByRole('header', { name: '작업 이력' })).toBeOnTheScreen();
    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();
    expect(screen.getByText('4건')).toBeOnTheScreen();
    expect(screen.getByText('누적 완료')).toBeOnTheScreen();
    expect(screen.getByText('3건')).toBeOnTheScreen();
    expect(screen.getByText('이번 달 완료')).toBeOnTheScreen();
  });

  it('고른 달의 완료 작업을 최근 순으로 보여준다', async () => {
    await renderHistory();

    expect(rowTitles()).toEqual(['에어컨 청소', '세탁기 설치', '보일러 점검']);
  });

  it('행에 제목, 완료 칩, 날짜·시간, 발주사 | 고객 · 주소가 보인다', async () => {
    await renderHistory({ works: [works[0]] });

    expect(screen.getByText('세탁기 설치')).toBeOnTheScreen();
    expect(screen.getByText('완료')).toBeOnTheScreen();
    expect(screen.getByText('2026.09.26 (토) 08:00 - 09:00')).toBeOnTheScreen();
    expect(screen.getByText('한빛 설비')).toBeOnTheScreen();
    expect(
      screen.getByText('정다은 · 서울 용산구 이태원로 202'),
    ).toBeOnTheScreen();
  });
});

// #103: 탭 첫 화면 공통 상단 바 (Figma 3463:17455 규격). Figma 작업이력 (기본) 2751:6982 에는 종이 없다
describe('WorkHistoryScreen — 상단 바', () => {
  it('제목은 스크롤 뷰 밖에 고정되고, 상태 표시줄 아래 12·좌우 24 에서 시작하며 종이 없다', async () => {
    await renderHistory();

    const title = screen.getByRole('header', { name: '작업 이력' });
    expect(isInsideScrollView(title)).toBe(false);
    expect(title).toHaveStyle({
      ...typography['Body/XL/SemiBold'],
      color: colors.black,
    });
    expect(title.parent?.parent).toHaveStyle({
      paddingTop: 12,
      paddingHorizontal: 24,
    });
    expect(screen.queryByRole('button', { name: '알림센터' })).toBeNull();
  });
});

// #148: 아래로 스크롤하면 상단 바가 숨고, 위로 스크롤을 시작하면 다시 보인다 (공용 AutoHideHeaderLayout)
describe('WorkHistoryScreen — 상단 바 자동 숨김', () => {
  let finishAnimations: () => Promise<void>;
  beforeEach(() => {
    finishAnimations = holdNativeAnimations().finish;
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  const list = () => screen.getByTestId('work-history-list');

  it('제목은 리스트 위에 겹쳐 그린 머리 안에 있고, 내용(월 선택)은 상단 바 아래에서 시작한다', async () => {
    await renderHistory();

    expect(
      within(autoHideHeader()).getByRole('header', { name: '작업 이력' }),
    ).toBeOnTheScreen();
    expect(
      StyleSheet.flatten(list().props.contentContainerStyle),
    ).toMatchObject({ paddingTop: TAB_HEADER_HEIGHT });
  });

  it('아래로 스크롤하면 상단 바가 숨고, 위로 스크롤을 시작하면 다시 보인다', async () => {
    await renderHistory();

    await scrollDownFromTop(list());
    await finishAnimations();
    expect(autoHideHeaderOffset()).toBe(-TAB_HEADER_HEIGHT);

    await scrollListTo(list(), 280);
    await finishAnimations();
    expect(autoHideHeaderOffset()).toBe(0);
  });

  it('당겨서 새로고침 표시는 Android 에서 상단 바 아래에서 나오고, iOS 에서는 옮기지 않는다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const view = await renderHistory({ onRefresh: jest.fn() });
    expect(list()).toHaveProp('progressViewOffset', TAB_HEADER_HEIGHT);
    await view.unmount();

    jest.replaceProperty(Platform, 'OS', 'ios');
    await renderHistory({ onRefresh: jest.fn() });
    expect(list().props.progressViewOffset).toBeUndefined();
  });
});

describe('WorkHistoryScreen — 월 이동', () => {
  it('◀ 를 누르면 이전 달로 바뀌고 목록과 이번 달 완료 숫자가 그 달 기준이 된다', async () => {
    await renderHistory();

    await userEvent.press(prevMonth());

    expect(screen.getByText('2026년 8월')).toBeOnTheScreen();
    expect(rowTitles()).toEqual(['도어록 교체']);
    expect(screen.getByLabelText('이번 달 완료 1건')).toBeOnTheScreen();
    // 누적은 달과 상관없다
    expect(screen.getByLabelText('누적 완료 4건')).toBeOnTheScreen();
  });

  it('이번 달에서는 ▶ 가 비활성이고, 지난달에서는 ▶ 로 다음 달에 간다', async () => {
    await renderHistory();
    expect(nextMonth()).toBeDisabled();

    await userEvent.press(prevMonth());
    expect(nextMonth()).toBeEnabled();

    await userEvent.press(nextMonth());
    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();
    expect(nextMonth()).toBeDisabled();
  });

  it('12월에서 ▶ 를 누르면 다음 해 1월이 된다', async () => {
    await renderHistory({
      today: new Date(2027, 0, 10),
      works: [
        { ...base, id: 'd1', dateKey: '2026-12-31', title: '수전 교체' },
        { ...base, id: 'j1', dateKey: '2027-01-02', title: '에어컨 청소' },
      ],
    });

    await userEvent.press(prevMonth());
    expect(screen.getByText('2026년 12월')).toBeOnTheScreen();
    expect(rowTitles()).toEqual(['수전 교체']);

    await userEvent.press(nextMonth());
    expect(screen.getByText('2027년 1월')).toBeOnTheScreen();
    expect(rowTitles()).toEqual(['에어컨 청소']);
  });

  it('고른 달에 완료 작업이 없으면 빈 상태를 보여준다', async () => {
    await renderHistory();
    expect(
      screen.queryByText('이 달에 완료한 작업이 없어요'),
    ).not.toBeOnTheScreen();

    await userEvent.press(prevMonth());
    await userEvent.press(prevMonth());

    expect(screen.getByText('2026년 7월')).toBeOnTheScreen();
    expect(screen.getByText('이 달에 완료한 작업이 없어요')).toBeOnTheScreen();
    expect(screen.getByLabelText('이번 달 완료 0건')).toBeOnTheScreen();
  });

  it('빈 상태 아이콘은 화살표 없는 채운 시계(Gray300, 40)다', async () => {
    await renderHistory({ works: [] });

    const icon = screen.getByTestId('history-empty-icon', {
      includeHiddenElements: true,
    });
    expect(icon).toHaveStyle({ width: 40, height: 40 });
    const [svg] = icon.children;
    if (typeof svg === 'string') {
      throw new Error('SVG 뷰가 없습니다');
    }
    expect(svg.props.xml).toBe(iconSvgs['history-empty'].xml);
    expect(svg.props.xml).not.toContain('M5 2.667V6.167H8.5');
    expect(svg.props.color).toBe(colors.gray[300]);
  });
});

describe('WorkHistoryScreen — 좌우로 밀어 월 이동 (#153)', () => {
  it('목록을 오른쪽으로 밀면 이전 달, 왼쪽으로 밀면 다음 달로 간다', async () => {
    const onMonthChange = jest.fn();
    await renderHistory({ onMonthChange });

    await swipeRows({ dx: FAR });
    expect(screen.getByText('2026년 8월')).toBeOnTheScreen();
    expect(rowTitles()).toEqual(['도어록 교체']);

    await swipeRows({ dx: -FAR });
    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();
    expect(onMonthChange.mock.calls).toEqual([
      [{ year: 2026, month: 7 }],
      [{ year: 2026, month: 8 }],
    ]);
  });

  it('이번 달에서 왼쪽으로 밀면 그대로다 (▶ 처럼 미래 달로 가지 않는다)', async () => {
    const onMonthChange = jest.fn();
    await renderHistory({ onMonthChange });

    await swipeRows({ dx: -FAR });

    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();
    expect(onMonthChange).not.toHaveBeenCalled();
  });

  it('완료 작업이 없는 달도 목록 자리(빈 상태)를 밀어 옮긴다', async () => {
    await renderHistory();
    await swipeRows({ dx: FAR });
    await swipeRows({ dx: FAR });
    const empty = screen.getByText('이 달에 완료한 작업이 없어요');
    expect(screen.getByText('2026년 7월')).toBeOnTheScreen();

    await swipeRows({ dx: -FAR }, empty);

    expect(screen.getByText('2026년 8월')).toBeOnTheScreen();
  });

  it('세로 우세로 움직이면(목록 스크롤) 달은 그대로다', async () => {
    await renderHistory();

    // 목록 영역(월 넘김)이 응답자를 잡지 않아 리스트가 그대로 스크롤한다
    const monthArea = monthSwipeArea();
    expect(await swipeRows({ dx: FAR, dy: 160 })).not.toBe(monthArea.props);
    await swipeRows({
      path: [
        { x: 0, y: 0 },
        { x: 0, y: 30 },
        { x: FAR, y: 40 },
      ],
    });

    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();
  });

  it('짧게 밀거나 두 손가락이면 아무 일도 없다', async () => {
    const onOpenWork = jest.fn();
    await renderHistory({ onOpenWork });

    await swipeRows({ dx: SWITCH_DISTANCE - 10 });
    // 가로로 정해진 짧은 밀기는 목록이 응답자를 잡아 행 누르기가 되지 않는다
    expect(onOpenWork).not.toHaveBeenCalled();
    await swipeRows({ dx: FAR, fingers: 2 });

    expect(screen.getByText('2026년 9월')).toBeOnTheScreen();
  });

  it('그 달을 불러오는 중에도 목록 자리를 밀어 옮긴다', async () => {
    const onMonthChange = jest.fn();
    await renderHistory({ load: { status: 'loading' }, onMonthChange });

    await swipeRows({ dx: FAR }, screen.getByTestId('work-history-list'));

    expect(onMonthChange).toHaveBeenCalledWith({ year: 2026, month: 7 });
  });

  it('밀면 행이 눌리지 않고, 행을 누르면 지금처럼 그 작업 상세를 연다', async () => {
    const onOpenWork = jest.fn();
    await renderHistory({ onOpenWork });

    await swipeRows({ dx: FAR });
    expect(onOpenWork).not.toHaveBeenCalled();

    await userEvent.press(rows()[0]);
    expect(onOpenWork).toHaveBeenCalledWith('a1');
  });
});

describe('WorkHistoryScreen — 월 전환 애니메이션 (#153)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    // 공유 목이라 restoreAllMocks 로 돌아가지 않는다. 다른 테스트로 새지 않게 꺼진 것으로 되돌린다
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockImplementation(() => Promise.resolve(false));
  });

  it('이전 달은 -x 에서, 다음 달은 +x 에서 0 으로 들어오고 투명도는 그대로다 (밀기·화살표 모두)', async () => {
    await renderHistory();
    const animations = holdNativeAnimations();

    await swipeRows({ dx: FAR });
    expect(shiftOf(rows()[0])).toEqual({
      translateX: -ENTER_OFFSET,
      opacity: undefined,
    });
    await animations.finish();
    expect(shiftOf(rows()[0]).translateX).toBe(0);

    await userEvent.press(nextMonth());
    expect(shiftOf(rows()[0]).translateX).toBe(ENTER_OFFSET);
    await animations.finish();
    expect(shiftOf(rows()[0]).translateX).toBe(0);

    // 빈 상태도 같은 결로 들어온다
    await userEvent.press(prevMonth());
    await animations.finish();
    await userEvent.press(prevMonth());
    expect(
      shiftOf(screen.getByText('이 달에 완료한 작업이 없어요')).translateX,
    ).toBe(-ENTER_OFFSET);
  });

  it('머리(월 선택·요약 카드)는 달을 바꿔도 옮기지 않는다', async () => {
    await renderHistory();
    holdNativeAnimations();

    await swipeRows({ dx: FAR });

    expect(shiftOf(screen.getByLabelText('누적 완료 4건')).translateX).toBe(0);
    expect(shiftOf(screen.getByText('2026년 8월')).translateX).toBe(0);
  });

  it('동작 줄이기면 옮기지 않고 바로 바꾼다', async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(true);
    await renderHistory();
    await act(async () => {});
    holdNativeAnimations();

    await swipeRows({ dx: FAR });

    expect(screen.getByText('2026년 8월')).toBeOnTheScreen();
    expect(shiftOf(rows()[0]).translateX).toBe(0);
  });
});

describe('WorkHistoryScreen — 상세 열기', () => {
  it('행을 누르면 그 작업 id 로 onOpenWork 를 부른다', async () => {
    const onOpenWork = jest.fn();
    await renderHistory({ onOpenWork });

    await userEvent.press(rows()[1]);

    expect(onOpenWork).toHaveBeenCalledWith('s1');
  });
});

// #102: 누르는 동안 회색 배경
describe('WorkHistoryScreen — 눌림', () => {
  it('완료 작업 행을 누르고 있는 동안 배경이 Gray50 이 되고 떼면 돌아온다', async () => {
    await renderHistory();

    await expectPressedBackground(rows()[0], pressedBackground.onWhite);
  });
});

describe('WorkHistoryScreen — 스크린리더', () => {
  it('행은 버튼 하나로 제목, 완료, 날짜·시간, 발주사, 고객, 주소를 읽는다', async () => {
    await renderHistory({ works: [works[0]] });

    expect(
      screen.getByRole('button', {
        name: '세탁기 설치, 완료, 2026년 9월 26일 토요일 오전 8시부터 9시, 한빛 설비, 정다은, 서울 용산구 이태원로 202',
      }),
    ).toBeOnTheScreen();
  });

  it('월 화살표는 "이전 달", "다음 달" 버튼이다', async () => {
    await renderHistory();

    expect(prevMonth()).toBeOnTheScreen();
    expect(nextMonth()).toBeOnTheScreen();
  });

  // 포커스는 누른 화살표에 남아 바뀐 제목을 읽지 않는다
  it('달을 바꾸면 바뀐 달과 그 달 완료 건수를 알려 준다', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    await renderHistory();

    await userEvent.press(prevMonth());
    expect(announce).toHaveBeenLastCalledWith('2026년 8월, 완료 1건');

    await userEvent.press(prevMonth());
    expect(announce).toHaveBeenLastCalledWith('2026년 7월, 완료 0건');

    await userEvent.press(nextMonth());
    expect(announce).toHaveBeenLastCalledWith('2026년 8월, 완료 1건');
    announce.mockRestore();
  });

  it('요약 카드는 카드 하나로 "누적 완료 4건" 처럼 읽는다', async () => {
    await renderHistory();

    for (const label of ['누적 완료 4건', '이번 달 완료 3건']) {
      const card = screen.getByLabelText(label);
      expect(card).toHaveProp('accessible', true);
    }
  });
});

// Figma 작업이력 (기본) 2751:6982 의 패널 값
describe('WorkHistoryScreen — Figma 값', () => {
  const parentOf = (element: HostElement) => element.parent as HostElement;

  it('제목과 월 선택 사이 14, 월 제목과 화살표 사이 6', async () => {
    await renderHistory();

    const monthRow = parentOf(prevMonth());
    expect(monthRow).toHaveStyle({ gap: 6 });
    expect(parentOf(monthRow)).toHaveStyle({ paddingTop: 14 });
  });

  // 요약 카드는 새 Figma 작업이력 (기본) 3753:4890 › 3753:4903 기준이다 (#145)
  it('요약 카드는 모서리 16, 카드 사이 10, 누적 완료 설명은 Gray600', async () => {
    await renderHistory();

    const card = screen.getByLabelText('누적 완료 4건');
    expect(card).toHaveStyle({ borderRadius: 16 });
    expect(parentOf(card)).toHaveStyle({ gap: 10 });
    expect(screen.getByText('누적 완료')).toHaveStyle({
      color: colors.gray[600],
    });
  });

  it('요약 카드는 이번 달 완료(Primary 강조)가 왼쪽, 누적 완료가 오른쪽이다', async () => {
    await renderHistory();

    const month = screen.getByLabelText('이번 달 완료 3건');
    const total = screen.getByLabelText('누적 완료 4건');
    expect(parentOf(month)).toBe(parentOf(total));
    expect(parentOf(month).children).toEqual([month, total]);
    expect(month).toHaveStyle({ backgroundColor: colors.primary });
    expect(total).not.toHaveStyle({ backgroundColor: colors.primary });
  });

  it('스크린리더도 이번 달 완료 → 누적 완료 순서로 읽는다', async () => {
    await renderHistory();

    expect(
      screen
        .getAllByLabelText(/^(이번 달 완료|누적 완료) /)
        .map(card => card.props.accessibilityLabel),
    ).toEqual(['이번 달 완료 3건', '누적 완료 4건']);
  });

  // 카드를 다시 그리면 그 View 의 props 객체가 새로 만들어진다. 같은 객체면 memo 로 건너뛴 것이다
  // (props 를 toBe 로 비교하면 실패할 때 자식 요소까지 diff 를 찍다 메모리가 넘쳐 참·거짓으로 본다)
  it('달을 바꿔도 누적 완료 카드는 다시 그리지 않는다', async () => {
    await renderHistory();
    const before = screen.getByLabelText('누적 완료 4건').props;

    await userEvent.press(prevMonth());

    expect(screen.getByLabelText('이번 달 완료 1건')).toBeOnTheScreen();
    const sameProps = screen.getByLabelText('누적 완료 4건').props === before;
    expect(sameProps).toBe(true);
  });

  it('행은 줄 사이 10, 아래 구분선 Gray200, 제목 Body/M/SemiBold', async () => {
    await renderHistory({ works: [works[0]] });

    expect(rows()[0]).toHaveStyle({
      gap: 10,
      borderBottomColor: colors.gray[200],
    });
    expect(screen.getByText('세탁기 설치')).toHaveStyle({
      ...typography['Body/M/SemiBold'],
      color: colors.gray[900],
    });
  });

  it('날짜 줄은 달력 아이콘 24 와 글자 사이 5', async () => {
    await renderHistory({ works: [works[0]] });

    const timeRow = parentOf(screen.getByText('2026.09.26 (토) 08:00 - 09:00'));
    expect(timeRow).toHaveStyle({ gap: 5 });
    expect(timeRow.children[0] as HostElement).toHaveStyle({
      width: 24,
      height: 24,
    });
  });

  it('발주사 줄은 사이 8, 구분선 Gray400, 고객 · 주소는 Caption/M/Medium Gray600', async () => {
    await renderHistory({ works: [works[0]] });

    const metaRow = parentOf(screen.getByText('한빛 설비'));
    expect(metaRow).toHaveStyle({ gap: 8 });
    expect(metaRow.children[1] as HostElement).toHaveStyle({
      width: 1,
      height: 12,
      backgroundColor: colors.gray[400],
    });
    expect(screen.getByText('정다은 · 서울 용산구 이태원로 202')).toHaveStyle({
      ...typography['Caption/M/Medium'],
      color: colors.gray[600],
    });
  });
});

// 서버에서 달마다 불러온다 (#114)
describe('WorkHistoryScreen — 불러오기', () => {
  it('누적 완료는 주어진 수를 보인다 (서버가 달마다 주므로 목록 길이와 다르다)', async () => {
    await renderHistory({ totalCompleted: 42 });

    expect(screen.getByLabelText('누적 완료 42건')).toBeOnTheScreen();
  });

  it('누적 완료를 모르면(서버가 주지 않음·처음 불러오는 중) "-" 로 보인다', async () => {
    await renderHistory({ totalCompleted: null });

    expect(screen.getByLabelText('누적 완료, 알 수 없음')).toBeOnTheScreen();
    expect(screen.getByText('-')).toBeOnTheScreen();
  });

  it('고른 달을 불러오는 동안 이번 달 완료는 0건 대신 "-" 다', async () => {
    await renderHistory({ works: [], load: { status: 'loading' } });

    expect(screen.getByLabelText('이번 달 완료, 알 수 없음')).toBeOnTheScreen();
  });

  it('불러오는 동안 목록 자리에 진행 표시를 보인다 (빈 상태 대신)', async () => {
    await renderHistory({ works: [], load: { status: 'loading' } });

    expect(screen.getByLabelText('불러오는 중')).toBeOnTheScreen();
    expect(
      screen.queryByText('이 달에 완료한 작업이 없어요'),
    ).not.toBeOnTheScreen();
  });

  it('불러오지 못하면 문구와 다시 시도를 보인다', async () => {
    const onRetry = jest.fn();
    await renderHistory({
      works: [],
      load: { status: 'error', message: '네트워크 문구', onRetry },
    });

    await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

    expect(screen.getByText('네트워크 문구')).toBeOnTheScreen();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('달을 바꾸면 그 달을 알린다 (그 달의 이력을 불러온다)', async () => {
    const onMonthChange = jest.fn();
    await renderHistory({ onMonthChange });

    await userEvent.press(prevMonth());

    expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2026, month: 7 });
  });

  it('바꾼 달을 다 불러온 뒤에 바뀐 달과 그 달 완료 건수를 알려 준다', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {})
      .mockClear();
    // 바깥(경로)처럼 달이 바뀌면 그 달을 불러오는 중이 된다
    let finishLoading = () => {};
    function Harness() {
      const [loading, setLoading] = useState(false);
      finishLoading = () => setLoading(false);
      return (
        <WorkHistoryScreen
          today={today}
          works={loading ? [] : works}
          load={loading ? { status: 'loading' } : undefined}
          onMonthChange={() => setLoading(true)}
          onOpenWork={jest.fn()}
        />
      );
    }
    await render(<Harness />);

    await userEvent.press(prevMonth());
    expect(announce).not.toHaveBeenCalled();

    await act(() => finishLoading());
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenLastCalledWith('2026년 8월, 완료 1건');
    announce.mockRestore();
  });

  it('당겨서 새로고침한다', async () => {
    const onRefresh = jest.fn();
    await renderHistory({ onRefresh, refreshing: true });
    const list = screen.getByTestId('work-history-list');

    expect(list.props.refreshing).toBe(true);
    await fireEvent(list, 'refresh');

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

// 켜 둔 채 날짜가 바뀌어 달이 넘어가면, 이번 달을 보던 화면은 새 달로 옮기고 직접 고른 달은 그대로 둔다 (#114 리뷰)
describe('WorkHistoryScreen — 날짜가 바뀌면', () => {
  it('이번 달을 보고 있었으면 새 달로 옮기고 그 달을 알린다', async () => {
    const onMonthChange = jest.fn();
    const { rerender } = await renderHistory({ onMonthChange });

    await rerender(
      <WorkHistoryScreen
        today={new Date(2026, 9, 1)}
        works={works}
        onOpenWork={jest.fn()}
        onMonthChange={onMonthChange}
      />,
    );

    expect(screen.getByText('2026년 10월')).toBeOnTheScreen();
    expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2026, month: 9 });
  });

  it('지난달을 직접 골라 보고 있었으면 그대로 둔다', async () => {
    const { rerender } = await renderHistory();
    await userEvent.press(prevMonth());

    await rerender(
      <WorkHistoryScreen
        today={new Date(2026, 9, 1)}
        works={works}
        onOpenWork={jest.fn()}
      />,
    );

    expect(screen.getByText('2026년 8월')).toBeOnTheScreen();
  });
});
