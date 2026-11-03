import { render, screen, userEvent } from '@testing-library/react-native';
import { smallestLineHeight } from '../../../../shared/design-system/tokens/touchTarget';
import {
  expectIconButtonTouchTarget,
  expectMinTouchTarget,
  stylePt,
} from '../../../../shared/testing/touchTarget';
import { participationRequestsMock } from '../mockData';
import { pendingRequests } from '../model';
import { JoinRequestedScreen } from './JoinRequestedScreen';
import { JoinRequestsScreen } from './JoinRequestsScreen';
import { OrgJoinScreen } from './OrgJoinScreen';

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

  // 아이콘(24)만 보이는 버튼이라 hitSlop 으로 넓힌다 (#98)
  it('참여 요청을 보냈어요 › 신청 취소 모달의 X 는 최소 터치 영역 이상이다', async () => {
    await render(
      <JoinRequestedScreen
        request={participationRequestsMock[0]}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
        onBack={jest.fn()}
      />,
    );
    await userEvent.press(screen.getByRole('button', { name: '신청 취소' }));

    expectIconButtonTouchTarget(
      screen.getByTestId('cancel-request-modal-close'),
    );
  });

  // 입력칸은 hitSlop 으로 넓힐 수 없어 보이는 높이가 터치 영역이다. 온보딩 Figma 는 46 이다 (#85)
  it('온보딩 회사 코드 입력칸은 최소 터치 영역 이상이다', async () => {
    await render(
      <OrgJoinScreen
        flow="onboarding"
        onBack={jest.fn()}
        lookup={jest.fn()}
        onFound={jest.fn()}
      />,
    );

    const input = screen.getByLabelText('회사 코드 입력');
    expectMinTouchTarget(input, { height: stylePt(input, 'minHeight') });
  });
});
