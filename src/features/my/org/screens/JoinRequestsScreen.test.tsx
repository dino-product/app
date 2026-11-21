import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Alert,
  NativeModules,
  StyleSheet,
} from 'react-native';
import {
  colors,
  typography,
  withOpacity,
} from '../../../../shared/design-system';
import { iconSvgs } from '../../../../shared/design-system/icons/svgs';
import {
  fail,
  hang,
  networkError,
  ok,
  type FakeResponse,
  type FakeServer,
} from '../../../../shared/testing/fakeServer';
import { READABLE_MAX_WIDTH } from '../../../../shared/layout/readableColumn';
import { renderWithApi } from '../../../../shared/testing/renderWithApi';
import { expectOnlySkeletons } from '../../../../shared/testing/skeleton';
import { testSession } from '../../../../shared/testing/session';
import {
  stylePt,
  type HostElement,
} from '../../../../shared/testing/touchTarget';
import {
  cancelRequestPath,
  PARTICIPATION_REQUESTS_PATH,
} from '../participationApi';
import {
  createParticipationServer,
  EXISTING_REQUESTS,
  type ServerParticipationRequest,
} from '../testing';
import { JoinRequestsScreen } from './JoinRequestsScreen';

// 신청 현황은 가짜 서버(src/features/my/org/testing)의 목록이다: 거절 1(스마트 홈케어), 승인 대기 2(한빛 설비 1, 그린 테크 2)

// 바텀시트 애니메이션(프리셋의 네이티브 애니메이션 목)은 테스트가 끝낸다
let runningAnimations: Array<(result: { finished: boolean }) => void> = [];
const finishAnimations = () =>
  act(() => {
    runningAnimations.splice(0).forEach(end => end({ finished: true }));
  });

function renderRequests(
  requests: readonly ServerParticipationRequest[] = EXISTING_REQUESTS,
) {
  const participation = createParticipationServer({ requests });
  const props = { onJoin: jest.fn(), onBack: jest.fn() };
  return renderWithApi(<JoinRequestsScreen {...props} />, {
    server: participation.server,
    session: testSession(),
  }).then(view => ({ ...view, props, participation }));
}

const sheetTitle = (name: string) =>
  screen.queryByRole('header', { name: `${name} 참여 신청을 취소할까요?` });
const listCalls = (server: FakeServer) =>
  server.callsTo('GET', PARTICIPATION_REQUESTS_PATH);
const pullToRefresh = () =>
  fireEvent(screen.getByTestId('join-requests-list'), 'refresh');
// 목록은 받은 데이터로 그릴 범위를 묶어서(50ms) 고친다. 그 예약을 테스트 안(act)에서 끝내 테스트가 끝난 뒤 갱신되지 않게 한다
const settleList = () =>
  act(() => new Promise<void>(resolve => setTimeout(resolve, 100)));

/** 신청 취소 X 의 색 (Figma ci:close-md #585858) */
const CLOSE_COLOR = colors.gray[700];
const descendants = (element: HostElement): HostElement[] =>
  element.children.flatMap(child =>
    typeof child === 'string' ? [] : [child, ...descendants(child)],
  );
/** 아이콘 버튼 안의 SVG */
const svgOf = (element: HostElement) => {
  const svg = descendants(element).find(item => item.props.xml !== undefined);
  if (!svg) {
    throw new Error('아이콘 SVG 가 없습니다');
  }
  return svg;
};

async function cancelFromSheet(name: string) {
  await userEvent.press(
    await screen.findByRole('button', { name: `${name} 신청 취소` }),
  );
  await userEvent.press(screen.getByRole('button', { name: '취소' }));
}

describe('JoinRequestsScreen', () => {
  beforeEach(() => {
    runningAnimations = [];
    jest
      .spyOn(NativeModules.NativeAnimatedModule, 'startAnimatingNode')
      .mockImplementation((...args: unknown[]) => {
        runningAnimations.push(
          args[3] as (result: { finished: boolean }) => void,
        );
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('서버 목록의 승인 대기 요청만 승인 대기 n 과 카드로 보여준다', async () => {
    await renderRequests();

    expect(
      await screen.findByRole('header', { name: '승인 대기 2' }),
    ).toBeOnTheScreen();
    await settleList();
    expect(
      screen.getByRole('header', { name: '참여 신청 현황' }),
    ).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^join-request-/)).toHaveLength(2);
    expect(screen.getByText('한빛 설비')).toBeOnTheScreen();
    expect(screen.getByText('그린 테크')).toBeOnTheScreen();
    expect(screen.queryByText('스마트 홈케어')).toBeNull();
    // 카드의 승인 대기 칩은 Figma 에서 빠졌다 (#200)
    expect(screen.queryByText('승인 대기')).toBeNull();
    expect(
      screen.getAllByText(/^희망 유형 기사 · 2026-09-23 신청$/),
    ).toHaveLength(2);
    expect(screen.getAllByText('사무실에서 검토 중이에요')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: '조직 참여하기' }),
    ).toBeOnTheScreen();
  });

  it('받는 동안에는 빈 상태 대신 신청 카드를 닮은 스켈레톤을 보여준다 (스피너 없음)', async () => {
    const participation = createParticipationServer();
    participation.server.on('GET', PARTICIPATION_REQUESTS_PATH, hang());
    await renderWithApi(
      <JoinRequestsScreen onJoin={jest.fn()} onBack={jest.fn()} />,
      { server: participation.server, session: testSession() },
    );

    expectOnlySkeletons('join-requests-skeleton');
    expect(screen.queryByText('참여 신청 내역이 없어요')).toBeNull();
    expect(screen.queryByRole('button', { name: '조직 참여하기' })).toBeNull();
  });

  it('신청이 없으면 빈 상태와 조직 참여하기를 보여준다', async () => {
    const { props } = await renderRequests([]);

    expect(
      await screen.findByText('참여 신청 내역이 없어요'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '회사 코드나 참여 링크·QR로 조직에 참여를\n신청해 보세요.',
      ),
    ).toBeOnTheScreen();
    await userEvent.press(
      screen.getByRole('button', { name: '조직 참여하기' }),
    );
    expect(props.onJoin).toHaveBeenCalledTimes(1);
  });

  it('승인 대기가 아닌 요청(거절·취소·승인)만 있어도 빈 상태다', async () => {
    await renderRequests([EXISTING_REQUESTS[0]]);

    expect(
      await screen.findByText('참여 신청 내역이 없어요'),
    ).toBeOnTheScreen();
  });

  it('받지 못하면 오류와 다시 시도를 보여주고, 다시 시도하면 목록이 보인다', async () => {
    const participation = createParticipationServer({
      requests: EXISTING_REQUESTS,
    });
    const list = ok({ requests: EXISTING_REQUESTS });
    participation.server.on(
      'GET',
      PARTICIPATION_REQUESTS_PATH,
      networkError(),
      list,
    );
    await renderWithApi(
      <JoinRequestsScreen onJoin={jest.fn()} onBack={jest.fn()} />,
      { server: participation.server, session: testSession() },
    );

    expect(
      await screen.findByText('신청 현황을 불러오지 못했어요.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('참여 신청 내역이 없어요')).toBeNull();
    await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

    expect(
      await screen.findByRole('header', { name: '승인 대기 2' }),
    ).toBeOnTheScreen();
  });

  describe('당겨서 새로고침', () => {
    it('당기면 서버 목록을 다시 받아 바뀐 상태를 보여준다', async () => {
      const { server, participation } = await renderRequests();
      await screen.findByRole('header', { name: '승인 대기 2' });
      participation.decide({ status: 'APPROVED' }, 2);

      await pullToRefresh();

      expect(
        await screen.findByRole('header', { name: '승인 대기 1' }),
      ).toBeOnTheScreen();
      expect(screen.queryByText('그린 테크')).toBeNull();
      expect(listCalls(server)).toHaveLength(2);
    });

    it('새로 받는 동안 당김 표시를 켜고, 끝나면 끈다', async () => {
      const { server } = await renderRequests();
      await screen.findByRole('header', { name: '승인 대기 2' });
      let release: (response: FakeResponse) => void = () => {};
      server.on(
        'GET',
        PARTICIPATION_REQUESTS_PATH,
        () =>
          new Promise<FakeResponse>(done => {
            release = done;
          }),
      );
      const list = () => screen.getByTestId('join-requests-list');

      // 새로고침이 끝날 때까지 기다리지 않고 당긴 동안의 모습을 본다
      const pulling = pullToRefresh();
      await waitFor(() => expect(list()).toHaveProp('refreshing', true));
      await act(async () => release(ok({ requests: EXISTING_REQUESTS })));
      await pulling;

      expect(list()).toHaveProp('refreshing', false);
    });

    it('빈 상태에서도 당겨서 새로고침할 수 있다', async () => {
      const { participation } = await renderRequests([]);
      await screen.findByText('참여 신청 내역이 없어요');
      participation.server.on(
        'GET',
        PARTICIPATION_REQUESTS_PATH,
        ok({ requests: EXISTING_REQUESTS }),
      );

      await pullToRefresh();

      expect(
        await screen.findByRole('header', { name: '승인 대기 2' }),
      ).toBeOnTheScreen();
    });

    it('새로 받지 못하면 알리고 보던 목록은 남긴다', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { server } = await renderRequests();
      await screen.findByRole('header', { name: '승인 대기 2' });
      server.on('GET', PARTICIPATION_REQUESTS_PATH, fail(500, 'COMMON-500'));

      await pullToRefresh();

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '목록을 새로 고치지 못했어요',
          '잠시 후 다시 시도해 주세요.',
        ),
      );
      expect(screen.getAllByTestId(/^join-request-/)).toHaveLength(2);
    });
  });

  describe('신청 취소', () => {
    it('카드의 신청 취소를 누르면 그 회사 이름의 바텀시트가 뜬다', async () => {
      await renderRequests();

      await userEvent.press(
        await screen.findByRole('button', { name: '그린 테크 신청 취소' }),
      );

      expect(sheetTitle('그린 테크')).toBeOnTheScreen();
      expect(
        screen.getByText(
          '취소하면 사무실의 승인 대기 목록에서도 사라져요.\n같은 회사 코드로 언제든 다시 신청할 수 있어요.',
        ),
      ).toBeOnTheScreen();
    });

    it('시트의 취소를 누르면 서버에 취소하고, 그 신청은 목록에서 빠진다', async () => {
      const { server, participation } = await renderRequests();

      await cancelFromSheet('그린 테크');
      await finishAnimations();

      expect(
        await screen.findByRole('header', { name: '승인 대기 1' }),
      ).toBeOnTheScreen();
      expect(sheetTitle('그린 테크')).toBeNull();
      expect(screen.queryByText('그린 테크')).toBeNull();
      expect(server.callsTo('POST', cancelRequestPath('2'))).toHaveLength(1);
      expect(
        participation.requests.find(item => item.requestId === 2)?.status,
      ).toBe('CANCELED');
    });

    it('마지막 신청을 취소하면 빈 상태가 된다', async () => {
      await renderRequests();

      for (const name of ['한빛 설비', '그린 테크']) {
        await cancelFromSheet(name);
        await finishAnimations();
      }

      expect(
        await screen.findByText('참여 신청 내역이 없어요'),
      ).toBeOnTheScreen();
    });

    // 취소한 카드가 사라져 스크린리더가 돌아갈 곳을 잃지 않게 목록 제목으로 옮기고 알린다
    it('서버가 취소를 받고 시트가 내려가면 알리고 포커스를 목록 제목으로 옮긴다', async () => {
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockClear();
      const focus = jest
        .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
        .mockClear();
      await renderRequests();

      await cancelFromSheet('그린 테크');
      await screen.findByRole('header', { name: '승인 대기 1' });
      expect(announce).not.toHaveBeenCalled();
      await finishAnimations();

      expect(announce).toHaveBeenCalledWith('그린 테크 참여 신청을 취소했어요');
      expect(focus).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({ accessibilityRole: 'header' }),
        }),
        'focus',
      );
    });

    // 서버가 답하기 전에 같은 신청을 다시 취소하면 두 번째는 -017 로 '이미 처리된 요청' 오안내가 된다
    it('취소를 보내는 동안 그 카드는 취소 중으로 잠겨 다시 취소할 수 없다', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { server, participation } = await renderRequests();
      let release: (response: FakeResponse) => void = () => {};
      server.on(
        'POST',
        cancelRequestPath('1'),
        () =>
          new Promise<FakeResponse>(done => {
            // 서버가 취소를 처리하고 답한다
            release = response => {
              const held = participation.requests.find(
                item => item.requestId === 1,
              );
              if (held) {
                held.status = 'CANCELED';
              }
              done(response);
            };
          }),
      );

      await cancelFromSheet('한빛 설비');
      await finishAnimations();

      const busy = screen.getByRole('button', {
        name: '한빛 설비 신청 취소 중',
      });
      expect(busy).toBeDisabled();
      // 보내는 동안 X 는 흐린 회색이다 (Figma 미확인)
      expect(svgOf(busy).props.color).toBe(colors.gray[400]);
      await userEvent.press(busy);
      expect(sheetTitle('한빛 설비')).toBeNull();
      // 다른 신청은 그대로 취소할 수 있다
      expect(
        screen.getByRole('button', { name: '그린 테크 신청 취소' }),
      ).toBeEnabled();

      await act(async () =>
        release(
          ok({
            requestId: 1,
            organizationId: 10,
            organizationName: '한빛 설비',
            desiredType: 'TECHNICIAN',
            status: 'CANCELED',
            requestedAt: '2026-09-23T01:24:00Z',
          }),
        ),
      );
      expect(
        await screen.findByRole('header', { name: '승인 대기 1' }),
      ).toBeOnTheScreen();
      expect(server.callsTo('POST', cancelRequestPath('1'))).toHaveLength(1);
      expect(alert).not.toHaveBeenCalled();
    });

    it('취소하지 못하면 그 카드의 잠금을 풀어 다시 취소할 수 있다', async () => {
      jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { server } = await renderRequests();
      server.on('POST', cancelRequestPath('1'), networkError());

      await cancelFromSheet('한빛 설비');
      await finishAnimations();

      const button = await screen.findByRole('button', {
        name: '한빛 설비 신청 취소',
      });
      expect(button).toBeEnabled();
      expect(svgOf(button).props.color).toBe(CLOSE_COLOR);
    });

    it('시트가 먼저 내려가도 서버가 취소를 받은 뒤에 알린다', async () => {
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockClear();
      const { server } = await renderRequests();
      let release: (response: FakeResponse) => void = () => {};
      server.on(
        'POST',
        cancelRequestPath('2'),
        () =>
          new Promise<FakeResponse>(done => {
            release = done;
          }),
      );

      await cancelFromSheet('그린 테크');
      await finishAnimations();
      expect(announce).not.toHaveBeenCalled();
      await act(async () =>
        release(
          ok({
            requestId: 2,
            organizationId: 11,
            organizationName: '그린 테크',
            desiredType: 'TECHNICIAN',
            status: 'CANCELED',
            requestedAt: '2026-09-23T03:10:00Z',
          }),
        ),
      );

      expect(announce).toHaveBeenCalledWith('그린 테크 참여 신청을 취소했어요');
    });

    // 사무실이 그사이 승인·거절했다
    it('이미 처리된 요청(409 ORGANIZATION-017)이면 알리고 목록을 다시 불러와 서버 상태로 맞춘다', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockClear();
      const { server, participation } = await renderRequests();
      await screen.findByRole('header', { name: '승인 대기 2' });
      participation.decide({ status: 'APPROVED' }, 2);

      await cancelFromSheet('그린 테크');
      await finishAnimations();

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '이미 처리된 요청이에요',
          '사무실이 이미 결정했거나 취소된 요청이라 취소할 수 없어요.',
        ),
      );
      expect(
        await screen.findByRole('header', { name: '승인 대기 1' }),
      ).toBeOnTheScreen();
      expect(listCalls(server)).toHaveLength(2);
      expect(announce).not.toHaveBeenCalled();
    });

    it('취소하지 못하면(네트워크 등) 알리고 그 신청은 목록에 남는다', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { server } = await renderRequests();
      server.on('POST', cancelRequestPath('2'), networkError());

      await cancelFromSheet('그린 테크');
      await finishAnimations();

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          '신청을 취소하지 못했어요',
          '잠시 후 다시 시도해 주세요.',
        ),
      );
      expect(screen.getByText('그린 테크')).toBeOnTheScreen();
      expect(
        screen.getByRole('header', { name: '승인 대기 2' }),
      ).toBeOnTheScreen();
    });

    it('닫기·배경으로 닫으면 서버에 보내지 않는다', async () => {
      const { server } = await renderRequests();

      await userEvent.press(
        await screen.findByRole('button', { name: '한빛 설비 신청 취소' }),
      );
      await userEvent.press(screen.getByRole('button', { name: '닫기' }));
      await finishAnimations();
      expect(sheetTitle('한빛 설비')).toBeNull();

      await userEvent.press(
        screen.getByRole('button', { name: '한빛 설비 신청 취소' }),
      );
      await userEvent.press(
        screen.getByTestId('cancel-request-sheet-backdrop', {
          includeHiddenElements: true,
        }),
      );
      await finishAnimations();

      expect(sheetTitle('한빛 설비')).toBeNull();
      expect(server.callsTo('POST', cancelRequestPath('1'))).toHaveLength(0);
      expect(screen.getAllByTestId(/^join-request-/)).toHaveLength(2);
    });
  });

  // #200: Figma 마이페이지-신청현황 (2874:14773 목록 / 2880:15194 빈 상태) 의 바뀐 컴포넌트 패널 값
  describe('Figma 패널 값 (#200)', () => {
    const card = () => screen.getByTestId('join-request-1');

    // 2880:15120: 흰 바탕 · Gray200 테두리 1 · 모서리 16 · 안 여백 20 · 줄 사이 6
    it('신청 카드는 흰 바탕, Gray200 테두리 1, 모서리 16, 안 여백 20, 줄 사이 6 이다', async () => {
      await renderRequests();
      await screen.findByRole('header', { name: '승인 대기 2' });
      await settleList();

      expect(card()).toHaveStyle({
        backgroundColor: colors.white[100],
        borderWidth: 1,
        borderColor: colors.gray[200],
        borderRadius: 16,
        padding: 20,
        gap: 6,
      });
    });

    // 2880:15124 · 2880:15125: 이름 Body/S/SemiBold Gray900, 아래 6 에 희망 유형·신청일 Caption/M/Medium Gray600
    it('회사 이름은 Body/S/SemiBold, 그 아래 6 에 희망 유형·신청일이 Caption/M/Medium Gray600 이다', async () => {
      await renderRequests();
      await screen.findByRole('header', { name: '승인 대기 2' });
      await settleList();

      const name = within(card()).getByText('한빛 설비');
      expect(name).toHaveStyle({
        ...typography['Body/S/SemiBold'],
        color: colors.gray[900],
      });
      expect(name.parent).toHaveStyle({ gap: 6 });
      expect(
        within(card()).getByText('희망 유형 기사 · 2026-09-23 신청'),
      ).toHaveStyle({
        ...typography['Caption/M/Medium'],
        color: colors.gray[600],
      });
    });

    // 50927:15189 ci:close-md: 신청 취소는 승인 대기 칩·'신청 취소' 글자 대신 오른쪽 위 X(24, #585858)
    it('신청 취소는 카드 오른쪽 위의 X 아이콘(Figma ci:close-md) 버튼이다', async () => {
      await renderRequests();
      await screen.findByRole('header', { name: '승인 대기 2' });
      await settleList();

      const close = within(card()).getByRole('button', {
        name: '한빛 설비 신청 취소',
      });
      const svg = svgOf(close);
      expect(svg.props.xml).toBe(iconSvgs['close-md'].xml);
      expect(svg.props).toMatchObject({
        width: 24,
        height: 24,
        color: CLOSE_COLOR,
      });
      expect(within(card()).queryByText('신청 취소')).toBeNull();
      // X 는 이름 줄과 같은 줄의 오른쪽 끝이다
      expect(close.parent).toHaveStyle({
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      });
    });

    // 2880:15131: Caption/M/Medium, 변수 Type Color/-Blue (#618EED)
    it('사무실에서 검토 중이에요는 Caption/M/Medium Type Color Blue 다', async () => {
      await renderRequests();
      await screen.findByRole('header', { name: '승인 대기 2' });
      await settleList();

      expect(within(card()).getByText('사무실에서 검토 중이에요')).toHaveStyle({
        ...typography['Caption/M/Medium'],
        color: colors.typeColor.blue,
      });
    });

    // 2880:15160: 머리 아래 12 에 '승인 대기 n' Body/S/SemiBold Gray900, 아래 12 에 첫 카드 (165 − 128 − 25)
    it('승인 대기 n 은 머리 아래 12 에서 시작하고 첫 카드와 12 떨어진다', async () => {
      await renderRequests();
      const title = await screen.findByRole('header', { name: '승인 대기 2' });
      await settleList();

      expect(title).toHaveStyle({
        ...typography['Body/S/SemiBold'],
        color: colors.gray[900],
        marginBottom: 12,
      });
      const list = screen.getByTestId('join-requests-list');
      expect(
        StyleSheet.flatten(list.props.contentContainerStyle),
      ).toMatchObject({ paddingTop: 12, paddingHorizontal: 24 });
    });

    // 2880:15074: 아래 버튼 자리는 목록 위에 겹친 그라데이션(#F5F6F8, 위 6.1% 투명 → 57.1% 불투명, 탭 바 포함 185)이고
    // 버튼은 그 위 3, 탭 바 위 24 다. 앱은 탭 바 위에서 끝나므로 보이는 83 만 그린다. 목록은 그만큼 아래를 비운다
    it('조직 참여하기는 목록 위에 겹친 그라데이션 자리에 있고, 위 3 · 아래 24 다', async () => {
      await renderRequests();
      await screen.findByRole('header', { name: '승인 대기 2' });
      await settleList();

      const cta = screen.getByRole('button', { name: '조직 참여하기' });
      const column = cta.parent as HostElement;
      const actions = column.parent as HostElement;
      expect(actions).toHaveStyle({
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 3,
        paddingBottom: 24,
      });
      const fade = String(
        StyleSheet.flatten(actions.props.style).backgroundImage,
      );
      expect(fade).toContain(withOpacity('#F5F6F8', 0));
      expect(fade).toContain('rgba(245, 246, 248, 0.76)');
      expect(actions.props.pointerEvents).toBe('box-none');
      const list = screen.getByTestId('join-requests-list');
      expect(
        StyleSheet.flatten(list.props.contentContainerStyle),
      ).toMatchObject({ paddingBottom: 3 + 56 + 24 + 24 });
    });

    // 리뷰(#210): 넓은 창(648 초과)에서도 버튼 폭이 카드 폭과 같도록, 버튼은 목록과 같은 기둥(최대 600, 좌우 24) 안에 둔다
    it('조직 참여하기는 목록과 같은 읽기 기둥(최대 600)에 좌우 24 안쪽이다', async () => {
      await renderRequests();
      await screen.findByRole('header', { name: '승인 대기 2' });
      await settleList();

      const cta = screen.getByRole('button', { name: '조직 참여하기' });
      const column = cta.parent as HostElement;
      const list = StyleSheet.flatten(
        screen.getByTestId('join-requests-list').props.contentContainerStyle,
      );
      expect(column).toHaveStyle({
        maxWidth: READABLE_MAX_WIDTH,
        alignSelf: 'center',
        paddingHorizontal: 24,
      });
      expect(list).toMatchObject({
        maxWidth: READABLE_MAX_WIDTH,
        paddingHorizontal: 24,
      });
      expect(StyleSheet.flatten(cta.props.style).maxWidth).toBeUndefined();
      expect(column.parent).not.toHaveStyle({ paddingHorizontal: 24 });
    });

    // 2880:15194 › 3278:23404: 문서 아이콘(famicons:document 40, #CECECE) 아래 24 에 제목 Body/M/SemiBold Primary,
    // 12 아래 설명 Caption/M/Medium Gray600, 그 아래 40 에 조직 참여하기
    it('빈 상태는 Figma 문서 아이콘 40 · 제목 Body/M/SemiBold Primary · 간격 24/12/40 이다', async () => {
      await renderRequests([]);

      const title = await screen.findByText('참여 신청 내역이 없어요');
      expect(title).toHaveStyle({
        ...typography['Body/M/SemiBold'],
        color: colors.primary,
      });
      const texts = title.parent as HostElement;
      expect(texts).toHaveStyle({ gap: 12 });
      const empty = texts.parent as HostElement;
      expect(empty).toHaveStyle({ gap: 24 });
      const icon = svgOf(empty.children[0] as HostElement);
      expect(icon.props.xml).toBe(iconSvgs['document-fill'].xml);
      expect(icon.props).toMatchObject({
        width: 40,
        height: 40,
        color: colors.gray[300],
      });
      expect(
        screen.getByText(
          '회사 코드나 참여 링크·QR로 조직에 참여를\n신청해 보세요.',
        ),
      ).toHaveStyle({
        ...typography['Caption/M/Medium'],
        color: colors.gray[600],
      });
      const cta = screen.getByRole('button', { name: '조직 참여하기' });
      expect(stylePt(cta, 'marginTop') + stylePt(empty, 'gap')).toBe(40);
    });

    // 2889:13037: 제목 Heading/XS(Bold 20, 자간 0) Gray800(#222), 설명 Caption/M/Regular Gray600, 설명–버튼 24 + 10, 버튼 사이 10
    it('신청 취소 시트는 제목 Heading/XS, 설명 Caption/M/Regular, 설명–버튼 34, 버튼 사이 10 이다', async () => {
      await renderRequests();
      await userEvent.press(
        await screen.findByRole('button', { name: '한빛 설비 신청 취소' }),
      );

      const title = sheetTitle('한빛 설비') as HostElement;
      expect(title).toHaveStyle({
        ...typography['Heading/XS'],
        color: colors.gray[900],
      });
      const message = screen.getByText(
        '취소하면 사무실의 승인 대기 목록에서도 사라져요.\n같은 회사 코드로 언제든 다시 신청할 수 있어요.',
      );
      expect(message).toHaveStyle({
        ...typography['Caption/M/Regular'],
        color: colors.gray[600],
      });
      expect(title.parent).toHaveStyle({ gap: 12, marginBottom: 34 });
      expect(screen.getByRole('button', { name: '닫기' }).parent).toHaveStyle({
        gap: 10,
      });
      // 2935:15477 · 3100:2905: 버튼 높이 56 (CTA L)
      for (const name of ['닫기', '취소']) {
        expect(screen.getByRole('button', { name })).toHaveStyle({
          minHeight: 56,
        });
      }
    });

    // 받는 동안의 스켈레톤은 Figma 에 없어 바뀐 카드와 같은 상자로 그린다
    it('받는 동안의 스켈레톤은 바뀐 카드·제목 자리와 같다', async () => {
      const participation = createParticipationServer();
      participation.server.on('GET', PARTICIPATION_REQUESTS_PATH, hang());
      await renderWithApi(
        <JoinRequestsScreen onJoin={jest.fn()} onBack={jest.fn()} />,
        { server: participation.server, session: testSession() },
      );

      const skeleton = screen.getByTestId('join-requests-skeleton');
      expect(skeleton).toHaveStyle({ paddingHorizontal: 24, paddingTop: 12 });
      const [title, cards] = skeleton.children as HostElement[];
      expect(title).toHaveStyle({ marginBottom: 12 });
      const [first] = cards.children as HostElement[];
      expect(first).toHaveStyle({
        borderWidth: 1,
        borderColor: colors.gray[200],
        borderRadius: 16,
        padding: 20,
        gap: 6,
      });
      // 오른쪽 위 X 자리 24
      expect(
        descendants(first).some(item => {
          const style = StyleSheet.flatten(item.props.style);
          return style?.width === 24 && style?.height === 24;
        }),
      ).toBe(true);
    });
  });
});
