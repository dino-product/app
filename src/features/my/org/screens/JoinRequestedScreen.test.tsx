import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { escapeFrom } from '../../../../../jest/voiceOver';
import {
  colors,
  typography,
  withOpacity,
} from '../../../../shared/design-system';
import type { ParticipationRequest } from '../model';
import { JoinRequestedScreen } from './JoinRequestedScreen';

const request: ParticipationRequest = {
  requestId: 'request-9',
  organizationId: 'org-9',
  organizationName: 'Orbit',
  desiredType: 'TECHNICIAN',
  status: 'PENDING',
  requestChannel: 'COMPANY_CODE',
  requestedAt: new Date(2026, 8, 23, 10, 24).toISOString(),
};

const CANCEL_TITLE = 'Orbit 참여 신청을 취소할까요?';
const cancelTitle = () => screen.queryByRole('header', { name: CANCEL_TITLE });
// 모달을 감싼 RN Modal (호스트 요소 이름이 Modal 이다)
const modalHost = () => {
  let node = screen.getByTestId('cancel-request-modal').parent;
  while (node && node.type !== 'Modal') {
    node = node.parent;
  }
  if (!node) {
    throw new Error('신청 취소 모달이 Modal 안에 있지 않다');
  }
  return node;
};
const openCancel = () =>
  userEvent.press(screen.getByRole('button', { name: '신청 취소' }));

const renderRequested = () => {
  const props = {
    request,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    onBack: jest.fn(),
  };
  return render(<JoinRequestedScreen {...props} />).then(() => props);
};

describe('JoinRequestedScreen', () => {
  it('요청을 보냈다는 안내와 3단계 진행 표시를 보여준다', async () => {
    await renderRequested();

    expect(
      screen.getByRole('header', { name: '참여 요청을 보냈어요' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('사무실에서 요청을 확인하면 알려드릴게요.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        '진행 단계: 요청 완료, 다음은 사무실 검토 중, 참여 완료',
      ),
    ).toBeOnTheScreen();
  });

  it('요약에 회사, 희망 유형, 요청 경로, 요청 일시가 보인다', async () => {
    await renderRequested();

    for (const [label, value] of [
      ['회사', 'Orbit'],
      ['희망 유형', '기사'],
      ['요청 경로', '회사 코드'],
      ['요청 일시', '2026-09-23 · 10:24'],
    ]) {
      expect(screen.getByLabelText(`${label}, ${value}`)).toBeOnTheScreen();
    }
    expect(
      screen.getByText('승인 전까지 회사의 일정과 작업은 표시되지 않습니다.'),
    ).toBeOnTheScreen();
  });

  it('확인을 누르면 onConfirm 을 부른다', async () => {
    const props = await renderRequested();

    await userEvent.press(screen.getByRole('button', { name: '확인' }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  // 신청 취소 확인은 바텀 시트가 아니라 화면 가운데 모달이다 (#98). 신청 현황의 시트(2889:13197)는 그대로다
  describe('신청 취소 모달', () => {
    it('신청 취소를 누르면 화면 가운데 모달이 뜨고 문구는 그대로다 (바텀 시트가 아니다)', async () => {
      await renderRequested();

      await openCancel();

      expect(cancelTitle()).toBeOnTheScreen();
      expect(
        screen.getByText('Orbit 참여 신청을\n취소할까요?'),
      ).toBeOnTheScreen();
      expect(
        screen.getByText(
          '취소하면 사무실의 승인 대기 목록에서도 사라져요.\n같은 회사 코드로 언제든 다시 신청할 수 있어요.',
        ),
      ).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: '취소' })).toBeOnTheScreen();
      expect(screen.queryByTestId('cancel-request-sheet')).toBeNull();
      expect(modalHost().props).toMatchObject({
        visible: true,
        transparent: true,
        animationType: 'fade',
      });
      expect(screen.getByTestId('cancel-request-modal-backdrop')).toHaveStyle({
        justifyContent: 'center',
        alignItems: 'center',
      });
    });

    // ConfirmModal·NoticeModal 과 같은 계열 (카드 반경 20, 위 28·옆 20 여백, 배경 검정 40%)
    it('모양은 앱의 다른 가운데 모달(NoticeModal)과 같은 계열이다', async () => {
      await renderRequested();
      await openCancel();

      expect(screen.getByTestId('cancel-request-modal-backdrop')).toHaveStyle({
        backgroundColor: withOpacity('#000000', 0.4),
      });
      expect(screen.getByTestId('cancel-request-modal')).toHaveStyle({
        borderRadius: 20,
        paddingTop: 28,
        paddingHorizontal: 20,
        backgroundColor: colors.white[100],
      });
    });

    it('취소를 누르면 이 신청을 취소한다', async () => {
      const props = await renderRequested();
      await openCancel();

      await userEvent.press(screen.getByRole('button', { name: '취소' }));

      expect(props.onCancel).toHaveBeenCalledWith('request-9');
      expect(cancelTitle()).toBeNull();
    });

    it('취소를 연달아 눌러도 한 번만 취소한다', async () => {
      const props = await renderRequested();
      await openCancel();

      // 다시 그리기 전(같은 프레임)에 두 번 눌린 경우
      const confirm = screen.getByRole('button', { name: '취소' });
      await act(async () => {
        await fireEvent.press(confirm);
        await fireEvent.press(confirm);
      });

      expect(props.onCancel).toHaveBeenCalledTimes(1);
    });

    it('오른쪽 위 X 는 스크린리더에서 닫기 버튼이고, 누르면 신청은 그대로 닫힌다', async () => {
      const props = await renderRequested();
      await openCancel();

      const close = screen.getByTestId('cancel-request-modal-close');
      expect(close).toHaveAccessibleName('닫기');
      expect(close).toHaveProp('accessibilityRole', 'button');
      await userEvent.press(close);

      expect(cancelTitle()).toBeNull();
      expect(props.onCancel).not.toHaveBeenCalled();
    });

    it('닫기 버튼은 신청을 그대로 두고 닫는다', async () => {
      const props = await renderRequested();
      await openCancel();

      const [, closeButton] = screen.getAllByRole('button', { name: '닫기' });
      await userEvent.press(closeButton);

      expect(cancelTitle()).toBeNull();
      expect(props.onCancel).not.toHaveBeenCalled();
    });

    it('Android 뒤로가기로 닫히고 신청은 그대로다', async () => {
      const props = await renderRequested();
      await openCancel();

      await act(() => modalHost().props.onRequestClose());

      expect(cancelTitle()).toBeNull();
      expect(props.onCancel).not.toHaveBeenCalled();
    });

    it('VoiceOver 두 손가락 Z 로 닫히고 신청은 그대로다', async () => {
      const props = await renderRequested();
      await openCancel();

      await escapeFrom(CANCEL_TITLE);

      expect(cancelTitle()).toBeNull();
      expect(props.onCancel).not.toHaveBeenCalled();
    });

    it('닫은 뒤 다시 열 수 있다', async () => {
      await renderRequested();
      await openCancel();
      await userEvent.press(screen.getByTestId('cancel-request-modal-close'));

      await openCancel();

      expect(cancelTitle()).toBeOnTheScreen();
    });
  });
  it('확인을 연달아 눌러도 한 번만 알린다 (온보딩은 확인으로 사무실 결정을 흉내 낸다)', async () => {
    const { onConfirm } = await renderRequested();

    await fireEvent.press(screen.getByRole('button', { name: '확인' }));
    await fireEvent.press(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
  describe('흐름별 모양', () => {
    // Figma 회사찾기-요청완료 (3235:14886): 값 Caption/M/Medium Gray800, 안내 상자 없음
    it('마이는 머리 제목이 조직 참여하기이고 요약 값은 Medium Gray800 이다', async () => {
      await renderRequested();

      expect(
        screen.getByRole('header', { name: '조직 참여하기' }),
      ).toBeOnTheScreen();
      expect(screen.getByText('Orbit')).toHaveStyle({
        ...typography['Caption/M/Medium'],
        color: colors.gray[800],
      });
      expect(screen.queryByText(/새로운 요청은 차단됩니다/)).toBeNull();
    });

    // Figma 승인 대기 (3227:8824): 값 Caption/M/Semibold Gray800, 버튼 위 안내 상자
    it('온보딩은 머리 제목이 승인 대기이고 요약 값은 SemiBold, 안내 상자가 있다 (#85)', async () => {
      await render(
        <JoinRequestedScreen
          flow="onboarding"
          request={request}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
          onBack={jest.fn()}
        />,
      );

      expect(
        screen.getByRole('header', { name: '승인 대기' }),
      ).toBeOnTheScreen();
      expect(screen.getByText('Orbit')).toHaveStyle({
        ...typography['Caption/M/SemiBold'],
        color: colors.gray[800],
      });
      expect(
        screen.getByText('이전 코드·링크·QR을 통한 새로운 요청은 차단됩니다.'),
      ).toBeOnTheScreen();
    });
  });
});
