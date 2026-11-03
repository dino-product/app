import { render, screen, userEvent } from '@testing-library/react-native';
import type { ParticipationRequest } from '../../my/org/model';
import { JoinApprovedScreen } from './JoinApprovedScreen';

const approved: ParticipationRequest = {
  requestId: 'request-1',
  organizationId: 'org-9',
  organizationName: 'Orbit',
  desiredType: 'TECHNICIAN',
  status: 'APPROVED',
  approvedType: 'TECHNICIAN',
  requestChannel: 'COMPANY_CODE',
  requestedAt: new Date(2026, 8, 23, 10, 24).toISOString(),
  decidedAt: new Date(2026, 8, 23, 11, 0).toISOString(),
};

const renderApproved = async (request: ParticipationRequest = approved) => {
  const props = { onStart: jest.fn(), onBack: jest.fn() };
  await render(<JoinApprovedScreen request={request} {...props} />);
  return props;
};

describe('JoinApprovedScreen', () => {
  it('요청한 유형으로 승인되면 회사 이름으로 승인 완료와 요약을 보여준다', async () => {
    await renderApproved();

    expect(screen.getByRole('header', { name: '참여 완료' })).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Orbit 참여 승인 완료' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '기사로 승인되었어요.\n이제 배정된 작업을 확인할 수 있어요.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('회사, Orbit')).toBeOnTheScreen();
    expect(screen.getByLabelText('유형, 기사')).toBeOnTheScreen();
    expect(screen.getByLabelText('승인일, 2026-09-23')).toBeOnTheScreen();
    expect(
      screen.getByText('승인 전까지 회사의 일정과 작업은 표시되지 않습니다.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/유형이 맞지 않다면/)).not.toBeOnTheScreen();
  });

  it('직원으로 승인되면 받침에 맞춰 직원으로 라고 쓴다', async () => {
    await renderApproved({
      ...approved,
      desiredType: 'STAFF',
      approvedType: 'STAFF',
    });

    expect(
      screen.getByText(
        '직원으로 승인되었어요.\n이제 배정된 작업을 확인할 수 있어요.',
      ),
    ).toBeOnTheScreen();
  });

  it('사무실이 다른 유형으로 확정하면 확정된 유형으로 제목·요약을 쓰고 문의 안내를 보여준다', async () => {
    await renderApproved({ ...approved, approvedType: 'STAFF' });

    expect(
      screen.getByRole('header', { name: '직원 참여 승인 완료' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('사무실에서 요청하신 유형과 다르게 확정했어요.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('유형, 직원')).toBeOnTheScreen();
    expect(
      screen.getByText(
        '유형이 맞지 않다면 사무실 관리자에게 문의해 주세요.\n유형은 사무실에서 변경할 수 있어요.',
      ),
    ).toBeOnTheScreen();
  });

  it('시작하기를 누르면 알린다', async () => {
    const { onStart } = await renderApproved();

    await userEvent.press(screen.getByRole('button', { name: '시작하기' }));

    expect(onStart).toHaveBeenCalled();
  });

  it('뒤로 가기를 누르면 알린다', async () => {
    const { onBack } = await renderApproved();

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onBack).toHaveBeenCalled();
  });
});
