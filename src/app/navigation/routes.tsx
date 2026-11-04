import {
  usePreventRemove,
  useScrollToTop,
  type NavigationAction,
  type ParamListBase,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  type FlatListInstance,
  type TextInstance,
} from 'react-native';
import { completedToWorkDetail } from '../../features/history/mockData';
import { WorkHistoryScreen } from '../../features/history/screens/WorkHistoryScreen';
import { requestToWorkDetail } from '../../features/schedule/mockData';
import {
  clearRejectDraft,
  loadRejectDraft,
  saveRejectDraft,
} from '../../features/schedule/rejectDraft';
import { RejectReasonScreen } from '../../features/schedule/screens/RejectReasonScreen';
import { RequestDetailScreen } from '../../features/schedule/screens/RequestDetailScreen';
import { ScheduleScreen } from '../../features/schedule/screens/ScheduleScreen';
import {
  currentWork,
  homeToday,
  weeklySchedule,
  workDetail,
} from '../../features/work/mockData';
import { formatResultTime, formatSubmittedAt } from '../../features/work/model';
import { pickReportPhotos } from '../../features/work/photoPicker';
import {
  clearReportDraft,
  loadReportDraft,
  saveReportDraft,
} from '../../features/work/reportDraft';
import { WorkDetailScreen } from '../../features/work/screens/WorkDetailScreen';
import { WorkHomeScreen } from '../../features/work/screens/WorkHomeScreen';
import { useHistory, useSchedule, useWorkSession } from '../AppStateProvider';
import { callPhone, openDirections } from '../externalLinks';
import type {
  HistoryScreenProps,
  HomeScreenProps,
  MainTabScreenProps,
  RootScreenProps,
} from './types';

// 내비게이터에 올리는 화면들. 앱 상태·목 데이터를 화면 컴포넌트 props 로 이어 준다.

// 탭 첫 화면에서 지금 탭을 다시 누르면 리스트를 맨 위로 올린다 (iOS 관례).
// 상세가 열려 있을 때는 스택이 첫 화면으로 돌아가기만 한다
function useTabScrollToTop() {
  const listRef = useRef<FlatListInstance>(null);
  useScrollToTop(listRef);
  return listRef;
}

// 스택 화면이 열리면 스크린리더 포커스를 제목으로 옮긴다. 자체 헤더라 그대로 두면 왼쪽 위 뒤로 가기에 머문다.
// 전환이 끝난 뒤(transitionEnd)에 옮겨야 플랫폼이 다시 덮어쓰지 않는다.
// 처음 보일 때 한 번만 옮기고, 위 화면을 닫고 돌아왔을 때는 플랫폼의 포커스 복원에 맡긴다.
// 다시 구독해도(navigation 이 바뀜) 한 번만이 유지되게 ref 에 둔다
export function useFocusTitleOnOpen(
  navigation: Pick<NativeStackNavigationProp<ParamListBase>, 'addListener'>,
) {
  const titleRef = useRef<TextInstance>(null);
  const focused = useRef(false);
  useEffect(
    () =>
      navigation.addListener('transitionEnd', ({ data }) => {
        if (data.closing || focused.current) {
          return;
        }
        focused.current = true;
        if (titleRef.current) {
          AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
        }
      }),
    [navigation],
  );
  return titleRef;
}

export function WorkHomeRoute({ navigation }: HomeScreenProps<'WorkHome'>) {
  const { started, setStarted, clearSubmission } = useWorkSession();
  const listRef = useTabScrollToTop();
  // 목 데이터는 끝낸 작업도 계속 진행할 작업으로 보여 준다. 다시 시작하면 새 작업처럼 제출 기록을 지워
  // 읽기 전용 상세에 갇혀 '작업 수행중' 을 끝낼 수 없게 되지 않게 한다 (API 연동 때 지운다)
  const startWork = useCallback(() => {
    clearSubmission(currentWork.id);
    setStarted(true);
  }, [clearSubmission, setStarted]);
  const openWork = useCallback(
    (id: string) => navigation.navigate('WorkDetail', { id }),
    [navigation],
  );
  // 종은 알림센터를 연다 (#96). 홈 탭 안에 쌓아 뒤로 가면 홈으로 돌아온다
  const openNotifications = useCallback(
    () => navigation.navigate('NotificationCenter'),
    [navigation],
  );

  return (
    <WorkHomeScreen
      currentWork={currentWork}
      schedule={weeklySchedule}
      today={homeToday}
      weekLabel="9. 14. – 9. 20."
      started={started}
      onStartWork={startWork}
      onOpenWork={openWork}
      onOpenNotifications={openNotifications}
      listRef={listRef}
    />
  );
}

// 문구는 기획 확인 전 기본안이다. Android 는 뒤로가기·바깥 탭으로 닫을 수 있고, 그러면 '계속 작성' 과 같다
function confirmDiscardReport(onDiscard: () => void) {
  Alert.alert(
    '작성 중인 완료 보고가 있어요',
    '나가면 입력한 사진·메모·결제 정보가 사라집니다.',
    [
      { text: '계속 작성', style: 'cancel' },
      { text: '나가기', style: 'destructive', onPress: onDiscard },
    ],
    { cancelable: true },
  );
}

export function WorkDetailRoute({
  navigation,
  route,
}: HomeScreenProps<'WorkDetail'>) {
  const { setStarted, submissions, saveSubmission } = useWorkSession();
  const workId = route.params.id;
  const submission = submissions[workId];
  // 목 데이터라 어떤 작업을 열어도 같은 상세를 보여준다. 제출 여부만 작업마다 다르다
  const work = useMemo(
    () => (submission ? { ...workDetail, submission } : workDetail),
    [submission],
  );
  const titleRef = useFocusTitleOnOpen(navigation);
  // 앱이 종료되기 전에 쓰던 보고가 있으면 이어 쓴다 (#34). 제출을 마친 작업은 쓸 보고가 없다
  const [draft] = useState(() =>
    submission ? undefined : loadReportDraft(workId),
  );
  // 남긴 초안은 입력이 있는 보고뿐이라(saveReportDraft) 이어 쓰면 처음부터 작성 중이다.
  // 화면이 알려 줄 때 바꾸면 열자마자 다시 그리게 된다
  const [hasUnsavedReport, setHasUnsavedReport] = useState(draft !== undefined);

  // '나가기' 로 작성 중인 보고를 버리기로 확정한 지점. 기기에 남긴 초안도 지운다.
  // 막았던 동작을 다시 보낸다. 한 번 확인을 거친 동작이라 이 화면에서 다시 막히지 않는다
  const discardReportAndLeave = (action: NavigationAction) => {
    clearReportDraft(workId);
    navigation.dispatch(action);
  };

  // 작성 중인 보고가 있으면 화면을 스택에서 빼는 모든 동작에서 묻는다.
  // 포커스만 잃는 탭 이동은 화면을 빼지 않아(입력이 남음) 묻지 않는다.
  // iOS 스와이프는 끝까지 밀면 화면이 닫혔다가 다시 밀려 들어오며 묻는다
  usePreventRemove(hasUnsavedReport, ({ data }) =>
    confirmDiscardReport(() => discardReportAndLeave(data.action)),
  );

  return (
    <WorkDetailScreen
      work={work}
      titleRef={titleRef}
      onUnsavedReportChange={setHasUnsavedReport}
      initialReport={draft}
      // 입력이 바뀔 때마다 남겨 둔다. 앱이 언제 종료될지 JS 는 알 수 없다
      onReportChange={report => saveReportDraft(workId, report)}
      onBack={() => navigation.goBack()}
      onDone={() => {
        // 제출 완료·작업 취소 모두 진행 중 작업이 끝난 것이다
        setStarted(false);
        navigation.goBack();
      }}
      onSubmitReport={report => {
        // 서버가 받은 셈으로 앱 상태에 둔다. API 연동 때는 제출 응답이 submitted 일 때만 저장하거나 상세 조회로 바꾼다
        const now = new Date();
        saveSubmission(workId, { submittedAt: formatSubmittedAt(now), report });
        clearReportDraft(workId);
        return { kind: 'submitted', at: formatResultTime(now) };
      }}
      onCall={callPhone}
      onNavigate={openDirections}
      onPickPhoto={pickReportPhotos}
    />
  );
}

export function ScheduleRoute({
  navigation,
  route,
}: MainTabScreenProps<'schedule'>) {
  const { today, confirmed, pending, accept } = useSchedule();
  const listRef = useTabScrollToTop();
  // 바깥에서 고른 하위 탭(탈퇴 불가 → 응답 필요). 화면이 옮긴 뒤 지워야 같은 요청이 다시 와도 옮긴다
  const requestedTab = route.params?.tab;
  useEffect(() => {
    if (requestedTab) {
      navigation.setParams({ tab: undefined });
    }
  }, [requestedTab, navigation]);
  const openRequest = useCallback(
    (id: string) => navigation.navigate('RequestDetail', { id }),
    [navigation],
  );
  const openReject = useCallback(
    (id: string) => navigation.navigate('RejectReason', { id }),
    [navigation],
  );

  return (
    <ScheduleScreen
      today={today}
      confirmed={confirmed}
      pending={pending}
      onAccept={accept}
      onReject={openReject}
      onOpenRequest={openRequest}
      requestedTab={requestedTab}
      listRef={listRef}
    />
  );
}

// 목록에 없는 요청(이미 처리됐거나 서버에서 취소됨)이면 빈 화면 대신 이전 화면으로 돌아간다.
// 딥링크처럼 돌아갈 화면이 없으면 탭 첫 화면으로 바꾼다.
// 수락·거절은 목록에서 빼면서 같은 커밋에 화면을 닫으므로 여기에 걸리지 않는다.
function usePendingRequest(
  id: string,
  navigation: RootScreenProps<'RequestDetail' | 'RejectReason'>['navigation'],
) {
  const { pending } = useSchedule();
  const request = pending.find(item => item.id === id);
  const missing = request === undefined;
  useEffect(() => {
    if (!missing) {
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('Main');
    }
  }, [missing, navigation]);
  return request;
}

export function RequestDetailRoute({
  navigation,
  route,
}: RootScreenProps<'RequestDetail'>) {
  const { accept } = useSchedule();
  const request = usePendingRequest(route.params.id, navigation);
  const titleRef = useFocusTitleOnOpen(navigation);
  if (!request) {
    return null;
  }

  return (
    <RequestDetailScreen
      work={requestToWorkDetail(request)}
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      onAccept={() => {
        accept(request.id);
        navigation.goBack();
      }}
      onReject={() => navigation.navigate('RejectReason', { id: request.id })}
      onCall={callPhone}
      onNavigate={openDirections}
    />
  );
}

export function RejectReasonRoute({
  navigation,
  route,
}: RootScreenProps<'RejectReason'>) {
  const { reject } = useSchedule();
  const requestId = route.params.id;
  // 거절 사유는 나갈 때 묻지 않으므로 화면을 스택에서 빼는 동작(제출·취소·뒤로·스와이프)이 곧 버리기로 한 것이다.
  // 앱이 종료될 때는 이 이벤트가 오지 않아 초안이 남는다.
  // 없는 요청이면 usePendingRequest 의 effect 가 열리자마자 닫으므로 그보다 먼저 듣는다 (effect 는 선언 순서대로 돈다)
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => clearRejectDraft(requestId)),
    [navigation, requestId],
  );
  const request = usePendingRequest(requestId, navigation);
  const titleRef = useFocusTitleOnOpen(navigation);
  // 앱이 종료되기 전에 고르던 사유가 있으면 이어 고른다 (#34)
  const [draft] = useState(() => loadRejectDraft(requestId));
  if (!request) {
    return null;
  }

  return (
    <RejectReasonScreen
      titleRef={titleRef}
      initialDraft={draft}
      onDraftChange={value => saveRejectDraft(requestId, value)}
      onBack={() => navigation.goBack()}
      onSubmit={() => {
        // 거절 사유는 API 연동 때 서버로 보낸다. 요청 상세에서 왔어도 내 일정까지 돌아간다
        reject(request.id);
        navigation.popTo('Main');
      }}
    />
  );
}

export function WorkHistoryRoute({
  navigation,
}: HistoryScreenProps<'WorkHistory'>) {
  const { today, works } = useHistory();
  const listRef = useTabScrollToTop();
  const openWork = useCallback(
    (id: string) => navigation.navigate('CompletedWorkDetail', { id }),
    [navigation],
  );

  return (
    <WorkHistoryScreen
      today={today}
      works={works}
      onOpenWork={openWork}
      listRef={listRef}
    />
  );
}

// 완료한 작업의 상세. 보고를 제출한 작업이라 제출 후 읽기 전용(#69)으로 열린다.
// 목록에 없는 작업(딥링크 등)이면 빈 화면 대신 목록으로 돌아간다
export function CompletedWorkDetailRoute({
  navigation,
  route,
}: HistoryScreenProps<'CompletedWorkDetail'>) {
  const { works } = useHistory();
  const titleRef = useFocusTitleOnOpen(navigation);
  const completed = works.find(item => item.id === route.params.id);
  const work = useMemo(
    () => completed && completedToWorkDetail(completed),
    [completed],
  );
  // 탭 안 스택이라, 스택 첫 화면(딥링크)에서 그냥 뒤로 가면 탭 내비게이터가 홈 탭으로 보낸다.
  // 첫 화면이면 작업 이력 목록으로 바꾸고, 아니면 이 화면만 닫는다 (위에 쌓인 화면은 남는다)
  const leave = useCallback(() => {
    if (navigation.getState().routes[0]?.key === route.key) {
      navigation.replace('WorkHistory');
    } else {
      navigation.goBack();
    }
  }, [navigation, route.key]);
  const missing = work === undefined;
  useEffect(() => {
    if (missing) {
      leave();
    }
  }, [missing, leave]);
  if (!work) {
    return null;
  }

  return (
    <WorkDetailScreen
      work={work}
      titleRef={titleRef}
      onBack={leave}
      onCall={callPhone}
      onNavigate={openDirections}
      // 읽기 전용이라 제출·사진 추가·결과 모달은 일어나지 않는다
      onDone={leave}
      onSubmitReport={() => ({
        kind: 'submitted',
        at: formatResultTime(new Date()),
      })}
      onPickPhoto={async () => []}
    />
  );
}
