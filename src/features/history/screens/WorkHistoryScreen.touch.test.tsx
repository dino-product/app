import { render, screen, userEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { colors, fonts } from '../../../shared/design-system';
import {
  expectIconButtonTouchTarget,
  expectMinTouchTarget,
  hitSlopOf,
  minLineHeight,
  stylePt,
  type HostElement,
} from '../../../shared/testing/touchTarget';
import { WorkHistoryScreen } from './WorkHistoryScreen';

const renderHistory = () =>
  render(
    <WorkHistoryScreen
      today={new Date(2026, 8, 28)}
      // 화살표 검사에는 목록이 필요 없다
      works={[]}
      onOpenWork={jest.fn()}
    />,
  );

const getArrow = (name: string) => screen.getByRole('button', { name });
// 화살표 › 월 선택 줄 › 리스트 위에 겹쳐 그린 상단 바 (#175)
const rowOf = (arrow: HostElement) => arrow.parent as HostElement;
const barOf = (arrow: HostElement) => rowOf(arrow).parent as HostElement;

/** 줄 높이가 가장 낮을 때(글자가 가장 작을 때) 화살표 위아래와 월 줄 끝 사이 */
function arrowInset(arrow: HostElement) {
  const icon = arrow.children[0] as HostElement;
  return Math.max(
    0,
    (minLineHeight(screen.getByText('2026년 9월')) - stylePt(icon, 'height')) /
      2,
  );
}

describe('WorkHistoryScreen — 월 선택 터치 영역', () => {
  it.each(['이전 달', '다음 달'])(
    '%s 버튼은 24 아이콘 그대로 최소 터치 영역으로 넓힌다',
    async name => {
      await renderHistory();

      expectIconButtonTouchTarget(getArrow(name));
    },
  );

  // 제목은 화살표와 겹치면 먼저 터치를 받아 가는 네이티브 뷰다
  it('화살표가 제목 쪽으로 넓힌 영역은 제목과의 간격 안에 든다', async () => {
    await renderHistory();

    const prev = getArrow('이전 달');
    const gap = stylePt(rowOf(prev), 'gap');
    expect(hitSlopOf(prev).right).toBeLessThanOrEqual(gap);
    expect(hitSlopOf(getArrow('다음 달')).left).toBeLessThanOrEqual(gap);
  });

  // 펼친 바 안에서 월 줄은 제목 줄 아래 14 에 있다
  it('화살표가 위로 넓힌 영역은 제목 줄에 닿지 않는다', async () => {
    await renderHistory();

    const prev = getArrow('이전 달');
    expect(hitSlopOf(prev).top - arrowInset(prev)).toBeLessThanOrEqual(
      stylePt(rowOf(prev), 'marginTop'),
    );
  });

  // 상단 바는 리스트 위에 겹쳐 있다. 바 밖으로 넓히면 그 아래 리스트(요약 카드)의 터치를 먼저 가져간다
  it('화살표가 아래로 넓힌 영역은 상단 바 안에 들어 요약 카드와 겹치지 않는다', async () => {
    await renderHistory();

    const prev = getArrow('이전 달');
    expect(hitSlopOf(prev).bottom - arrowInset(prev)).toBeLessThanOrEqual(
      stylePt(barOf(prev), 'paddingBottom'),
    );
  });
});

// #203 날짜 선택. 월 글자는 상자를 여닫는 버튼이다
describe('WorkHistoryScreen — 날짜 선택 터치 영역 (#203)', () => {
  const monthButton = () => screen.getByRole('button', { name: '2026년 9월' });
  const monthText = () => screen.getByText('2026년 9월');
  const hidden = { includeHiddenElements: true };

  it('월 글자 버튼은 가장 작은 글자에서도 최소 터치 영역이다', async () => {
    await renderHistory();

    expectMinTouchTarget(monthButton(), {
      height: minLineHeight(monthText()),
    });
  });

  // 월 줄은 제목 줄 아래 14, 바 아래 끝 위 24 에 있다. 넓힌 영역이 제목·요약 카드의 터치를 가져가지 않는다
  it('월 글자 버튼이 위아래로 넓힌 영역은 제목 줄·상단 바 밖에 닿지 않고, 화살표 쪽으로는 넓히지 않는다', async () => {
    await renderHistory();

    const row = rowOf(getArrow('이전 달'));
    const inset =
      (stylePt(monthText(), 'lineHeight') - minLineHeight(monthText())) / 2;
    const slop = hitSlopOf(monthButton());
    expect(slop.top - inset).toBeLessThanOrEqual(stylePt(row, 'marginTop'));
    expect(slop.bottom - inset).toBeLessThanOrEqual(
      stylePt(barOf(getArrow('이전 달')), 'paddingBottom'),
    );
    expect(slop.left).toBe(0);
    expect(slop.right).toBe(0);
  });

  it('상자 머리(닫기) 자리와 휠은 최소 터치 영역 이상이다', async () => {
    await renderHistory();
    await userEvent.press(monthButton());

    const head = screen.getByTestId('work-history-month-picker-head', hidden);
    expectMinTouchTarget(head, { height: stylePt(head, 'height') });
    // 연·월 열은 휠 높이(174)를 채운다
    const wheelArea = screen.getByTestId(
      'work-history-month-picker-wheel',
      hidden,
    );
    expect(stylePt(wheelArea, 'height')).toBeGreaterThanOrEqual(
      MIN_TOUCH_TARGET_ANY,
    );
  });

  // Figma 가운데 줄은 SF Pro Text Regular. SF Pro 는 Apple 기기 전용 라이선스라 Android 는 앱 글꼴 Pretendard Regular 로 같은 모양을 그린다
  it('휠은 두 플랫폼 모두 같은 모양으로 직접 그리고, 글꼴만 iOS 시스템 글꼴 · Android Pretendard Regular 다', async () => {
    await renderHistory();
    await userEvent.press(monthButton());

    expect(screen.getByText('9월', hidden)).toHaveStyle({
      fontFamily: Platform.OS === 'ios' ? 'System' : fonts.regular,
      fontSize: 22.17,
      color: colors.black,
    });
    expect(screen.getByTestId('month-picker-month-wheel', hidden)).toHaveProp(
      'snapToInterval',
      32,
    );
  });
});

/** 휠 영역 높이(174)는 어느 플랫폼 기준보다 크다 */
const MIN_TOUCH_TARGET_ANY = 48;
