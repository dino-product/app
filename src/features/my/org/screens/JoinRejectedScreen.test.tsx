import { render, screen, userEvent } from '@testing-library/react-native';
import { colors, typography } from '../../../../shared/design-system';
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
  it('온보딩에서는 머리 제목이 참여 요청 결과다 (#85)', async () => {
    await render(
      <JoinRejectedScreen
        flow="onboarding"
        request={rejected}
        onConfirm={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('header', { name: '참여 요청 결과' }),
    ).toBeOnTheScreen();
  });

  // 알림에서 연 마이 거절 화면도 하단 탭 바 없이 연다 (#219). Figma 3255:18035 하단 바(높이 102): 버튼 위 14, 좌우 24, 아래 32
  it('아래 버튼 줄은 탭 바 없는 Figma 하단 바(버튼 위 14, 아래 32)다', async () => {
    await renderRejected();

    expect(screen.getByRole('button', { name: '확인' }).parent).toHaveStyle({
      paddingTop: 14,
      paddingHorizontal: 24,
    });
    expect(screen.root?.props.edges).toEqual(
      expect.objectContaining({ top: 'additive', bottom: 'maximum' }),
    );
    expect(screen.root).toHaveStyle({ paddingBottom: 32 });
  });

  // Figma 회사찾기-거절 (3255:18035): 값 Caption/M/Semibold Gray800
  it('요약 값은 SemiBold Gray800 이다', async () => {
    await renderRejected();

    expect(screen.getByText('Orbit')).toHaveStyle({
      ...typography['Caption/M/SemiBold'],
      color: colors.gray[800],
    });
  });
});
