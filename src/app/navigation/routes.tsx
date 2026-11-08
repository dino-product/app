import {
  useIsFocused,
  usePreventRemove,
  useScrollToTop,
  type NavigationAction,
  type ParamListBase,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  type FlatListInstance,
  type TextInstance,
} from 'react-native';
import { monthOf, type YearMonth } from '../../features/history/model';
import { WorkHistoryScreen } from '../../features/history/screens/WorkHistoryScreen';
import {
  clearRejectDraft,
  loadRejectDraft,
  saveRejectDraft,
} from '../../features/schedule/rejectDraft';
import { RejectReasonScreen } from '../../features/schedule/screens/RejectReasonScreen';
import { RequestDetailScreen } from '../../features/schedule/screens/RequestDetailScreen';
import { ScheduleScreen } from '../../features/schedule/screens/ScheduleScreen';
import {
  toRejectionReason,
  toSubmitCommand,
} from '../../features/work/data/convert';
import {
  isMissingWork,
  isUnavailableWork,
  MissingAssignmentError,
  workErrorMessage,
  type WorkCommand,
} from '../../features/work/data/errors';
import {
  loadStateOf,
  useAcceptWork,
  useMySchedule,
  useMySchedules,
  useRefresh,
  useRejectWork,
  useStartWork,
  useSubmitCompletionReport,
  useWorkDetail,
  useLoadState,
  useWorkHistory,
  workDetailQuery,
} from '../../features/work/data/queries';
import {
  acceptCommandOf,
  confirmedOf,
  homeWeekLabel,
  monthPeriod,
  pendingOf,
  pendingPeriods,
  pickCurrentWork,
  toCompletedWork,
  toCurrentWork,
  toScheduleItem,
  weekPeriod,
} from '../../features/work/data/views';
import { useWorkRepository } from '../../features/work/data/WorkRepositoryProvider';
import {
  formatResultTime,
  reportFromPlan,
  type WorkDetail,
} from '../../features/work/model';
import { pickReportPhotos } from '../../features/work/photoPicker';
import {
  clearReportDraft,
  loadReportDraft,
  saveReportDraft,
} from '../../features/work/reportDraft';
import {
  WorkDetailStatusScreen,
  type WorkDetailStatus,
} from '../../features/work/screens/WorkDetailStatusScreen';
import { WorkDetailScreen } from '../../features/work/screens/WorkDetailScreen';
import { WorkHomeScreen } from '../../features/work/screens/WorkHomeScreen';
import { useToday } from '../../shared/time/useToday';
import { callPhone, openDirections } from '../externalLinks';
import type {
  HistoryScreenProps,
  HomeScreenProps,
  MainTabScreenProps,
  RootScreenProps,
} from './types';

// 내비게이터에 올리는 화면들. 작업 저장소(React Query 훅, features/work/data)의 값을 화면 컴포넌트 props 로 이어 준다.

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

// 변경(수락·거절·시작·완료 보고)이 실패하면 화면 상태는 그대로 두고 명령·코드별 문구로 알린다 (Figma 에 없어 시스템 알림, 기본안)
const failureTitles: Record<WorkCommand, string> = {
  accept: '수락하지 못했어요',
  reject: '거절하지 못했어요',
  start: '작업을 시작하지 못했어요',
  submit: '완료 보고를 제출하지 못했어요',
};
function alertWorkError(command: WorkCommand, error: unknown) {
  Alert.alert(failureTitles[command], workErrorMessage(error, command));
}

/** 경로의 id (문자열) → 저장소의 id. 양의 정수가 아니면(옛 복원 상태 등) null */
export function parseId(id: string | undefined): number | null {
  const value = id !== undefined && /^\d+$/.test(id) ? Number(id) : NaN;
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

// 지금 배정의 순번. 기사에게 보이는 작업에는 늘 있다. 없으면 볼 수 없는 작업으로 보고 상세를 다시 받는다
function requireAssignment(
  work: WorkDetail,
  refetch: () => Promise<unknown>,
): number {
  if (work.assignmentNumber === null) {
    refetch();
    throw new MissingAssignmentError();
  }
  return work.assignmentNumber;
}

const UNAVAILABLE: WorkDetailStatus = { status: 'unavailable' };
const LOADING = { status: 'loading' } as const;

// 상세를 아직 그릴 수 없는 이유. 서버가 볼 수 없다고 답했으면(404·403) 다시 시도하지 않는다
function detailStatusOf(
  detail: ReturnType<typeof useWorkDetail>,
): WorkDetailStatus {
  if (detail.isError && isUnavailableWork(detail.error)) {
    return UNAVAILABLE;
  }
  const load = loadStateOf(detail);
  return load.status === 'ready' ? { status: 'loading' } : load;
}

// 경로의 작업 상세. 포커스를 잃은 화면은 구독을 멈춘다.
// 숫자가 아닌 id(옛 복원 상태 등)는 부르지 않고 볼 수 없는 작업이다.
// 알림에서 열면 경로에 발주사가 있어 그것을 먼저 쓰고, 없으면 저장소가 소속 목록으로 정한다 (#117)
function useRouteWorkDetail(
  id: string,
  {
    organization,
    onlyErrors,
  }: { organization?: string; onlyErrors?: boolean } = {},
) {
  const workId = parseId(id);
  const organizationId = parseId(organization) ?? undefined;
  const invalid =
    workId === null ||
    (organization !== undefined && organizationId === undefined);
  const detail = useWorkDetail(workId ?? 0, {
    organizationId,
    enabled: !invalid,
    subscribed: useIsFocused(),
    onlyErrors,
  });
  const status = invalid ? UNAVAILABLE : detailStatusOf(detail);
  return {
    workId: invalid ? null : workId,
    detail,
    status,
    /** 상세 없이 볼 수 없는 작업으로 끝났다 */
    unavailable: detail.data === undefined && status.status === 'unavailable',
    /**
     * 그중 작업이 확실히 없다: 작업 id 가 아니거나(옛 복원 상태 등) 없는 작업(404 SCHEDULE-001)이다. 이때만 기기에 남은 초안을 지운다 (#136).
     * 소속 문제(403·기사 소속 없음)나 경로의 발주사만 잘못된 경우는 잠시일 수 있어 아니다
     */
    missing: workId === null || (detail.isError && isMissingWork(detail.error)),
  };
}

export function WorkHomeRoute({ navigation }: HomeScreenProps<'WorkHome'>) {
  const listRef = useTabScrollToTop();
  const today = useToday();
  const week = useMemo(() => weekPeriod(today), [today]);
  const schedule = useMySchedule(week, { subscribed: useIsFocused() });
  const startWork = useStartWork().mutateAsync;
  const { refreshing, onRefresh } = useRefresh(schedule.refetch);
  const load = useLoadState(schedule);

  const works = schedule.data?.works;
  const current = useMemo(
    () => (works ? pickCurrentWork(works, new Date()) : undefined),
    [works],
  );
  const currentWork = useMemo(
    () => (current ? toCurrentWork(current) : null),
    [current],
  );
  const items = useMemo(
    () => works?.map(work => toScheduleItem(work, today)) ?? [],
    [works, today],
  );

  // 예정 시작 10분 전부터 예정 종료까지만 시작할 수 있다 (밖이면 SCHEDULE-017·-018 문구)
  const start = useCallback(async () => {
    if (!current) {
      return;
    }
    try {
      await startWork({
        workId: current.workId,
        assignmentNumber: current.assignmentNumber,
      });
    } catch (error) {
      alertWorkError('start', error);
    }
  }, [current, startWork]);
  // 수락 대기 작업은 수락·거절하는 요청 상세로, 나머지는 작업 상세로 연다
  const openWork = useCallback(
    (id: string) => {
      const work = works?.find(item => String(item.workId) === id);
      if (work?.status === 'PENDING_ACCEPT') {
        navigation.navigate('RequestDetail', { id });
      } else {
        navigation.navigate('WorkDetail', { id });
      }
    },
    [navigation, works],
  );
  // 종은 알림센터를 연다 (#96). 홈 탭 안에 쌓아 뒤로 가면 홈으로 돌아온다
  const openNotifications = useCallback(
    () => navigation.navigate('NotificationCenter'),
    [navigation],
  );

  return (
    <WorkHomeScreen
      currentWork={currentWork}
      schedule={items}
      today={today}
      weekLabel={homeWeekLabel(today)}
      started={current?.status === 'IN_PROGRESS'}
      onStartWork={start}
      onOpenWork={openWork}
      onOpenNotifications={openNotifications}
      listRef={listRef}
      load={load}
      refreshing={refreshing}
      onRefresh={onRefresh}
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
  const draftId = route.params.id;
  const { workId, detail, status, unavailable, missing } = useRouteWorkDetail(
    draftId,
    { organization: route.params.organizationId },
  );
  const submitReport = useSubmitCompletionReport().mutateAsync;
  const startWork = useStartWork().mutateAsync;
  const titleRef = useFocusTitleOnOpen(navigation);
  // 앱이 종료되기 전에 쓰던 보고가 있으면 이어 쓴다 (#34). 제출을 마친 작업은 쓸 보고가 없어 상세가 오면 무시한다
  const [draft] = useState(() => loadReportDraft(draftId));
  // 남긴 초안은 입력이 있는 보고뿐이라(saveReportDraft) 이어 쓰면 처음부터 작성 중이다.
  // 화면이 알려 줄 때 바꾸면 열자마자 다시 그리게 된다
  const [hasUnsavedReport, setHasUnsavedReport] = useState(draft !== undefined);
  // 볼 수 없는 작업이면 지금은 이어 쓸 수 없어 나갈 때 묻지 않는다 (#136). 작업이 확실히 없으면(작업 id 가 아님·404,
  // 예시 작업을 가리키던 옛 복원 상태 등) 남은 초안도 지운다. 소속 문제는 잠시일 수 있어 초안은 남긴다
  const gone = unavailable && missing;
  useEffect(() => {
    if (gone) {
      clearReportDraft(draftId);
    }
  }, [gone, draftId]);

  // '나가기' 로 작성 중인 보고를 버리기로 확정한 지점. 기기에 남긴 초안도 지운다.
  // 막았던 동작을 다시 보낸다. 한 번 확인을 거친 동작이라 이 화면에서 다시 막히지 않는다
  const discardReportAndLeave = (action: NavigationAction) => {
    clearReportDraft(draftId);
    navigation.dispatch(action);
  };

  // 작성 중인 보고가 있으면 화면을 스택에서 빼는 모든 동작에서 묻는다.
  // 포커스만 잃는 탭 이동은 화면을 빼지 않아(입력이 남음) 묻지 않는다.
  // iOS 스와이프는 끝까지 밀면 화면이 닫혔다가 다시 밀려 들어오며 묻는다
  usePreventRemove(hasUnsavedReport && !unavailable, ({ data }) =>
    confirmDiscardReport(() => discardReportAndLeave(data.action)),
  );

  const work = detail.data;
  // 결제 금액은 작업의 계획값으로 미리 채운다(결제 방식은 고르지 않은 채, #150). 계획값이 그대로면 잃을 입력이 아니다
  const plannedReport = useMemo(
    () => (work ? reportFromPlan(work) : undefined),
    [work],
  );
  if (workId === null || !work || !plannedReport) {
    return (
      <WorkDetailStatusScreen
        state={status}
        titleRef={titleRef}
        onBack={() => navigation.goBack()}
      />
    );
  }

  return (
    <WorkDetailScreen
      work={work}
      titleRef={titleRef}
      onUnsavedReportChange={setHasUnsavedReport}
      plannedReport={plannedReport}
      initialReport={work.submission ? undefined : draft}
      // 입력이 바뀔 때마다 남겨 둔다. 앱이 언제 종료될지 JS 는 알 수 없다
      onReportChange={report => saveReportDraft(draftId, report, plannedReport)}
      onBack={() => navigation.goBack()}
      onDone={() => navigation.goBack()}
      onSubmitReport={async report => {
        // 서버가 받으면 상세를 새로 받아 제출 후 읽기 전용(#71)이 된다. 실패하면 입력을 둔 채 다시 낼 수 있다
        try {
          await submitReport(
            toSubmitCommand(
              workId,
              requireAssignment(work, detail.refetch),
              report,
            ),
          );
        } catch (error) {
          alertWorkError('submit', error);
          throw error;
        }
        clearReportDraft(draftId);
        return { kind: 'submitted', at: formatResultTime(new Date()) };
      }}
      // 작업전이면 상세에서 바로 시작한다 (홈 진행할 작업 카드의 "작업 시작" 과 같은 명령).
      // 성공하면 상세를 새로 받아 작업중이 되고 보고 영역이 열린다
      onStartWork={async () => {
        try {
          await startWork({
            workId,
            assignmentNumber: requireAssignment(work, detail.refetch),
          });
        } catch (error) {
          alertWorkError('start', error);
        }
      }}
      onCall={callPhone}
      onNavigate={openDirections}
      onPickPhoto={pickReportPhotos}
    />
  );
}

const sameMonths = (a: readonly YearMonth[], b: readonly YearMonth[]) =>
  a.length === b.length &&
  a.every((month, i) => month.year === b[i].year && month.month === b[i].month);

export function ScheduleRoute({
  navigation,
  route,
}: MainTabScreenProps<'schedule'>) {
  const listRef = useTabScrollToTop();
  const today = useToday();
  const subscribed = useIsFocused();
  // 고른 날의 달(먼저)과 펼친 달력의 달. 그 달들의 일정을 불러온다
  const [months, setMonths] = useState<YearMonth[]>(() => [monthOf(today)]);
  const periods = useMemo(() => months.map(monthPeriod), [months]);
  const confirmedSchedule = useMySchedules(periods, {
    subscribed,
    loadBy: 'first',
  });
  const pendingSchedule = useMySchedules(
    useMemo(() => pendingPeriods(today), [today]),
    { subscribed },
  );
  const acceptWork = useAcceptWork().mutateAsync;

  const confirmed = useMemo(
    () => confirmedOf(confirmedSchedule.works),
    [confirmedSchedule.works],
  );
  const pendingWorks = pendingSchedule.works;
  const pending = useMemo(() => pendingOf(pendingWorks), [pendingWorks]);

  const refetchAll = confirmedSchedule.refetch;
  const refetchPending = pendingSchedule.refetch;
  const { refreshing, onRefresh } = useRefresh(
    useCallback(
      () => Promise.all([refetchAll(), refetchPending()]),
      [refetchAll, refetchPending],
    ),
  );

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
  const changeMonths = useCallback(
    (next: YearMonth[]) =>
      setMonths(prev => (sameMonths(prev, next) ? prev : next)),
    [],
  );
  const accept = useCallback(
    async (id: string) => {
      try {
        await acceptWork(acceptCommandOf(pendingWorks, id));
        return true;
      } catch (error) {
        // 목록에 없는 요청(그사이 처리됨)은 보낼 배정 순번을 모른다. 목록을 다시 받는다
        if (error instanceof MissingAssignmentError) {
          refetchPending();
        }
        alertWorkError('accept', error);
        return false;
      }
    },
    [pendingWorks, acceptWork, refetchPending],
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
      confirmedLoad={confirmedSchedule.load}
      pendingLoad={pendingSchedule.load}
      onVisibleMonthsChange={changeMonths}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}

// 돌아갈 화면이 없으면(딥링크·복원) 탭 첫 화면으로 바꾼다
function leaveRootScreen(
  navigation: RootScreenProps<'RequestDetail' | 'RejectReason'>['navigation'],
) {
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    navigation.replace('Main');
  }
}

export function RequestDetailRoute({
  navigation,
  route,
}: RootScreenProps<'RequestDetail'>) {
  const { workId, detail, status } = useRouteWorkDetail(route.params.id);
  const acceptWork = useAcceptWork().mutateAsync;
  const titleRef = useFocusTitleOnOpen(navigation);
  const work = detail.data;
  if (workId === null || !work) {
    return (
      <WorkDetailStatusScreen
        state={status}
        titleRef={titleRef}
        onBack={() => leaveRootScreen(navigation)}
      />
    );
  }

  return (
    <RequestDetailScreen
      work={work}
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      onAccept={async () => {
        try {
          await acceptWork({
            workId,
            assignmentNumber: requireAssignment(work, detail.refetch),
          });
        } catch (error) {
          alertWorkError('accept', error);
          return false;
        }
        navigation.goBack();
        return true;
      }}
      onReject={() =>
        navigation.navigate('RejectReason', { id: route.params.id })
      }
      onCall={callPhone}
      onNavigate={openDirections}
    />
  );
}

export function RejectReasonRoute({
  navigation,
  route,
}: RootScreenProps<'RejectReason'>) {
  const requestId = route.params.id;
  const repository = useWorkRepository();
  const queryClient = useQueryClient();
  const rejectWork = useRejectWork().mutateAsync;
  // 거절 사유는 나갈 때 묻지 않으므로 화면을 스택에서 빼는 동작(제출·취소·뒤로·스와이프)이 곧 버리기로 한 것이다.
  // 앱이 종료될 때는 이 이벤트가 오지 않아 초안이 남는다.
  // 볼 수 없는 요청이면 아래 effect 가 닫으므로 그보다 먼저 듣는다 (effect 는 선언 순서대로 돈다).
  // 그렇게 닫을 때 요청이 확실히 없지 않으면(소속 문제) 잠시일 수 있어 고르던 사유를 남긴다 (#136, 작업 상세의 보고 초안과 같다)
  const keepDraftOnLeave = useRef(false);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        if (!keepDraftOnLeave.current) {
          clearRejectDraft(requestId);
        }
      }),
    [navigation, requestId],
  );
  // 이미 처리됐거나(거절함) 볼 수 없는 요청이면 빈 화면 대신 이전 화면으로 돌아간다
  // 거절 사유는 상세 값을 그리지 않는다. 볼 수 없는 요청인지만 보므로 오류가 바뀔 때만 다시 그린다
  const { workId, detail, unavailable, missing } = useRouteWorkDetail(
    requestId,
    { onlyErrors: true },
  );
  useEffect(() => {
    if (unavailable) {
      keepDraftOnLeave.current = !missing;
      leaveRootScreen(navigation);
    }
  }, [unavailable, missing, navigation]);
  const titleRef = useFocusTitleOnOpen(navigation);
  // 앱이 종료되기 전에 고르던 사유가 있으면 이어 고른다 (#34)
  const [draft] = useState(() => loadRejectDraft(requestId));
  if (unavailable || workId === null) {
    return null;
  }

  return (
    <RejectReasonScreen
      titleRef={titleRef}
      initialDraft={draft}
      onDraftChange={value => saveRejectDraft(requestId, value)}
      onBack={() => navigation.goBack()}
      onSubmit={async ({ key, note }) => {
        try {
          // 사유를 고르는 동안 상세가 아직 오지 않았을 수 있다
          const work = await queryClient.ensureQueryData(
            workDetailQuery(repository, workId),
          );
          await rejectWork({
            workId,
            assignmentNumber: requireAssignment(work, detail.refetch),
            reason: toRejectionReason(key),
            note,
          });
        } catch (error) {
          alertWorkError('reject', error);
          throw error;
        }
        // 요청 상세에서 왔어도 내 일정까지 돌아간다
        navigation.popTo('Main');
      }}
    />
  );
}

export function WorkHistoryRoute({
  navigation,
}: HistoryScreenProps<'WorkHistory'>) {
  const listRef = useTabScrollToTop();
  const today = useToday();
  const [month, setMonth] = useState(() => monthOf(today));
  const history = useWorkHistory(
    useMemo(() => monthPeriod(month), [month]),
    { subscribed: useIsFocused() },
  );
  const { refreshing, onRefresh } = useRefresh(history.refetch);
  const historyLoad = useLoadState(history);
  // 달을 바꾸는 동안 보이는 앞 달 결과는 목록에 쓰지 않는다 (누적 완료 수만 그대로 둔다)
  const ready = !history.isPlaceholderData;
  const data = history.data;
  const works = useMemo(
    () => (ready && data ? data.works.map(toCompletedWork) : []),
    [ready, data],
  );
  const openWork = useCallback(
    (id: string) => navigation.navigate('CompletedWorkDetail', { id }),
    [navigation],
  );

  return (
    <WorkHistoryScreen
      today={today}
      works={works}
      // 처음 불러오는 중이거나 서버가 주지 않으면 모른다('-')
      totalCompleted={data ? data.totalCompleted : null}
      onOpenWork={openWork}
      listRef={listRef}
      load={ready ? historyLoad : LOADING}
      onMonthChange={setMonth}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}

// 완료 작업 상세는 읽기 전용이라 제출 버튼이 늘 꺼져 있다. 불려도 성공으로 꾸미지 않는다
const rejectReadOnlySubmit = () =>
  Promise.reject(new Error('완료 작업은 다시 제출하지 않는다'));

// 완료한 작업의 상세. 보고를 제출한 작업이라 제출 후 읽기 전용(#69)으로 열린다
export function CompletedWorkDetailRoute({
  navigation,
  route,
}: HistoryScreenProps<'CompletedWorkDetail'>) {
  const { detail, status } = useRouteWorkDetail(route.params.id);
  const titleRef = useFocusTitleOnOpen(navigation);
  // 탭 안 스택이라, 스택 첫 화면(딥링크)에서 그냥 뒤로 가면 탭 내비게이터가 홈 탭으로 보낸다.
  // 첫 화면이면 작업 이력 목록으로 바꾸고, 아니면 이 화면만 닫는다 (위에 쌓인 화면은 남는다)
  const leave = useCallback(() => {
    if (navigation.getState().routes[0]?.key === route.key) {
      navigation.replace('WorkHistory');
    } else {
      navigation.goBack();
    }
  }, [navigation, route.key]);
  const work = detail.data;
  // 완료 보고가 없는 작업(아직 끝나지 않음)은 완료 작업 상세로 열지 않는다
  if (!work?.submission) {
    return (
      <WorkDetailStatusScreen
        state={work ? UNAVAILABLE : status}
        titleRef={titleRef}
        onBack={leave}
      />
    );
  }

  return (
    <WorkDetailScreen
      work={work}
      titleRef={titleRef}
      onBack={leave}
      onCall={callPhone}
      onNavigate={openDirections}
      // 제출을 마친 읽기 전용 보고라 제출·사진 추가·결과 모달은 일어나지 않는다
      onDone={leave}
      onSubmitReport={rejectReadOnlySubmit}
      onPickPhoto={async () => []}
    />
  );
}
