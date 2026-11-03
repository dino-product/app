import { render, screen, userEvent } from '@testing-library/react-native';
import type { ParticipationRequest } from '../model';
import { JoinRejectedScreen } from './JoinRejectedScreen';

const rejected: ParticipationRequest = {
  requestId: 'request-3',
  organizationId: 'org-12',
  organizationName: 'Orbit',
  desiredType: 'STAFF',
  status: 'REJECTED',
  requestChannel: 'COMPANY_CODE',
  requestedAt: '2026-09-20T01:00:00Z',
  rejectReason: '현재 기사 인원이 충분해 요청을 받지 않고 있어요.',
};

const renderRejected = (
  request: ParticipationRequest = rejected,
  onConfirm = jest.fn(),
) =>
  render(
    <JoinRejectedScreen
      request={request}
      onConfirm={onConfirm}
      onBack={jest.fn()}
    />,
  );

describe('JoinRejectedScreen', () => {
  it('거절 안내와 회사·희망 유형, 거절 사유를 보여준다', async () => {
    await renderRejected();

    expect(
      screen.getByRole('header', { name: '참여 요청이 거절되었어요' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('같은 회사 코드로 다시 요청할 수 있습니다.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('회사, Orbit')).toBeOnTheScreen();
    expect(screen.getByLabelText('희망 유형, 직원')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: '거절 사유' })).toBeOnTheScreen();
    expect(
      screen.getByText('현재 기사 인원이 충분해 요청을 받지 않고 있어요.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '거절 후에도 회사 코드와 참여 링크는 계속 사용할 수 있습니다.',
      ),
    ).toBeOnTheScreen();
  });

  it('사유 없이 거절되면 사유가 없다고 보여준다', async () => {
    await renderRejected({ ...rejected, rejectReason: undefined });

    expect(screen.getByText('입력된 거절 사유가 없어요.')).toBeOnTheScreen();
  });

  it('확인을 누르면 onConfirm 을 부른다', async () => {
    const onConfirm = jest.fn();
    await renderRejected(rejected, onConfirm);

    await userEvent.press(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
