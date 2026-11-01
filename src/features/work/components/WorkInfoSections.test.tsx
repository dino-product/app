import { render, screen } from '@testing-library/react-native';
import {
  expectMinTouchTarget,
  stylePt,
} from '../../../shared/testing/touchTarget';
import { workDetail } from '../mockData';
import { WorkInfoSections } from './WorkInfoSections';

describe('WorkInfoSections', () => {
  it('고객 전화 버튼은 40pt 원 그대로 터치 영역만 44pt 로 넓힌다', async () => {
    await render(
      <WorkInfoSections
        work={workDetail}
        onCall={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );

    const call = screen.getByRole('button', { name: '박민지 고객에게 전화' });
    expectMinTouchTarget(call, {
      width: stylePt(call, 'width'),
      height: stylePt(call, 'height'),
    });
  });
});
