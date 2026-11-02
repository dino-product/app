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
import { requestToWorkDetail } from '../../features/schedule/mockData';
import { RejectReasonScreen } from '../../features/schedule/screens/RejectReasonScreen';
import { RequestDetailScreen } from '../../features/schedule/screens/RequestDetailScreen';
import { ScheduleScreen } from '../../features/schedule/screens/ScheduleScreen';
import {
  currentWork,
  weeklySchedule,
  workDetail,
} from '../../features/work/mockData';
import { formatResultTime, formatSubmittedAt } from '../../features/work/model';
import { WorkDetailScreen } from '../../features/work/screens/WorkDetailScreen';
import { WorkHomeScreen } from '../../features/work/screens/WorkHomeScreen';
import { useSchedule, useWorkSession } from '../AppStateProvider';
import { callPhone, openDirections } from '../externalLinks';
import type {
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
function useFocusTitleOnOpen(
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
  const { started, setStarted } = useWorkSession();
  const listRef = useTabScrollToTop();
  const startWork = useCallback(() => setStarted(true), [setStarted]);
  const openWork = useCallback(
    (id: string) => navigation.navigate('WorkDetail', { id }),
    [navigation],
  );

  return (
    <WorkHomeScreen
      currentWork={currentWork}
      schedule={weeklySchedule}
      weekLabel="9. 14. – 9. 20."
      started={started}
      onStartWork={startWork}
      onOpenWork={openWork}
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
  const [hasUnsavedReport, setHasUnsavedReport] = useState(false);

  // '나가기' 로 작성 중인 보고를 버리기로 확정한 지점. 초안을 저장하게 되면 여기서 지운다.
  // 막았던 동작을 다시 보낸다. 한 번 확인을 거친 동작이라 이 화면에서 다시 막히지 않는다
  const discardReportAndLeave = (action: NavigationAction) =>
    navigation.dispatch(action);

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
      onBack={() => navigation.goBack()}
      onDone={() => {
        // 제출 완료·작업 취소 모두 진행 중 작업이 끝난 것이다
        setStarted(false);
        navigation.goBack();
      }}
      onSubmitReport={report => {
        // 서버가 받은 셈으로 앱 상태에 둔다. API 연동 때 제출 응답·상세 조회로 바꾼다
        const now = new Date();
        saveSubmission(workId, { submittedAt: formatSubmittedAt(now), report });
        return { kind: 'submitted', at: formatResultTime(now) };
      }}
      onCall={callPhone}
      onNavigate={openDirections}
      // 카메라·앨범 연동 전까지 회색 자리 사진을 넣는다
      onPickPhoto={async () => `mock://photo-${Date.now()}`}
    />
  );
}

export function ScheduleRoute({ navigation }: MainTabScreenProps<'schedule'>) {
  const { today, confirmed, pending, accept } = useSchedule();
  const listRef = useTabScrollToTop();
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
  const request = usePendingRequest(route.params.id, navigation);
  const titleRef = useFocusTitleOnOpen(navigation);
  if (!request) {
    return null;
  }

  return (
    <RejectReasonScreen
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      onSubmit={() => {
        // 거절 사유는 API 연동 때 서버로 보낸다. 요청 상세에서 왔어도 내 일정까지 돌아간다
        reject(request.id);
        navigation.popTo('Main');
      }}
    />
  );
}
