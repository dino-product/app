import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import {
  expectIconButtonTouchTarget,
  expectMinTouchTarget,
  hitSlopOf,
  LAYOUT_BASE_WIDTH,
  stylePt,
  type HostElement,
} from '../../../shared/testing/touchTarget';
import { saveHomeView } from '../homeView';
import { currentWork, homeToday, weeklySchedule } from '../mockData';
import { WorkHomeScreen } from './WorkHomeScreen';

const renderHome = () =>
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
    />,
  );

const button = (name: string) => screen.getByRole('button', { name });

describe('WorkHomeScreen 터치 영역', () => {
  it('알림 버튼은 26 종 아이콘 그대로 최소 터치 영역으로 넓힌다', async () => {
    await renderHome();

    expectIconButtonTouchTarget(button('알림센터'));
  });

  // #94: 26 아이콘 두 개가 4 간격으로 붙어 있어, 서로 쪽으로는 간격의 반만, 바깥쪽으로 나머지를 넓힌다.
  // #147: 기본(블록 보기)으로 열든 목록 보기를 골라 둔 기기로 열든 같다
  it.each([
    ['목록 보기', 'list'],
    ['목록 보기', 'block'],
    ['블록 보기', 'list'],
    ['블록 보기', 'block'],
  ] as const)(
    '%s 버튼은 26 아이콘 그대로 최소 터치 영역으로 넓힌다 (%s 보기로 열었을 때)',
    async (name, view) => {
      saveHomeView(view);
      await renderHome();

      expectIconButtonTouchTarget(button(name));
    },
  );

  // #179: 블록 보기가 왼쪽, 목록 보기가 오른쪽이다. 맞닿는 쪽(블록 오른쪽·목록 왼쪽)은 간격을 반씩 나눈다
  it('보기 전환 버튼끼리 넓힌 영역이 겹치지 않는다', async () => {
    await renderHome();

    const block = button('블록 보기');
    const gap = stylePt(block.parent as HostElement, 'gap');
    expect(hitSlopOf(block).right + hitSlopOf(button('목록 보기')).left).toBe(
      gap,
    );
  });

  it('보기 전환 버튼은 바깥쪽(블록 왼쪽·목록 오른쪽)으로 더 넓힌다', async () => {
    await renderHome();

    const block = hitSlopOf(button('블록 보기'));
    const list = hitSlopOf(button('목록 보기'));
    expect(block.left).toBeGreaterThan(block.right);
    expect(list.right).toBeGreaterThan(list.left);
  });

  // 일정 줄 위는 진행 중 작업 카드와 24, 아래는 첫 일정 카드·날짜 줄과 12 떨어져 있다
  it('보기 전환 버튼이 위아래로 넓힌 영역은 일정 줄 위아래 간격 안에 든다', async () => {
    await renderHome();

    const list = button('목록 보기');
    const sectionRow = list.parent?.parent as HostElement;
    const schedulePart = sectionRow.parent as HostElement;
    // 버튼(26)은 일정 줄(글자 줄 28) 가운데에 놓인다
    const inset = 1;
    expect(hitSlopOf(list).bottom - inset).toBeLessThan(
      stylePt(schedulePart, 'gap'),
    );
  });

  describe('블록 보기 날짜 칸 (375pt 화면)', () => {
    // Android 는 칸 폭 검사를 건너뛴다. 붙어 있는 7칸이 48dp 를 다 받지 못한다.
    // 칸 폭은 375 에서 42.4 + 칸 사이 5 = 47.4, 360dp 에서 45.3 이다. 393dp(Figma)부터 50 이다.
    // 칸 사이 간격보다 넓히면 옆 칸과 겹치고 겹친 곳은 옆 칸이 먼저 받는다 (ScheduleScreen 의 달력 칸과 같은 결정)
    const itOnIOS = Platform.OS === 'ios' ? it : it.skip;

    // 저장한 보기가 없으면 블록 보기로 연다 (#147)
    const firstDay = async () => {
      await renderHome();
      return button('9월 15일 화요일');
    };

    it('칸 높이 69 그대로 최소 터치 영역을 채운다', async () => {
      const day = await firstDay();

      expectMinTouchTarget(day, { height: stylePt(day, 'minHeight') });
    });

    itOnIOS(
      '칸 폭에 칸 사이 간격까지 더해 최소 터치 영역을 채운다',
      async () => {
        const day = await firstDay();

        const row = day.parent as HostElement;
        const gap = stylePt(row, 'gap');
        // 본문은 좌우 24 여백 안에 있다
        const width = (LAYOUT_BASE_WIDTH - 24 * 2 - gap * 6) / 7;
        expectMinTouchTarget(day, { width });
      },
    );

    it('칸이 넓힌 영역은 칸 사이 간격 안에 들어 옆 칸과 겹치지 않는다', async () => {
      const day = await firstDay();

      const slop = hitSlopOf(day);
      expect(slop.left + slop.right).toBeLessThanOrEqual(
        stylePt(day.parent as HostElement, 'gap'),
      );
      expect(slop.top + slop.bottom).toBe(0);
    });
  });
});
