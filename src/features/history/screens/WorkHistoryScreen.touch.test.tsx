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
// 화살표 › 월 선택 줄 › 리스트 머리
const rowOf = (arrow: HostElement) => arrow.parent as HostElement;
const headerOf = (arrow: HostElement) => rowOf(arrow).parent as HostElement;

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

  // 리스트 밖(위의 제목 영역)으로 넓힌 부분은 터치가 닿지 않는다.
  // 줄 높이는 글자가 가장 작을 때 가장 낮아 화살표가 줄 위쪽에 가장 가깝다
  it('화살표가 위로 넓힌 영역은 리스트 머리 안에 든다', async () => {
    await renderHistory();

    const prev = getArrow('이전 달');
    const icon = prev.children[0] as HostElement;
    const iconHeight = stylePt(icon, 'height');
    const titleInset = Math.max(
      0,
      (minLineHeight(screen.getByText('2026년 9월')) - iconHeight) / 2,
    );
    expect(hitSlopOf(prev).top - titleInset).toBeLessThanOrEqual(
      stylePt(headerOf(prev), 'paddingTop'),
    );
  });

  it('화살표가 아래로 넓힌 영역은 요약 카드와 겹치지 않는다', async () => {
    await renderHistory();

    const prev = getArrow('이전 달');
    expect(hitSlopOf(prev).bottom).toBeLessThanOrEqual(
      stylePt(headerOf(prev), 'gap'),
    );
  });
});
