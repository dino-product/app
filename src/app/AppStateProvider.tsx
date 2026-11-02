import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from 'react';
import { makeScheduleMock } from '../features/schedule/mockData';
import type {
  ConfirmedSchedule,
  PendingRequest,
} from '../features/schedule/model';
import { useScheduleStore } from '../features/schedule/useScheduleStore';
import type { ReportSubmission } from '../features/work/model';

// 화면을 오가도 남아야 하는 상태. API 연동 전까지 목 데이터로 들고 있는다.
type WorkSession = {
  /** 진행할 작업을 시작했는지 */
  started: boolean;
  setStarted: (started: boolean) => void;
  /** 작업 id 별로 제출을 마친 완료 보고. 다시 열면 읽기 전용으로 보여준다 */
  submissions: Readonly<Record<string, ReportSubmission>>;
  saveSubmission: (workId: string, submission: ReportSubmission) => void;
};

type ScheduleState = {
  today: Date;
  confirmed: readonly ConfirmedSchedule[];
  pending: readonly PendingRequest[];
  accept: (id: string) => void;
  reject: (id: string) => void;
};

const WorkSessionContext = createContext<WorkSession | null>(null);
const ScheduleContext = createContext<ScheduleState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [started, setStarted] = useState(false);
  const [submissions, setSubmissions] = useState<
    Readonly<Record<string, ReportSubmission>>
  >({});
  const saveSubmission = useCallback(
    (workId: string, submission: ReportSubmission) =>
      setSubmissions(prev => ({ ...prev, [workId]: submission })),
    [],
  );
  const [today] = useState(() => new Date());
  const [initialSchedule] = useState(() => makeScheduleMock(today));
  const { confirmed, pending, accept, reject } =
    useScheduleStore(initialSchedule);

  // 한쪽이 바뀔 때 다른 탭 화면까지 다시 그리지 않도록 컨텍스트를 나눈다
  const work = useMemo(
    () => ({ started, setStarted, submissions, saveSubmission }),
    [started, submissions, saveSubmission],
  );
  const schedule = useMemo(
    () => ({ today, confirmed, pending, accept, reject }),
    [today, confirmed, pending, accept, reject],
  );

  return (
    <WorkSessionContext.Provider value={work}>
      <ScheduleContext.Provider value={schedule}>
        {children}
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
