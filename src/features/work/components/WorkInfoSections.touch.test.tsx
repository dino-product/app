import { render, screen } from '@testing-library/react-native';
import {
  expectMinTouchTarget,
  hitSlopOf,
  stylePt,
  type HostElement,
} from '../../../shared/testing/touchTarget';
import { workDetail } from '../mockData';
import { WorkInfoSections } from './WorkInfoSections';

const renderSections = () =>
  render(
    <WorkInfoSections
      work={workDetail}
      onCall={jest.fn()}
      onNavigate={jest.fn()}
      onOpenMap={jest.fn()}
    />,
  );

describe('WorkInfoSections 터치 영역', () => {
  it('고객 전화 버튼은 44 원 그대로 터치 영역만 최소 터치 영역으로 넓힌다', async () => {
    await renderSections();

    const call = screen.getByRole('button', { name: '박민지 고객에게 전화' });
    expectMinTouchTarget(call, {
      width: stylePt(call, 'width'),
      height: stylePt(call, 'height'),
    });
  });

  it('왼쪽으로 넓힌 영역이 연락처 칸과의 간격 안에 든다', async () => {
    await renderSections();

    const call = screen.getByRole('button', { name: '박민지 고객에게 전화' });
    const row = call.parent as HostElement;
    expect(hitSlopOf(call).left).toBeLessThanOrEqual(stylePt(row, 'gap'));
  });

  // 지도는 카드 폭 그대로라 폭은 레이아웃이 정한다. 높이는 Figma 202 (#67)
  it('작업 위치 지도는 누르는 영역이 최소 터치 영역보다 크다', async () => {
    await renderSections();

    const map = screen.getByRole('imagebutton', { name: '작업 위치 지도' });
    expectMinTouchTarget(map, { height: stylePt(map, 'height') });
  });

  it('길찾기 버튼은 높이 56 이라 넓히지 않아도 최소 터치 영역을 넘는다', async () => {
    await renderSections();

    const navigate = screen.getByRole('button', { name: '길찾기' });
    expectMinTouchTarget(navigate, { height: stylePt(navigate, 'minHeight') });
  });
});
