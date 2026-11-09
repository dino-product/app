import { render, screen } from '@testing-library/react-native';
import {
  expectIconButtonTouchTarget,
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
