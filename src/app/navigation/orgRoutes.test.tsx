import {
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Text } from 'react-native';
import type { ParticipationStatus } from '../../features/my/org/model';
import {
  parseParticipationRequest,
  PARTICIPATION_REQUESTS_PATH,
} from '../../features/my/org/participationApi';
import { participationRequestsKey } from '../../features/my/org/participationQueries';
import {
  createParticipationServer,
  EXISTING_REQUESTS,
  REJECT_REASON,
  type ServerParticipationRequest,
} from '../../features/my/org/testing';
import { networkError, ok } from '../../shared/testing/fakeServer';
import { createTestApi } from '../../shared/testing/renderWithApi';
import { expectOnlySkeletons } from '../../shared/testing/skeleton';
import { testSession } from '../../shared/testing/session';
import { JoinReviewRoute, ParticipationRequestGate } from './orgRoutes';
import type { MyScreenProps } from './types';

type ReviewProps = MyScreenProps<'OrgJoinReview'>;

// 참여 요청 하나를 그리는 화면(요청 완료·거절·참여 완료)의 문지기 (#116).
// 캐시는 옛 상태일 수 있다(대기였다가 거절됨, 다른 기기가 보낸 요청). 화면을 연 뒤 받은 서버 목록으로 판단한다
const rejected = EXISTING_REQUESTS[0]; // 요청 3, 거절
const asPending: ServerParticipationRequest = {
  ...rejected,
  status: 'PENDING',
  rejectReason: null,
  decidedAt: null,
};

function renderGate({
  cached,
  server: serverRequests = EXISTING_REQUESTS,
  requestId = '3',
  status = 'REJECTED',
}: {
  /** 화면을 열기 전 캐시에 있던 신청 현황 (없으면 받은 적 없음) */
  cached?: readonly ServerParticipationRequest[];
  server?: readonly ServerParticipationRequest[];
  requestId?: string;
  status?: ParticipationStatus;
}) {
  const participation = createParticipationServer({ requests: serverRequests });
  const api = createTestApi({
    server: participation.server,
    session: testSession(),
  });
  if (cached) {
    api.queryClient.setQueryData(
      participationRequestsKey,
      cached.map(parseParticipationRequest),
    );
  }
  const onMissing = jest.fn();
  const view = render(
    <ParticipationRequestGate
      requestId={requestId}
      status={status}
      title="조직 참여하기"
      onBack={jest.fn()}
      onMissing={onMissing}
    >
      {request => (
        <Text>
          {request.organizationName} {request.status} {request.rejectReason}
        </Text>
      )}
    </ParticipationRequestGate>,
    { wrapper: api.wrapper },
  );
  return view.then(() => ({ ...api, onMissing }));
}

const shown = (text: RegExp) => screen.findByText(text);

describe('ParticipationRequestGate', () => {
  it('캐시에 대기로 남은 요청이 그사이 거절됐으면 떠나지 않고 서버 결과(거절 사유)로 그린다', async () => {
    const { onMissing } = await renderGate({
      cached: [asPending, ...EXISTING_REQUESTS.slice(1)],
    });

    expect(await shown(/^스마트 홈케어 REJECTED/)).toHaveTextContent(
      `스마트 홈케어 REJECTED ${REJECT_REASON}`,
    );
    expect(onMissing).not.toHaveBeenCalled();
  });

  it('캐시에 없는 요청(다른 기기에서 보냄)도 서버에서 받아 그린다', async () => {
    const { onMissing } = await renderGate({
      cached: EXISTING_REQUESTS.slice(1),
    });

    expect(await shown(/^스마트 홈케어 REJECTED/)).toBeOnTheScreen();
    expect(onMissing).not.toHaveBeenCalled();
  });

  it('받는 동안에는 기본 스켈레톤(스피너 없음)을 보이고 떠나지 않는다', async () => {
    const { onMissing } = await renderGate({
      cached: [asPending],
      server: [rejected],
    });

    expectOnlySkeletons('load-state-skeleton');
    expect(onMissing).not.toHaveBeenCalled();
    await shown(/^스마트 홈케어 REJECTED/);
  });

  it('캐시에 이미 기대한 상태로 있으면 바로 그린다', async () => {
    await renderGate({ cached: EXISTING_REQUESTS });

    expect(screen.getByText(/^스마트 홈케어 REJECTED/)).toBeOnTheScreen();
  });

  it('이 화면을 연 뒤 받은 서버 목록에도 없으면 떠난다', async () => {
    const { onMissing } = await renderGate({
      cached: EXISTING_REQUESTS,
      requestId: '404',
    });

    await waitFor(() => expect(onMissing).toHaveBeenCalledTimes(1));
  });

  it('서버 목록에서도 기대한 상태가 아니면 떠난다', async () => {
    const { onMissing } = await renderGate({
      cached: [asPending],
      server: [asPending],
    });

    await waitFor(() => expect(onMissing).toHaveBeenCalledTimes(1));
  });

  it('서버 목록을 받지 못하면 떠나지 않고 오류와 다시 시도를 보이며, 다시 받으면 그린다', async () => {
    const participation = createParticipationServer();
    participation.server.on(
      'GET',
      PARTICIPATION_REQUESTS_PATH,
      networkError(),
      ok({ requests: EXISTING_REQUESTS }),
    );
    const api = createTestApi({
      server: participation.server,
      session: testSession(),
    });
    api.queryClient.setQueryData(
      participationRequestsKey,
      [asPending].map(parseParticipationRequest),
    );
    const onMissing = jest.fn();
    await render(
      <ParticipationRequestGate
        requestId="3"
        status="REJECTED"
        title="조직 참여하기"
        onBack={jest.fn()}
        onMissing={onMissing}
      >
        {request => <Text>{request.status}</Text>}
      </ParticipationRequestGate>,
      { wrapper: api.wrapper },
    );

    expect(
      await screen.findByText('참여 요청을 불러오지 못했어요.'),
    ).toBeOnTheScreen();
    expect(onMissing).not.toHaveBeenCalled();
    await userEvent.press(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('REJECTED')).toBeOnTheScreen();
    expect(onMissing).not.toHaveBeenCalled();
  });
});

// #199: 마이페이지 검토 줄에서 연 승인 대기 요청. 신청을 취소하면 요청이 승인 대기에서 빠져 게이트의 '없는 요청' 과
// 취소 결과가 함께 온다. 어느 쪽이 먼저든 마이페이지로 한 번만 돌아가고, 탭 내비게이터까지 올라가는 뒤로 가기는 쓰지 않는다
describe('JoinReviewRoute', () => {
  const pending = EXISTING_REQUESTS[1]; // 요청 1, 한빛 설비, 승인 대기

  function renderReview() {
    const participation = createParticipationServer({
      requests: EXISTING_REQUESTS,
    });
    const api = createTestApi({
      server: participation.server,
      session: testSession(),
    });
    // 마이 스택에 마이페이지만 남은 뒤에도 canGoBack 은 탭 내비게이터를 보고 true 다 (backBehavior firstRoute)
    const navigation = {
      addListener: jest.fn(() => () => {}),
      canGoBack: jest.fn(() => true),
      goBack: jest.fn(),
      navigate: jest.fn(),
      popTo: jest.fn(),
      dispatch: jest.fn(),
      isFocused: jest.fn(() => true),
    };
    const route = {
      key: 'OrgJoinReview-1',
      name: 'OrgJoinReview' as const,
      params: { requestId: String(pending.requestId) },
    };
    return render(
      <JoinReviewRoute
        navigation={navigation as unknown as ReviewProps['navigation']}
        route={route}
      />,
      { wrapper: api.wrapper },
    ).then(() => ({ navigation }));
  }

  /** 떠나기로 보낸 스택 바꾸기를 이 스택 상태에 적용한 결과 */
  const leaveFrom = (
    navigation: { dispatch: jest.Mock },
    routes: { key: string; name: string }[],
  ) => {
    const [[toAction]] = navigation.dispatch.mock.calls as [
      [(state: object) => { payload: { routes: unknown[]; index: number } }],
    ];
    return toAction({
      key: 'my-stack',
      type: 'stack',
      stale: false,
      routeNames: ['MyPage', 'OrgJoinReview', 'OrgJoinRejected'],
      index: routes.length - 1,
      routes,
    }).payload;
  };
  const myPage = { key: 'MyPage-0', name: 'MyPage' };
  const review = { key: 'OrgJoinReview-1', name: 'OrgJoinReview' };

  it('신청을 취소하면 이 화면만 스택에서 한 번 빼고, 뒤로 가기·popTo 는 보내지 않는다', async () => {
    const { navigation } = await renderReview();

    await userEvent.press(
      await screen.findByRole('button', { name: '신청 취소' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '취소' }));

    await waitFor(() => expect(navigation.dispatch).toHaveBeenCalled());
    // 취소 결과와 '승인 대기가 아님' 이 모두 처리될 때까지 기다린다
    await waitFor(() =>
      expect(screen.queryByText('한빛 설비')).not.toBeOnTheScreen(),
    );
    expect(navigation.dispatch).toHaveBeenCalledTimes(1);
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(navigation.popTo).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(leaveFrom(navigation, [myPage, review])).toMatchObject({
      routes: [myPage],
      index: 0,
    });
  });

  // 리뷰(#210): 위에 쌓인 화면(알림으로 연 같은 요청의 거절 화면 등)은 그대로 둔다
  it('위에 다른 화면이 쌓여 있으면 그 화면은 남기고 이 화면만 뺀다', async () => {
    const { navigation } = await renderReview();
    await userEvent.press(
      await screen.findByRole('button', { name: '신청 취소' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '취소' }));
    await waitFor(() => expect(navigation.dispatch).toHaveBeenCalled());

    const rejectedRoute = {
      key: 'OrgJoinRejected-1',
      name: 'OrgJoinRejected',
    };
    expect(
      leaveFrom(navigation, [myPage, review, rejectedRoute]),
    ).toMatchObject({
      routes: [myPage, rejectedRoute],
      index: 1,
    });
  });
});
