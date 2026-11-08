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
import { ParticipationRequestGate } from './orgRoutes';

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
