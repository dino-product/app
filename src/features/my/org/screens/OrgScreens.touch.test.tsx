import { render, screen } from '@testing-library/react-native';
import { smallestLineHeight } from '../../../../shared/design-system/tokens/touchTarget';
import { expectMinTouchTarget } from '../../../../shared/testing/touchTarget';
import { participationRequestsMock } from '../mockData';
import { pendingRequests } from '../model';
import { JoinRequestsScreen } from './JoinRequestsScreen';

describe('조직 참여 터치 영역', () => {
  // 글자만 있는 버튼이라 가장 작은 글자 설정의 글자 줄 높이가 보이는 크기다
  it('신청 현황 카드의 신청 취소는 글자 줄을 위아래로 넓힌다', async () => {
    await render(
      <JoinRequestsScreen
        requests={pendingRequests(participationRequestsMock)}
        onCancel={jest.fn()}
        onJoin={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    const cancel = screen.getByRole('button', { name: '한빛 설비 신청 취소' });
    expectMinTouchTarget(cancel, {
      height: smallestLineHeight('Caption/M/SemiBold'),
    });
  });
});
