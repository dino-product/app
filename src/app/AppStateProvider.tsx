import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from 'react';
import { makeHistoryMock } from '../features/history/mockData';
import type { CompletedWork } from '../features/history/model';
import { makeScheduleMock } from '../features/schedule/mockData';
import type {
  ConfirmedSchedule,
  PendingRequest,
} from '../features/schedule/model';
import { useScheduleStore } from '../features/schedule/useScheduleStore';
import type { ReportSubmission } from '../features/work/model';
import { useAuth } from './AuthProvider';

// 화면을 오가도 남아야 하는 상태. API 연동 전까지 목 데이터로 들고 있는다.
type WorkSession = {
  /** 진행할 작업을 시작했는지 */
  started: boolean;
  setStarted: (started: boolean) => void;
  /** 작업 id 별로 제출을 마친 완료 보고. 다시 열면 읽기 전용으로 보여준다 */
  submissions: Readonly<Partial<Record<string, ReportSubmission>>>;
  saveSubmission: (workId: string, submission: ReportSubmission) => void;
  clearSubmission: (workId: string) => void;
};

type ScheduleState = {
  today: Date;
  confirmed: readonly ConfirmedSchedule[];
  pending: readonly PendingRequest[];
  accept: (id: string) => void;
  reject: (id: string) => void;
};

type HistoryState = {
  today: Date;
  /** 완료한 작업 전부 */
  works: readonly CompletedWork[];
};

const WorkSessionContext = createContext<WorkSession | null>(null);
const ScheduleContext = createContext<ScheduleState | null>(null);
const HistoryContext = createContext<HistoryState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [started, setStarted] = useState(false);
  const [submissions, setSubmissions] = useState<
    Readonly<Partial<Record<string, ReportSubmission>>>
  >({});
  const saveSubmission = useCallback(
    (workId: string, submission: ReportSubmission) =>
      setSubmissions(prev => ({ ...prev, [workId]: submission })),
    [],
  );
  const clearSubmission = useCallback(
    (workId: string) =>
      setSubmissions(prev => {
        if (!(workId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[workId];
        return next;
      }),
    [],
  );
  const [today] = useState(() => new Date());
  const [initialSchedule] = useState(() => makeScheduleMock(today));
  const { confirmed, pending, accept, reject, reset } =
    useScheduleStore(initialSchedule);

  // 로그아웃·탈퇴하면 이 기기에 들고 있던 목 상태를 비운다. 다른 계정으로 로그인해도 앞 계정의 작업·제출·수락이 남지 않는다
  // (API 연동 뒤에는 로그인한 계정의 상태를 서버가 다시 준다). 렌더 중에 바꿔 로그인 화면이 비운 상태로 바로 그려진다
  const { signedIn } = useAuth();
  const [account, setAccount] = useState(signedIn);
  if (signedIn !== account) {
    setAccount(signedIn);
    if (!signedIn) {
      setStarted(false);
      setSubmissions({});
      reset();
    }
  }
  // 완료 이력은 이 앱에서 바뀌지 않으므로 처음 한 번 만든 값을 그대로 넘긴다
  const [history] = useState(() => ({
    today,
    works: makeHistoryMock(today),
  }));

  // 한쪽이 바뀔 때 다른 탭 화면까지 다시 그리지 않도록 컨텍스트를 나눈다
  const work = useMemo(
    () => ({
      started,
      setStarted,
      submissions,
      saveSubmission,
      clearSubmission,
    }),
    [started, submissions, saveSubmission, clearSubmission],
  );
  const schedule = useMemo(
    () => ({ today, confirmed, pending, accept, reject }),
    [today, confirmed, pending, accept, reject],
  );

  return (
    <WorkSessionContext.Provider value={work}>
      <ScheduleContext.Provider value={schedule}>
        <HistoryContext.Provider value={history}>
          {children}
        </HistoryContext.Provider>
      </ScheduleContext.Provider>
    </WorkSessionContext.Provider>
  );
}

function useRequired<T>(context: Context<T | null>): T {
  const value = useContext(context);
  if (value === null) {
    throw new Error('AppStateProvider 안에서만 쓸 수 있다');
  }
  return value;
}

export const useWorkSession = () => useRequired(WorkSessionContext);
export const useSchedule = () => useRequired(ScheduleContext);
export const useHistory = () => useRequired(HistoryContext);
