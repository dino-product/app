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
});
