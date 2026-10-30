import { useCallback, useEffect } from 'react';
import { requestToWorkDetail } from '../../features/schedule/mockData';
import { RejectReasonScreen } from '../../features/schedule/screens/RejectReasonScreen';
import { RequestDetailScreen } from '../../features/schedule/screens/RequestDetailScreen';
import { ScheduleScreen } from '../../features/schedule/screens/ScheduleScreen';
import {
  currentWork,
  weeklySchedule,
  workDetail,
} from '../../features/work/mockData';
import { formatResultTime } from '../../features/work/model';
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

export function WorkHomeRoute({ navigation }: HomeScreenProps<'WorkHome'>) {
  const { started, setStarted } = useWorkSession();
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
    />
  );
}

export function WorkDetailRoute({ navigation }: HomeScreenProps<'WorkDetail'>) {
  const { setStarted } = useWorkSession();

  return (
    // 목 데이터라 어떤 작업을 열어도 같은 상세를 보여준다
    <WorkDetailScreen
      work={workDetail}
      onBack={() => navigation.goBack()}
      onDone={() => {
        // 제출 완료·작업 취소 모두 진행 중 작업이 끝난 것이다
        setStarted(false);
        navigation.goBack();
      }}
      onSubmitReport={() => ({
        kind: 'submitted',
        at: formatResultTime(new Date()),
      })}
      onCall={callPhone}
      onNavigate={openDirections}
      // 카메라·앨범 연동 전까지 회색 자리 사진을 넣는다
      onPickPhoto={async () => `mock://photo-${Date.now()}`}
    />
  );
}

export function ScheduleRoute({ navigation }: MainTabScreenProps<'schedule'>) {
  const { today, confirmed, pending, accept } = useSchedule();
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
  if (!request) {
    return null;
  }

  return (
    <RequestDetailScreen
      work={requestToWorkDetail(request)}
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
  if (!request) {
    return null;
  }

  return (
    <RejectReasonScreen
      onBack={() => navigation.goBack()}
      onSubmit={() => {
        // 거절 사유는 API 연동 때 서버로 보낸다. 요청 상세에서 왔어도 내 일정까지 돌아간다
        reject(request.id);
        navigation.popTo('Main');
      }}
    />
  );
}
