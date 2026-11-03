import { CommonActions } from '@react-navigation/native';
import { useEffect, useMemo } from 'react';
import { useParticipation } from '../../features/my/MyStateProvider';
import {
  pendingRequests,
  type ParticipationRequest,
} from '../../features/my/org/model';
import { JoinRejectedScreen } from '../../features/my/org/screens/JoinRejectedScreen';
import { JoinRequestedScreen } from '../../features/my/org/screens/JoinRequestedScreen';
import { JoinRequestsScreen } from '../../features/my/org/screens/JoinRequestsScreen';
import { OrgJoinScreen } from '../../features/my/org/screens/OrgJoinScreen';
import { RoleSelectScreen } from '../../features/my/org/screens/RoleSelectScreen';
import { useFocusTitleOnOpen } from './routes';
import { MY_INITIAL_ROUTE, type MyScreenProps } from './types';

// 마이 › 조직 참여 화면들 (#73). 참여 신청 상태(MyStateProvider 의 useParticipation)를 화면 props 로 이어 준다.

export function OrgJoinRoute({ navigation }: MyScreenProps<'OrgJoin'>) {
  const { lookupCompany } = useParticipation();
  const titleRef = useFocusTitleOnOpen(navigation);

  return (
    <OrgJoinScreen
      titleRef={titleRef}
      lookup={lookupCompany}
      onFound={organization => {
        // 찾는 동안 다른 탭으로 옮겼으면 늦게 온 결과로 데려가지 않는다
        if (navigation.isFocused()) {
          navigation.navigate('OrgRoleSelect', organization);
        }
      }}
      onBack={() => navigation.goBack()}
    />
  );
}

// 요청을 보내면 회사 찾기·역할 선택을 스택에서 빼고 요청 완료를 올린다.
// 뒤로 가기·스와이프로 같은 요청을 다시 보내는 화면에 돌아가지 않게 한다
const JOIN_FLOW: ReadonlySet<string> = new Set(['OrgJoin', 'OrgRoleSelect']);

export function RoleSelectRoute({
  navigation,
  route,
}: MyScreenProps<'OrgRoleSelect'>) {
  const { requestParticipation } = useParticipation();
  const titleRef = useFocusTitleOnOpen(navigation);
  const organization = route.params;

  return (
    <RoleSelectScreen
      organizationName={organization.organizationName}
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      onSubmit={desiredType => {
        const request = requestParticipation(organization, desiredType);
        navigation.dispatch(state => {
          const routes = state.routes.filter(item => !JOIN_FLOW.has(item.name));
          return CommonActions.reset({
            ...state,
            routes: [
              ...routes,
              {
                key: `OrgJoinRequested-${request.requestId}`,
                name: 'OrgJoinRequested',
                params: { requestId: request.requestId },
              },
            ],
            index: routes.length,
          });
        });
      }}
    />
  );
}

// 없는 요청(이미 처리됐거나 서버에서 사라짐)으로 열렸으면 빈 화면 대신 이전 화면으로 돌아간다
function useParticipationRequest(
  requestId: string,
  navigation: MyScreenProps<
    'OrgJoinRequested' | 'OrgJoinRejected'
  >['navigation'],
): ParticipationRequest | undefined {
  const { requests } = useParticipation();
  const request = requests.find(item => item.requestId === requestId);
  const missing = request === undefined;
  useEffect(() => {
    if (!missing) {
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate(MY_INITIAL_ROUTE);
    }
  }, [missing, navigation]);
  return request;
}

export function JoinRequestedRoute({
  navigation,
  route,
}: MyScreenProps<'OrgJoinRequested'>) {
  const { cancelRequest } = useParticipation();
  const request = useParticipationRequest(route.params.requestId, navigation);
  const titleRef = useFocusTitleOnOpen(navigation);
  if (!request) {
    return null;
  }

  return (
    <JoinRequestedScreen
      request={request}
      titleRef={titleRef}
      // 확인·취소 모두 조직 참여 화면들을 빼고 마이페이지로 돌아간다
      onConfirm={() => navigation.popTo(MY_INITIAL_ROUTE)}
      onCancel={requestId => {
        cancelRequest(requestId);
        navigation.popTo(MY_INITIAL_ROUTE);
      }}
      onBack={() => navigation.goBack()}
    />
  );
}

export function JoinRejectedRoute({
  navigation,
  route,
}: MyScreenProps<'OrgJoinRejected'>) {
  const request = useParticipationRequest(route.params.requestId, navigation);
  const titleRef = useFocusTitleOnOpen(navigation);
  if (!request) {
    return null;
  }

  return (
    <JoinRejectedScreen
      request={request}
      titleRef={titleRef}
      onConfirm={() => navigation.goBack()}
      onBack={() => navigation.goBack()}
    />
  );
}

export function JoinRequestsRoute({
  navigation,
}: MyScreenProps<'OrgJoinRequests'>) {
  const { requests, cancelRequest } = useParticipation();
  const pending = useMemo(() => pendingRequests(requests), [requests]);
  const titleRef = useFocusTitleOnOpen(navigation);

  return (
    <JoinRequestsScreen
      requests={pending}
      titleRef={titleRef}
      onCancel={cancelRequest}
      onJoin={() => navigation.navigate('OrgJoin')}
      onBack={() => navigation.goBack()}
    />
  );
}
