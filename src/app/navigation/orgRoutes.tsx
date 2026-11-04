import { CommonActions } from '@react-navigation/native';
import { useCallback, useEffect, type ReactElement, type Ref } from 'react';
import type { TextInstance } from 'react-native';
import { LoadStateScreen } from '../../features/my/org/components/LoadState';
import type {
  JoinFlow,
  ParticipationRequest,
  ParticipationStatus,
} from '../../features/my/org/model';
import { useParticipationRequest } from '../../features/my/org/participationQueries';
import { JoinRejectedScreen } from '../../features/my/org/screens/JoinRejectedScreen';
import { JoinRequestedScreen } from '../../features/my/org/screens/JoinRequestedScreen';
import { JoinRequestsScreen } from '../../features/my/org/screens/JoinRequestsScreen';
import { OrgJoinScreen } from '../../features/my/org/screens/OrgJoinScreen';
import { RoleSelectScreen } from '../../features/my/org/screens/RoleSelectScreen';
import { useFocusTitleOnOpen } from './routes';
import {
  MY_INITIAL_ROUTE,
  type MyScreenProps,
  type MyStackParamList,
} from './types';

// 마이 › 조직 참여 화면들 (#73). 서버 상태(회사 확인·참여 요청·취소·신청 현황, #116)는 화면이 participationQueries 로
// 읽고 보내며, 여기서는 화면 사이 이동을 잇는다

/**
 * 신청 현황에서 찾은 참여 요청 하나로 화면을 그린다 (요청 완료·거절·참여 완료).
 * 받는 동안·받지 못했을 때는 같은 머리 제목의 자리를 보이고, 목록에 없거나(이미 처리돼 사라짐·잘못된 id)
 * 기대한 상태가 아니면 빈 화면 대신 onMissing 으로 떠난다. onMissing 은 바뀌지 않는 함수여야 한다
 */
export function ParticipationRequestGate({
  requestId,
  status,
  flow = 'my',
  title,
  onBack,
  onMissing,
  titleRef,
  children,
}: {
  requestId: string;
  /** 이 상태의 요청만 그린다 (거절 화면은 REJECTED). 없으면 상태를 보지 않는다 */
  status?: ParticipationStatus;
  flow?: JoinFlow;
  /** 받는 동안·받지 못했을 때의 머리 제목 (그릴 화면의 제목) */
  title: string;
  onBack: () => void;
  onMissing: () => void;
  titleRef?: Ref<TextInstance>;
  children: (request: ParticipationRequest) => ReactElement;
}) {
  const query = useParticipationRequest(requestId);
  const request = query.data;
  const missing =
    request === null ||
    (request !== undefined &&
      status !== undefined &&
      request.status !== status);
  useEffect(() => {
    if (missing) {
      onMissing();
    }
  }, [missing, onMissing]);
  if (missing) {
    return null;
  }
  if (request) {
    return children(request);
  }
  return (
    <LoadStateScreen
      flow={flow}
      title={title}
      onBack={onBack}
      titleRef={titleRef}
      // 다시 받는 동안은 불러오는 중을 보인다
      failed={query.isError && !query.isFetching}
      failedTitle="참여 요청을 불러오지 못했어요"
      onRetry={() => query.refetch()}
    />
  );
}

export function OrgJoinRoute({ navigation }: MyScreenProps<'OrgJoin'>) {
  const titleRef = useFocusTitleOnOpen(navigation);

  return (
    <OrgJoinScreen
      titleRef={titleRef}
      onFound={target => {
        // 찾는 동안 다른 탭으로 옮겼으면 늦게 온 결과로 데려가지 않는다
        if (navigation.isFocused()) {
          navigation.navigate('OrgRoleSelect', target);
        }
      }}
      onBack={() => navigation.goBack()}
    />
  );
}

// 요청을 보냈으면 회사 찾기·역할 선택을 스택에서 빼고 다음 화면을 올린다.
// 뒤로 가기·스와이프로 같은 요청을 다시 보내는 화면에 돌아가지 않게 한다. 같은 화면이 스택에 있으면 그것을 맨 위로 옮긴다
const JOIN_FLOW: ReadonlySet<string> = new Set(['OrgJoin', 'OrgRoleSelect']);

function replaceJoinFlow(
  navigation: MyScreenProps<'OrgRoleSelect'>['navigation'],
  next: {
    key: string;
    name: 'OrgJoinRequested' | 'OrgJoinRequests';
    params?: MyStackParamList['OrgJoinRequested'];
  },
) {
  navigation.dispatch(state => {
    const existing = state.routes.find(item => item.name === next.name);
    const routes = state.routes.filter(
      item => !JOIN_FLOW.has(item.name) && item.name !== next.name,
    );
    const top = existing && next.name === 'OrgJoinRequests' ? existing : next;
    return CommonActions.reset({
      ...state,
      routes: [...routes, top],
      index: routes.length,
    });
  });
}

export function RoleSelectRoute({
  navigation,
  route,
}: MyScreenProps<'OrgRoleSelect'>) {
  const titleRef = useFocusTitleOnOpen(navigation);

  return (
    <RoleSelectScreen
      target={route.params}
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      onRequested={request =>
        replaceJoinFlow(navigation, {
          key: `OrgJoinRequested-${request.requestId}`,
          name: 'OrgJoinRequested',
          params: {
            requestId: request.requestId,
            requestChannel: request.requestChannel,
          },
        })
      }
      // 이미 참여 중인 회사는 마이페이지의 소속 목록에 있다
      onAlreadyMember={() => navigation.popTo(MY_INITIAL_ROUTE)}
      // 승인 대기 요청이 있는 회사는 신청 현황에서 그 요청을 보고 취소할 수 있다
      onPendingExists={() =>
        replaceJoinFlow(navigation, {
          key: 'OrgJoinRequests-pending',
          name: 'OrgJoinRequests',
        })
      }
    />
  );
}

// 없는 요청(이미 처리됐거나 서버에서 사라짐)으로 열렸으면 빈 화면 대신 이전 화면으로 돌아간다
function useLeaveRequest(
  navigation: MyScreenProps<
    'OrgJoinRequested' | 'OrgJoinRejected'
  >['navigation'],
) {
  return useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate(MY_INITIAL_ROUTE);
    }
  }, [navigation]);
}

export function JoinRequestedRoute({
  navigation,
  route,
}: MyScreenProps<'OrgJoinRequested'>) {
  const titleRef = useFocusTitleOnOpen(navigation);
  const leave = useLeaveRequest(navigation);
  const { requestId, requestChannel } = route.params;
  // 확인·취소 모두 조직 참여 화면들을 빼고 마이페이지로 돌아간다. 이미 처리된 요청이면 마이페이지 배지가 새 목록이다
  const backToMyPage = () => navigation.popTo(MY_INITIAL_ROUTE);

  return (
    <ParticipationRequestGate
      requestId={requestId}
      title="조직 참여하기"
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      onMissing={leave}
    >
      {request => (
        <JoinRequestedScreen
          // 서버는 요청 경로를 돌려주지 않아 보낸 화면이 넘긴 값을 쓴다
          request={{ ...request, requestChannel }}
          titleRef={titleRef}
          onConfirm={backToMyPage}
          onCanceled={backToMyPage}
          onAlreadyDecided={backToMyPage}
          onBack={() => navigation.goBack()}
        />
      )}
    </ParticipationRequestGate>
  );
}

export function JoinRejectedRoute({
  navigation,
  route,
}: MyScreenProps<'OrgJoinRejected'>) {
  const titleRef = useFocusTitleOnOpen(navigation);
  const leave = useLeaveRequest(navigation);

  return (
    <ParticipationRequestGate
      requestId={route.params.requestId}
      status="REJECTED"
      title="조직 참여하기"
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      onMissing={leave}
    >
      {request => (
        <JoinRejectedScreen
          request={request}
          titleRef={titleRef}
          onConfirm={() => navigation.goBack()}
          onBack={() => navigation.goBack()}
        />
      )}
    </ParticipationRequestGate>
  );
}

export function JoinRequestsRoute({
  navigation,
}: MyScreenProps<'OrgJoinRequests'>) {
  const titleRef = useFocusTitleOnOpen(navigation);

  return (
    <JoinRequestsScreen
      titleRef={titleRef}
      onJoin={() => navigation.navigate('OrgJoin')}
      onBack={() => navigation.goBack()}
    />
  );
}
