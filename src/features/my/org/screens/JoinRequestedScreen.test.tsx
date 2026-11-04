import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { escapeFrom } from '../../../../../jest/voiceOver';
import {
  colors,
  typography,
  withOpacity,
} from '../../../../shared/design-system';
import {
  fail,
  networkError,
  ok,
  type FakeResponse,
} from '../../../../shared/testing/fakeServer';
import { renderWithApi } from '../../../../shared/testing/renderWithApi';
import { testSession } from '../../../../shared/testing/session';
import type { ParticipationRequest } from '../model';
import { cancelRequestPath, OrganizationErrorCode } from '../participationApi';
import { participationRequestsKey } from '../participationQueries';
import { createParticipationServer } from '../testing';
import { JoinRequestedScreen } from './JoinRequestedScreen';

// 방금 보낸 요청 (서버 요청 9). 요청 경로는 서버가 돌려주지 않아 이 앱이 보낸 값이다
const request: ParticipationRequest = {
  requestId: '9',
  organizationId: '9',
  organizationName: 'Orbit',
  desiredType: 'TECHNICIAN',
  status: 'PENDING',
  requestChannel: 'COMPANY_CODE',
  requestedAt: new Date(2026, 8, 23, 10, 24).toISOString(),
};

const CANCEL_TITLE = 'Orbit 참여 신청을 취소할까요?';
const CANCEL_PATH = cancelRequestPath('9');
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
const confirmCancel = () =>
  userEvent.press(screen.getByRole('button', { name: '취소' }));
const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});

function renderRequested(
  extra: Partial<Parameters<typeof JoinRequestedScreen>[0]> = {},
) {
  const participation = createParticipationServer({
    requests: [
      {
        requestId: 9,
        organizationId: 9,
        organizationName: 'Orbit',
        desiredType: 'TECHNICIAN',
        confirmedType: null,
        status: 'PENDING',
        rejectReason: null,
        requestedAt: request.requestedAt,
        decidedAt: null,
      },
    ],
  });
  const props = {
    request,
    onConfirm: jest.fn(),
    onCanceled: jest.fn(),
    onAlreadyDecided: jest.fn(),
    onBack: jest.fn(),
    ...extra,
  };
  return renderWithApi(<JoinRequestedScreen {...props} />, {
    server: participation.server,
    session: testSession(),
  }).then(view => ({ ...view, props, participation }));
}

describe('JoinRequestedScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  // 서버는 요청 경로를 돌려주지 않는다. 이 앱이 보내지 않은 요청(다시 연 승인 대기)은 경로를 모른다
  it('요청 경로를 모르면 그 줄을 빼고 보여준다', async () => {
    const { requestChannel, ...unknownChannel } = request;
    expect(requestChannel).toBe('COMPANY_CODE');
    await renderRequested({ request: unknownChannel });

    expect(screen.getByLabelText('회사, Orbit')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^요청 경로/)).toBeNull();
  });

  it('확인을 누르면 onConfirm 을 부른다', async () => {
    const { props } = await renderRequested();

    await userEvent.press(screen.getByRole('button', { name: '확인' }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('확인을 연달아 눌러도 한 번만 알린다', async () => {
    const { props } = await renderRequested();

    await fireEvent.press(screen.getByRole('button', { name: '확인' }));
    await fireEvent.press(screen.getByRole('button', { name: '확인' }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  // 온보딩은 확인으로 사무실의 결정을 서버에서 확인한다. 확인하는 동안 버튼을 잠그고, 실패하면 다시 누를 수 있다
  it('확인이 결과를 기다리면 그동안 버튼을 잠그고, 실패하면 알린 뒤 다시 누를 수 있다', async () => {
    const alert = spyAlert();
    let reject: (error: Error) => void = () => {};
    const onConfirm = jest
      .fn<Promise<void>, []>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_, rejectConfirm) => {
            reject = rejectConfirm;
          }),
      )
      .mockResolvedValue(undefined);
    await renderRequested({ flow: 'onboarding', onConfirm });

    await userEvent.press(screen.getByRole('button', { name: '확인' }));
    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '신청 취소' })).toBeDisabled();
    await act(async () => reject(new Error('network')));

    expect(alert).toHaveBeenCalledWith(
      '결과를 확인하지 못했어요',
      '잠시 후 다시 시도해 주세요.',
    );
    expect(screen.getByRole('button', { name: '확인' })).toBeEnabled();
    await userEvent.press(screen.getByRole('button', { name: '확인' }));
    expect(onConfirm).toHaveBeenCalledTimes(2);
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

    it('취소를 누르면 서버에 이 신청을 취소하고, 취소되면 알린다', async () => {
      const { props, server, participation } = await renderRequested();
      await openCancel();

      await confirmCancel();

      expect(cancelTitle()).toBeNull();
      await waitFor(() => expect(props.onCanceled).toHaveBeenCalledTimes(1));
      expect(server.callsTo('POST', CANCEL_PATH)).toHaveLength(1);
      expect(participation.requests[0].status).toBe('CANCELED');
    });

    // 화면 이동은 화면의 몫이지만, 서버가 받은 취소를 신청 현황에 반영하는 일은 화면이 사라져도 일어나야 한다
    it('취소하는 동안 화면을 떠나도 서버가 받은 취소는 받아 둔 신청 현황에 반영되고, 화면 이동은 하지 않는다', async () => {
      const { props, server, unmount, queryClient, participation } =
        await renderRequested();
      queryClient.setQueryData(participationRequestsKey, [request]);
      let release: () => void = () => {};
      server.on(
        'POST',
        CANCEL_PATH,
        () =>
          new Promise<FakeResponse>(done => {
            release = () => {
              participation.requests[0].status = 'CANCELED';
              done(
                ok({
                  requestId: 9,
                  organizationId: 9,
                  organizationName: 'Orbit',
                  desiredType: 'TECHNICIAN',
                  status: 'CANCELED',
                  requestedAt: request.requestedAt,
                }),
              );
            };
          }),
      );
      await openCancel();
      await confirmCancel();

      await unmount();
      await act(async () => release());

      await waitFor(() =>
        expect(
          queryClient.getQueryData<ParticipationRequest[]>(
            participationRequestsKey,
          )?.[0].status,
        ).toBe('CANCELED'),
      );
      expect(props.onCanceled).not.toHaveBeenCalled();
    });

    it('취소하는 동안에는 확인·신청 취소가 잠기고, 연달아 눌러도 한 번만 취소한다', async () => {
      const { props, server } = await renderRequested();
      let release: (response: FakeResponse) => void = () => {};
      server.on(
        'POST',
        CANCEL_PATH,
        () =>
          new Promise<FakeResponse>(done => {
            release = done;
          }),
      );
      await openCancel();

      // 다시 그리기 전(같은 프레임)에 두 번 눌린 경우
      const confirm = screen.getByRole('button', { name: '취소' });
      await act(async () => {
        await fireEvent.press(confirm);
        await fireEvent.press(confirm);
      });

      expect(server.callsTo('POST', CANCEL_PATH)).toHaveLength(1);
      // 취소 중 상태는 서버 상태 캐시가 다음 틱에 알린다
      await waitFor(() =>
        expect(screen.getByRole('button', { name: '확인' })).toBeDisabled(),
      );
      expect(screen.getByRole('button', { name: '신청 취소' })).toBeDisabled();
      await act(async () => release(networkError()));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: '확인' })).toBeEnabled(),
      );
      expect(props.onCanceled).not.toHaveBeenCalled();
    });

    // 사무실이 그사이 결정했다. 알림의 확인을 누르면 바깥이 서버 상태에 맞는 화면으로 보낸다
    it('이미 처리된 요청(409 ORGANIZATION-017)이면 알리고, 확인하면 바깥에 알린다', async () => {
      const alert = spyAlert();
      const { props, participation } = await renderRequested();
      participation.decide({ status: 'APPROVED' }, 9);
      await openCancel();

      await confirmCancel();

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '이미 처리된 요청이에요',
          '사무실이 이미 결정했거나 취소된 요청이라 취소할 수 없어요.',
          expect.any(Array),
        ),
      );
      expect(props.onAlreadyDecided).not.toHaveBeenCalled();
      const buttons: AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
      await act(() => buttons[0].onPress?.());
      expect(props.onAlreadyDecided).toHaveBeenCalledTimes(1);
      expect(props.onCanceled).not.toHaveBeenCalled();
    });

    // 서버는 없는 요청과 다른 계정의 요청을 구분하지 않는다. -017 처럼 지금 상태의 화면으로 보낸다
    it('없는·다른 계정의 요청(403 ORGANIZATION-016)이면 처리할 수 없다고 알리고, 확인하면 바깥에 알린다', async () => {
      const alert = spyAlert();
      const { props, server } = await renderRequested();
      server.on(
        'POST',
        CANCEL_PATH,
        fail(403, OrganizationErrorCode.notOwnRequest),
      );
      await openCancel();

      await confirmCancel();

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '처리할 수 없는 요청이에요',
          '이미 사라졌거나 이 계정의 요청이 아니에요.',
          expect.any(Array),
        ),
      );
      const buttons: AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
      await act(() => buttons[0].onPress?.());
      expect(props.onAlreadyDecided).toHaveBeenCalledTimes(1);
    });

    it('취소하지 못하면(네트워크 등) 알리고 화면에 머물러 다시 취소할 수 있다', async () => {
      const alert = spyAlert();
      const { props, server } = await renderRequested();
      server.on('POST', CANCEL_PATH, networkError());
      await openCancel();

      await confirmCancel();

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '신청을 취소하지 못했어요',
          '잠시 후 다시 시도해 주세요.',
        ),
      );
      expect(props.onCanceled).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: '신청 취소' })).toBeEnabled();
      await openCancel();
      expect(cancelTitle()).toBeOnTheScreen();
    });

    it('오른쪽 위 X 는 스크린리더에서 닫기 버튼이고, 누르면 신청은 그대로 닫힌다', async () => {
      const { server } = await renderRequested();
      await openCancel();

      const close = screen.getByTestId('cancel-request-modal-close');
      expect(close).toHaveAccessibleName('닫기');
      expect(close).toHaveProp('accessibilityRole', 'button');
      await userEvent.press(close);

      expect(cancelTitle()).toBeNull();
      expect(server.callsTo('POST', CANCEL_PATH)).toHaveLength(0);
    });

    it('닫기 버튼은 신청을 그대로 두고 닫는다', async () => {
      const { server } = await renderRequested();
      await openCancel();

      const [, closeButton] = screen.getAllByRole('button', { name: '닫기' });
      await userEvent.press(closeButton);

      expect(cancelTitle()).toBeNull();
      expect(server.callsTo('POST', CANCEL_PATH)).toHaveLength(0);
    });

    it('Android 뒤로가기로 닫히고 신청은 그대로다', async () => {
      const { server } = await renderRequested();
      await openCancel();

      await act(() => modalHost().props.onRequestClose());

      expect(cancelTitle()).toBeNull();
      expect(server.callsTo('POST', CANCEL_PATH)).toHaveLength(0);
    });

    it('VoiceOver 두 손가락 Z 로 닫히고 신청은 그대로다', async () => {
      const { server } = await renderRequested();
      await openCancel();

      await escapeFrom(CANCEL_TITLE);

      expect(cancelTitle()).toBeNull();
      expect(server.callsTo('POST', CANCEL_PATH)).toHaveLength(0);
    });

    it('닫은 뒤 다시 열 수 있다', async () => {
      await renderRequested();
      await openCancel();
      await userEvent.press(screen.getByTestId('cancel-request-modal-close'));

      await openCancel();

      expect(cancelTitle()).toBeOnTheScreen();
    });
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
      await renderRequested({ flow: 'onboarding' });

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
