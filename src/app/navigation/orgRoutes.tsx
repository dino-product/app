import { CommonActions, useIsFocused } from '@react-navigation/native';
import {
  useCallback,
  useEffect,
  useRef,
  type ReactElement,
  type Ref,
} from 'react';
import type { TextInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SubScreenHeader } from '../../features/my/components/SubScreenHeader';
import type {
  ParticipationRequest,
  ParticipationStatus,
} from '../../features/my/org/model';
import { useParticipationRequest } from '../../features/my/org/participationQueries';
import { JoinRejectedScreen } from '../../features/my/org/screens/JoinRejectedScreen';
import {
  joinRequestedTitle,
  JoinRequestedScreen,
} from '../../features/my/org/screens/JoinRequestedScreen';
import { JoinRequestsScreen } from '../../features/my/org/screens/JoinRequestsScreen';
import { OrgJoinScreen } from '../../features/my/org/screens/OrgJoinScreen';
import { QrScanScreen } from '../../features/my/org/screens/QrScanScreen';
import { RoleSelectScreen } from '../../features/my/org/screens/RoleSelectScreen';
import { LoadStateView } from '../../shared/layout/LoadStateView';
import { readableColumn } from '../../shared/layout/readableColumn';
import {
  STANDALONE_SCREEN_EDGES,
  standaloneScreen,
} from '../../shared/layout/standaloneScreen';
import { useFocusTitleOnOpen } from './routes';
import {
  MY_INITIAL_ROUTE,
  type MyScreenProps,
  type RootScreenProps,
  type RootStackParamList,
} from './types';

// 마이 › 조직 참여 화면들 (#73). 서버 상태(회사 확인·참여 요청·취소·신청 현황, #116)는 화면이 participationQueries 로
// 읽고 보내며, 여기서는 화면 사이 이동을 잇는다.
// 회사 참여 흐름(회사 찾기·QR·역할 선택·요청 완료·승인 대기·거절)은 Figma 대로 하단 탭 바 없이 메인 위 루트 스택에 쌓는다 (#219).
// 신청 현황은 Figma 에 탭 바가 있어 마이 탭 스택에 있다

/** 마이 탭의 마이페이지로 돌아간다. 메인 위에 쌓인 회사 참여 화면과 마이 탭에 쌓인 화면(신청 현황 등)을 모두 뺀다 */
function popToMyPage(navigation: {
  popTo: RootScreenProps<'OrgJoin'>['navigation']['popTo'];
}) {
  navigation.popTo('Main', {
    screen: 'my',
    params: { screen: MY_INITIAL_ROUTE, pop: true },
  });
}

/**
 * 신청 현황에서 찾은 참여 요청 하나로 화면을 그린다 (요청 완료·거절·참여 완료).
 * 캐시는 옛 상태일 수 있다(대기였다가 거절됨, 다른 기기가 보낸 요청). 캐시에 기대한 요청이 있으면 바로 그리고,
 * 없으면 이 화면을 연 뒤 서버에서 받은 목록으로 판단한다. 그때까지·받지 못했을 때는 같은 머리 제목의 자리를 보인다.
 * 받은 목록에도 없거나(이미 처리돼 사라짐·잘못된 id) 기대한 상태가 아니면 빈 화면 대신 onMissing 으로 떠난다.
 * onMissing 은 바뀌지 않는 함수여야 한다
 */
export function ParticipationRequestGate({
  requestId,
  status,
  title,
  onBack,
  onMissing,
  titleRef,
  children,
}: {
  requestId: string;
  /** 이 상태의 요청만 그린다 (거절 화면은 REJECTED). 없으면 상태를 보지 않는다 */
  status?: ParticipationStatus;
  /** 받는 동안·받지 못했을 때의 머리 제목 (그릴 화면의 제목) */
  title: string;
  onBack: () => void;
  onMissing: () => void;
  titleRef?: Ref<TextInstance>;
  children: (request: ParticipationRequest) => ReactElement;
}) {
  const query = useParticipationRequest(requestId);
  const request = query.data;
  const found =
    request !== undefined &&
    request !== null &&
    (status === undefined || request.status === status);
  // 마운트 뒤 서버에서 받은 결과가 있을 때만 판단한다 (isFetching 등은 캐시로 그리지 못할 때만 읽어 평소 다시 받기로 다시 그리지 않는다)
  const checked =
    !found && query.isFetchedAfterMount && !query.isFetching && !query.isError;
  const missing = !found && checked;
  useEffect(() => {
    if (missing) {
      onMissing();
    }
  }, [missing, onMissing]);
  if (found) {
    return children(request);
  }
  if (missing) {
    return null;
  }
  return (
    <SafeAreaView
      edges={STANDALONE_SCREEN_EDGES}
      style={standaloneScreen.screen}
    >
      <SubScreenHeader title={title} onBack={onBack} titleRef={titleRef} />
      <LoadStateView
        style={readableColumn}
        // 다시 받는 동안은 불러오는 중을 보인다
        state={
          query.isError && !query.isFetching
            ? {
                status: 'error',
                message: '참여 요청을 불러오지 못했어요.',
                onRetry: () => query.refetch(),
              }
            : { status: 'loading' }
        }
      />
    </SafeAreaView>
  );
}

export function OrgJoinRoute({
  navigation,
  route,
}: RootScreenProps<'OrgJoin'>) {
  const titleRef = useFocusTitleOnOpen(navigation);
  const screenFocused = useIsFocused();
  const scannedCode = useScannedCode(navigation, route.params?.qrCode);
  // QR 코드 인식과 회사 찾기는 같은 루트 스택 화면이라, 카메라가 닫히면 이 화면이 다시 보인다
  const waitForReturn = useAwaitReturnTransition(navigation);

  return (
    <OrgJoinScreen
      titleRef={titleRef}
      screenFocused={screenFocused}
      scannedCode={scannedCode}
      waitForReturn={waitForReturn}
      onFound={target => {
        // 찾는 동안 다른 탭으로 옮겼으면 늦게 온 결과로 데려가지 않는다
        if (navigation.isFocused()) {
          navigation.navigate('OrgRoleSelect', target);
        }
      }}
      // 카메라 권한을 받았다. 전체 화면 카메라를 이 화면 위에 연다
      onScanQr={() => navigation.navigate('OrgQrScan')}
      onBack={() => navigation.goBack()}
    />
  );
}

/**
 * QR 코드 인식이 넘긴 회사 코드 (#195). 화면에 넘긴 뒤 파라미터에서 지운다.
 * 지워야 같은 QR 을 다시 읽어 왔을 때 다시 확인하고, 저장한 화면 상태를 다시 열 때 또 확인하지 않는다
 */
export function useScannedCode(
  navigation: { setParams: (params: { qrCode?: string }) => void },
  qrCode: string | undefined,
) {
  useEffect(() => {
    if (qrCode) {
      navigation.setParams({ qrCode: undefined });
    }
  }, [qrCode, navigation]);
  return qrCode;
}

/** 카메라(QR 코드 인식)가 닫히며 회사 찾기가 다시 보이는 전환을 기다리는 최대 시간. 네이티브 전환은 0.35초쯤이다 */
export const RETURN_TRANSITION_TIMEOUT_MS = 1000;

/** 전환 끝(transitionEnd)을 알려 주는 스택 내비게이션 (native-stack) */
type TransitionSource = {
  addListener: (
    type: 'transitionEnd',
    listener: (event: { data: { closing: boolean } }) => void,
  ) => () => void;
};

/**
 * 화면이 다시 보이는 전환이 끝나기를(transitionEnd) 기다리는 함수 (#195). QR 결과는 앱 화면으로 돌아온 뒤에 보인다.
 * source 는 그 전환을 하는 스택에서의 이 화면(또는 이 화면을 담은 화면) 내비게이션이다.
 * 이벤트를 놓쳐도 결과가 묶이지 않게 RETURN_TRANSITION_TIMEOUT_MS 뒤에는 기다리지 않는다. 화면을 떠나면 구독·타이머를 푼다
 */
export function useAwaitReturnTransition(source: TransitionSource | undefined) {
  const waiting = useRef(new Set<() => void>());
  useEffect(() => {
    const pending = waiting.current;
    return () => pending.forEach(stop => stop());
  }, []);
  return useCallback(
    () =>
      new Promise<void>(resolve => {
        let unsubscribe: (() => void) | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const stop = () => {
          unsubscribe?.();
          clearTimeout(timer);
          waiting.current.delete(stop);
          resolve();
        };
        waiting.current.add(stop);
        unsubscribe = source?.addListener('transitionEnd', ({ data }) => {
          if (!data.closing) {
            stop();
          }
        });
        timer = setTimeout(stop, RETURN_TRANSITION_TIMEOUT_MS);
      }),
    [source],
  );
}

// QR 코드 인식 (#108). 회사 코드를 읽으면 카메라를 닫고(스택에서 빼고) 회사 찾기로 돌아가 그 코드를 넘긴다 (#195).
// 회사 확인과 결과(역할 선택·안내 모달)는 회사 찾기가 앱 화면 위에 보인다. 역할 선택에서 뒤로 가면 카메라가 아니라 회사 찾기로 간다
export function OrgQrScanRoute({ navigation }: RootScreenProps<'OrgQrScan'>) {
  const titleRef = useFocusTitleOnOpen(navigation);
  const focused = useIsFocused();

  return (
    <QrScanScreen
      focused={focused}
      titleRef={titleRef}
      onScanned={qrCode => navigation.popTo('OrgJoin', { qrCode })}
      onClose={() => navigation.goBack()}
    />
  );
}

// 요청을 보냈으면 회사 찾기·역할 선택을 스택에서 빼고 요청 완료를 올린다.
// 뒤로 가기·스와이프로 같은 요청을 다시 보내는 화면에 돌아가지 않게 한다
const JOIN_FLOW: ReadonlySet<string> = new Set(['OrgJoin', 'OrgRoleSelect']);

function replaceJoinFlow(
  navigation: RootScreenProps<'OrgRoleSelect'>['navigation'],
  next: {
    key: string;
    name: 'OrgJoinRequested';
    params: RootStackParamList['OrgJoinRequested'];
  },
) {
  navigation.dispatch(state => {
    const routes = state.routes.filter(
      item => !JOIN_FLOW.has(item.name) && item.name !== next.name,
    );
    return CommonActions.reset({
      ...state,
      routes: [...routes, next],
      index: routes.length,
    });
  });
}

export function RoleSelectRoute({
  navigation,
  route,
}: RootScreenProps<'OrgRoleSelect'>) {
  const titleRef = useFocusTitleOnOpen(navigation);
  const screenFocused = useIsFocused();

  return (
    <RoleSelectScreen
      target={route.params}
      titleRef={titleRef}
      screenFocused={screenFocused}
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
      onAlreadyMember={() => popToMyPage(navigation)}
      // 승인 대기 요청이 있는 회사는 신청 현황(마이 탭)에서 그 요청을 보고 취소할 수 있다.
      // 회사 찾기·역할 선택을 빼고, 마이 탭에 신청 현황이 있으면 그것으로 돌아간다
      onPendingExists={() =>
        navigation.popTo('Main', {
          screen: 'my',
          params: { screen: 'OrgJoinRequests', pop: true },
        })
      }
    />
  );
}

// 없는 요청(이미 처리됐거나 서버에서 사라짐)으로 열렸으면 빈 화면 대신 이전 화면으로 돌아간다
function useLeaveRequest(
  navigation: RootScreenProps<
    'OrgJoinRequested' | 'OrgJoinRejected'
  >['navigation'],
) {
  return useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      popToMyPage(navigation);
    }
  }, [navigation]);
}

export function JoinRequestedRoute({
  navigation,
  route,
}: RootScreenProps<'OrgJoinRequested'>) {
  const titleRef = useFocusTitleOnOpen(navigation);
  const leave = useLeaveRequest(navigation);
  const { requestId, requestChannel } = route.params;
  // 확인·취소 모두 조직 참여 화면들을 빼고 마이페이지로 돌아간다. 이미 처리된 요청이면 마이페이지 배지가 새 목록이다
  const backToMyPage = () => popToMyPage(navigation);

  return (
    <ParticipationRequestGate
      requestId={requestId}
      title={joinRequestedTitle('my')}
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

// 마이페이지 소속 카드의 검토 줄에서 연 승인 대기 요청의 진행 상황 (#199). 요청 완료 화면에 맥락 제목·사무실 검토 중 진행·상태 칩을 더한다.
// 그사이 사무실이 결정했으면(승인 대기가 아님) 빈 화면 대신 마이페이지로 돌아간다. 참여 완료 화면은 참여 승인 알림으로만 연다.
// 떠날 때는 이 화면만 루트 스택에서 뺀다 (한 번만). 아래는 이 화면을 연 마이페이지(메인)다:
// - 신청을 취소하면 게이트의 '없는 요청'(onMissing)과 취소 결과(onCanceled)가 함께 온다. 뒤로 가기(goBack)는 두 번
//   불리면 메인까지 빼려 한다
// - 이 화면 위에 다른 화면이 쌓인 채 결정이 나면(알림으로 연 같은 요청의 거절 화면 등, 리뷰 #210) 아래의 이 화면이 떠난다.
//   popTo(메인)는 위의 화면까지 지운다
export function JoinReviewRoute({
  navigation,
  route,
}: RootScreenProps<'OrgJoinReview'>) {
  const titleRef = useFocusTitleOnOpen(navigation);
  const left = useRef(false);
  const backToMyPage = useCallback(() => {
    if (left.current) {
      return;
    }
    left.current = true;
    navigation.dispatch(state => {
      const routes = state.routes.filter(item => item.key !== route.key);
      if (routes.length === 0) {
        return CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
      return CommonActions.reset({
        ...state,
        routes,
        index: routes.length - 1,
      });
    });
  }, [navigation, route.key]);

  return (
    <ParticipationRequestGate
      requestId={route.params.requestId}
      status="PENDING"
      title={joinRequestedTitle('my', 'reviewing')}
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      onMissing={backToMyPage}
    >
      {request => (
        <JoinRequestedScreen
          stage="reviewing"
          request={request}
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
}: RootScreenProps<'OrgJoinRejected'>) {
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
