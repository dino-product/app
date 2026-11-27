import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import { Alert, StyleSheet, type AlertButton } from 'react-native';
import { escapeFrom } from '../../../../../jest/voiceOver';
import {
  colors,
  typography,
  withOpacity,
} from '../../../../shared/design-system';
import { iconSvgs } from '../../../../shared/design-system/icons/svgs';
import { svgViewsDrawing } from '../../../../shared/testing/icon';
import {
  fail,
  networkError,
  ok,
  type FakeResponse,
} from '../../../../shared/testing/fakeServer';
import { renderWithApi } from '../../../../shared/testing/renderWithApi';
import { testSession } from '../../../../shared/testing/session';
import {
  stylePt,
  type HostElement,
} from '../../../../shared/testing/touchTarget';
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
/** 진행 표시의 n 번째 단계 원 */
const circle = (step: number) => screen.getByTestId(`join-step-${step}-circle`);

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
    // 첫 단계 이름은 마이·온보딩 모두 '요청 완료' 다 (#219, 사용자 확인 · 온보딩 Figma 3227:8846)
    expect(
      screen.getByLabelText(
        '진행 단계: 요청 완료, 다음은 사무실 검토 중, 참여 완료',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('요청 완료')).toBeOnTheScreen();
    expect(screen.queryByText('검토 중')).toBeNull();
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

  // 마이 요청완료(3235:14886)와 온보딩 승인 대기(3227:8824)는 안내·진행 표시·간격의 Figma 패널 값이 같다 (#212 로 온보딩을 맞춤).
  // 진행 표시는 원 40 둘레에 배경과 같은 흰색 6 을 두어 뒤의 선이 원에 닿지 않게 하고, 보이는 테두리는 없다 (#219)
  describe.each(['my', 'onboarding'] as const)(
    '안내·진행 표시·간격 (Figma 3235:14886 · 3227:8824) — %s',
    flow => {
      const renderFlow = () => renderRequested({ flow });

      it('아이콘 40 아래 24 에 제목, 제목–설명 6, 설명은 Body/XS/Medium Gray600 이다', async () => {
        await renderFlow();

        const title = screen.getByRole('header', {
          name: '참여 요청을 보냈어요',
        });
        expect(title).toHaveStyle({
          ...typography['Body/L/Bold'],
          color: colors.gray[900],
        });
        const texts = title.parent as HostElement;
        expect(texts).toHaveStyle({ gap: 6 });
        expect(texts.parent).toHaveStyle({ gap: 24 });
        const [icon] = (texts.parent as HostElement).children as HostElement[];
        expect(icon).toHaveStyle({ width: 40, height: 40 });
        expect(
          screen.getByText('사무실에서 요청을 확인하면 알려드릴게요.'),
        ).toHaveStyle({
          ...typography['Body/XS/Medium'],
          color: colors.gray[600],
        });
      });

      // 머리 아래 36 에서 시작 (Figma 152 − 머리 116), 안내–진행 24, 진행–요약 42, 요약–아래 문구 12
      it('세로 간격은 머리 아래 36, 안내–진행 24, 진행–요약 42, 요약–아래 문구 12 다', async () => {
        await renderFlow();

        const steps = screen.getByTestId('join-steps');
        expect(steps.parent).toHaveStyle({ gap: 24 });
        const footnote = screen.getByText(
          '승인 전까지 회사의 일정과 작업은 표시되지 않습니다.',
        );
        expect(footnote.parent).toHaveStyle({ gap: 12 });
        expect(footnote).toHaveStyle({
          ...typography['Caption/S/Medium'],
          color: colors.libraryGray[500],
        });
        let scroll = steps.parent;
        while (scroll && scroll.type !== 'RCTScrollView') {
          scroll = scroll.parent;
        }
        expect(
          StyleSheet.flatten(scroll?.props.contentContainerStyle),
        ).toMatchObject({ paddingTop: 36, paddingHorizontal: 24, gap: 42 });
      });

      // 원은 테두리 없이 칠한 40 이다. 둘레의 흰색 6 은 테두리가 아니라 원 뒤의 배경색 원판(52)이다.
      // 테두리(borderWidth)로 그리면 둥근 가장자리에 원 색이 번져 보이는 테두리가 생긴다 (#219).
      // 첫 원 체크 24, 숫자 Body/S/SemiBold 흰색, 단계 이름 Caption/M/SemiBold 는 원 아래 10
      it('진행 표시 원은 테두리 없는 40 이고, 선을 끊는 흰색 6 은 배경색 원판이다', async () => {
        await renderFlow();

        for (const step of [1, 2, 3]) {
          const node = circle(step);
          expect(node).toHaveStyle({ width: 40, height: 40, borderRadius: 20 });
          expect(stylePt(node, 'borderWidth')).toBe(0);
          const disc = node.parent as HostElement;
          expect(disc).toHaveStyle({
            width: 52,
            height: 52,
            borderRadius: 26,
            margin: -6,
            backgroundColor: colors.white[100],
          });
          expect(stylePt(disc, 'borderWidth')).toBe(0);
          expect(disc.parent).toHaveStyle({ gap: 10 });
        }
        expect(circle(1)).toHaveStyle({ backgroundColor: colors.secondary });
        expect(circle(2)).toHaveStyle({ backgroundColor: colors.gray[200] });
        const [check] = svgViewsDrawing(circle(1), iconSvgs.check.xml);
        expect(check.props).toMatchObject({ width: 24, height: 24 });
        expect(within(circle(2)).getByText('2')).toHaveStyle({
          ...typography['Body/S/SemiBold'],
          color: colors.white[100],
        });
        expect(screen.getByText('요청 완료')).toHaveStyle({
          ...typography['Caption/M/SemiBold'],
          color: colors.gray[700],
        });
        expect(screen.getByText('참여 완료')).toHaveStyle({
          ...typography['Caption/M/SemiBold'],
          color: colors.gray[500],
        });
      });

      // Figma Line 67: 1 두께 Gray200(#DEDEDE) 실선 한 줄, 원 위쪽에서 19–20 (원 가운데보다 0.5 위).
      // 첫 원 가운데에서 마지막 원 가운데까지 원 뒤로 지나가 원판 밖으로 나온 부분만 보인다. 단계 가운데 사이 117
      it('단계 사이 선은 1 두께 Gray200 한 줄이고, 단계 가운데 사이는 117 이다', async () => {
        await renderFlow();

        expect(screen.getByTestId('join-steps-line')).toHaveStyle({
          height: 1,
          top: 19,
          left: `${100 / 6}%`,
          right: `${100 / 6}%`,
          backgroundColor: colors.gray[200],
        });
        expect(screen.queryByTestId('join-steps-fill')).toBeNull();
        const step = circle(1).parent?.parent as HostElement;
        expect(step).toHaveStyle({ flex: 1 });
        const row = step.parent as HostElement;
        expect(row).toHaveStyle({ maxWidth: 117 * 3 });
        // 콘텐츠 폭 345 보다 6 넓은 351 을 세 칸으로 나눈다
        expect(row.parent).toHaveStyle({ marginHorizontal: -3 });
      });

      // 하단 탭 바 없이 연다 (#219). 아래 버튼 줄은 Figma 하단 바(3235:14892 · 3227:8830, 높이 102)대로
      // 버튼 위 14, 좌우 24, 버튼 사이 10, 버튼 아래 32 (홈 인디케이터. 안전 영역이 더 크면 그만큼)
      it('아래 버튼 줄은 탭 바 없는 Figma 하단 바(버튼 위 14, 아래 32)다', async () => {
        await renderFlow();

        expect(screen.getByRole('button', { name: '확인' }).parent).toHaveStyle(
          {
            paddingTop: 14,
            paddingHorizontal: 24,
            gap: 10,
          },
        );
        expect(screen.root?.props.edges).toEqual(
          expect.objectContaining({ top: 'maximum', bottom: 'maximum' }),
        );
        expect(screen.root).toHaveStyle({ paddingBottom: 32 });
      });
    },
  );

  // #199: 마이페이지 소속 카드의 검토 줄에서 연 요청. 맥락에 맞는 제목, 사무실 검토 중까지 채운 진행 표시, 상태 칩
  describe('마이페이지 검토 줄에서 연 경우 (#199)', () => {
    const renderReviewing = () =>
      renderRequested({
        stage: 'reviewing',
        request: { ...request, requestChannel: undefined },
      });

    // 신청 현황 화면 제목('참여 신청 현황')과 헷갈리지 않게, 같은 화면 온보딩 Figma(3227:8827)의 이 상태(승인 대기) 제목을 쓴다
    it('머리 제목은 조직 참여하기 대신 승인 대기다', async () => {
      await renderReviewing();

      expect(
        screen.getByRole('header', { name: '승인 대기' }),
      ).toBeOnTheScreen();
      expect(
        screen.queryByRole('header', { name: '조직 참여하기' }),
      ).toBeNull();
    });

    // 진행만 다르고 모양은 요청 완료와 같다: 둘째 원까지 Secondary 로 칠할 뿐, 단계 사이 선은 Figma 그대로 Gray200 한 줄이다.
    // 칠한 단계 사이에 색을 바꾼 선을 더 긋지 않고, 원에 테두리도 없다 (#219)
    it('진행 표시는 사무실 검토 중 단계까지 채우되, Figma 에 없는 선·테두리는 없다', async () => {
      await renderReviewing();

      expect(
        screen.getByLabelText(
          '진행 단계: 요청 완료, 사무실 검토 중, 다음은 참여 완료',
        ),
      ).toBeOnTheScreen();
      expect(circle(2)).toHaveStyle({ backgroundColor: colors.secondary });
      expect(circle(3)).toHaveStyle({ backgroundColor: colors.gray[200] });
      expect(screen.getByText('사무실 검토 중')).toHaveStyle({
        color: colors.gray[700],
      });
      expect(screen.queryByTestId('join-steps-fill')).toBeNull();
      expect(screen.getByTestId('join-steps-line')).toHaveStyle({
        height: 1,
        backgroundColor: colors.gray[200],
      });
      for (const step of [1, 2, 3]) {
        expect(stylePt(circle(step), 'borderWidth')).toBe(0);
        expect(stylePt(circle(step).parent as HostElement, 'borderWidth')).toBe(
          0,
        );
      }
    });

    // 칩 값은 마이페이지 소속 카드의 검토 칩(Figma 3235:17157)과 같다. 요약 카드 첫 줄 '상태' 오른쪽에 둔다
    it('요약 첫 줄에 상태 칩(검토)을 보인다', async () => {
      await renderReviewing();

      const row = screen.getByLabelText('상태, 검토');
      const chip = within(row).getByTestId('join-request-status');
      expect(chip).toHaveStyle({
        backgroundColor: colors.registered[2],
        minHeight: 21,
        paddingHorizontal: 8,
        borderRadius: 8,
      });
      expect(within(chip).getByText('검토')).toHaveStyle({
        ...typography['Caption/S/Medium'],
        color: colors.registered[1],
      });
      const card = row.parent as HostElement;
      expect(card.children[0]).toBe(row);
    });

    it('보낸 직후의 요청 완료에는 상태 칩이 없고 진행 표시는 첫 단계까지다', async () => {
      await renderRequested();

      expect(screen.queryByLabelText(/^상태,/)).toBeNull();
      expect(circle(2)).toHaveStyle({ backgroundColor: colors.gray[200] });
    });
  });
});
