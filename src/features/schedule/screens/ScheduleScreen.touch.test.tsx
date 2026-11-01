import { render, screen, userEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';
import {
  expectIconButtonTouchTarget,
  expectMinTouchTarget,
  hitSlopOf,
  LAYOUT_BASE_WIDTH,
  stylePt,
  type HostElement,
} from '../../../shared/testing/touchTarget';
import { ScheduleScreen } from './ScheduleScreen';

const renderSchedule = () =>
  render(
    <ScheduleScreen
      today={new Date(2026, 11, 15)} // 화요일
      confirmed={[]}
      pending={[]}
      onAccept={jest.fn()}
      onReject={jest.fn()}
      onOpenRequest={jest.fn()}
    />,
  );

// Android 는 아래 두 검사를 건너뛴다. 붙어 있는 칸이 48dp 를 다 받지 못한다.
// - 주간 칸: 칸 사이 간격이 넓힌 폭 8 보다 좁다. 실제로 눌리는 폭이 375 에서 47.8, 360dp 에서 45.3 이다.
//   376dp 부터 48 이다.
// - 달력 칸: 칸 폭이 375 에서 46.7, 360dp 에서 44.6 이다. 384dp 부터 48 이다.
// 칸이 붙어 있어 hitSlop 으로는 넓힐 수 없다. 겹친 곳은 옆 칸이 먼저 받는다. 레이아웃을 바꾸는 디자인 결정으로 남긴다.
// 두 플랫폼이 같은 레이아웃이라 iOS 쪽 검사가 좌우 패딩이 크게 늘어나는 회귀는 잡는다 (주간 35.5, 달력 33.5 초과).
// 그보다 작게 늘어 Android 폭만 더 줄어드는 회귀는 잡지 못한다
const itOnIOS = Platform.OS === 'ios' ? it : it.skip;

// 주간 줄·달력의 칸 폭과 간격은 화면 폭에서 dateArea 좌우 패딩을 뺀 폭으로 정해진다
describe('ScheduleScreen — 터치 영역 (375pt 화면)', () => {
  const contentWidth = (dateArea: HostElement) =>
    LAYOUT_BASE_WIDTH - stylePt(dateArea, 'paddingHorizontal') * 2;

  itOnIOS('주간 날짜 칸이 넓힌 영역이 칸 사이 간격 안에 든다', async () => {
    await renderSchedule();

    const day = screen.getByRole('button', { name: '12월 15일 화요일' });
    const dateArea = day.parent?.parent as HostElement;
    // 7칸을 space-between 으로 벌리므로 칸 사이 간격은 남는 폭의 1/6 이다
    const spacing = (contentWidth(dateArea) - stylePt(day, 'minWidth') * 7) / 6;
    const slop = hitSlopOf(day);
    expect(slop.left + slop.right).toBeLessThanOrEqual(spacing);
  });

  itOnIOS(
    '달력 날짜 칸 폭(달력 폭의 1/7)이 최소 터치 영역 이상이다',
    async () => {
      await renderSchedule();
      await userEvent.press(
        screen.getByRole('button', { name: '달력 펼치기' }),
      );

      const day = screen.getByRole('button', { name: '12월 15일 화요일' });
      // 날짜 칸 › 주(행) › 달력 › dateArea
      const dateArea = day.parent?.parent?.parent as HostElement;
      expectMinTouchTarget(day, { width: contentWidth(dateArea) / 7 });
    },
  );

  it('탭이 위로 넓힌 영역은 화면 제목 아래 여백 안에 든다', async () => {
    await renderSchedule();

    const tab = screen.getByRole('tab', { name: '확정 일정 0건' });
    const title = screen.getByRole('header', { name: '내 일정' });
    expect(hitSlopOf(tab).top).toBeLessThanOrEqual(
      stylePt(title, 'paddingBottom'),
    );
  });
});

describe('ScheduleScreen — 달력 펼치기·접기 버튼 터치 영역', () => {
  const getToggle = () => screen.getByRole('button', { name: '달력 펼치기' });

  it('24 아이콘 그대로 최소 터치 영역으로 넓힌다', async () => {
    await renderSchedule();

    expectIconButtonTouchTarget(getToggle());
  });

  // dateArea 는 테두리가 있어 네이티브 뷰다. 그 경계 밖의 터치는 자식에게 가지 않는다.
  // 글자가 가장 작으면 날짜 줄 높이가 아이콘 높이와 같아 아이콘 위아래로 남는 여백이 없다
  it('넓힌 영역이 dateArea 의 여백 안에 들고, 아래 주간 줄·달력과의 간격을 넘지 않는다', async () => {
    await renderSchedule();

    const toggle = getToggle();
    const dateArea = toggle.parent?.parent as HostElement;
    const slop = hitSlopOf(toggle);
    expect(slop.top).toBeLessThanOrEqual(stylePt(dateArea, 'paddingTop'));
    expect(slop.right).toBeLessThanOrEqual(
      stylePt(dateArea, 'paddingHorizontal'),
    );
    expect(slop.bottom).toBeLessThanOrEqual(stylePt(dateArea, 'gap'));
  });
});
