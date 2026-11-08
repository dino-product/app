import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { AccessibilityInfo, Alert, NativeModules } from 'react-native';
import {
  fail,
  hang,
  networkError,
  ok,
  type FakeResponse,
  type FakeServer,
} from '../../../../shared/testing/fakeServer';
import { renderWithApi } from '../../../../shared/testing/renderWithApi';
import { expectOnlySkeletons } from '../../../../shared/testing/skeleton';
import { testSession } from '../../../../shared/testing/session';
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
    expect(screen.getAllByText('승인 대기')).toHaveLength(2);
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
      expect(screen.getByText('취소 중')).toBeOnTheScreen();
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

      expect(
        await screen.findByRole('button', { name: '한빛 설비 신청 취소' }),
      ).toBeEnabled();
      expect(screen.queryByText('취소 중')).toBeNull();
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
});
