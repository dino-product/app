import { ApiError } from '../../../shared/api';
import { PHOTO_LIMIT } from '../model';
import { toWorkDetail } from './convert';
import { WorkErrorCode } from './errors';
import type {
  AssignmentResponse,
  CompletionReportResponse,
  HistoryWork,
  Period,
  RejectionReason,
  ScheduledWork,
  SubmitCompletionReportCommand,
  WorkDetailResponse,
  WorkRepository,
  WorkStatusCode,
} from './types';

// 테스트·픽스처용 작업 저장소. 운영은 기사 작업 API(HttpWorkRepository, #155)이고, 이 저장소는 앱 흐름·화면 테스트가 주입한다.
// 이 기기 메모리에서 백엔드 도메인 규칙(api-spec.md §2.4·§4, schedule 유스케이스)대로 작업 상태를 바꾼다. 오류는 서버와 같은 code 의 ApiError 다.
// 작업은 서버 작업 상세 응답 모양으로 들고, 상세는 HTTP 저장소와 같은 변환(toWorkDetail)을 거친다

const MINUTE = 60 * 1000;
/** 예정 시작 이만큼 전부터 시작할 수 있다 (WorkSchedule.START_LEAD_TIME) */
const START_LEAD_MS = 10 * MINUTE;
/** 조회 구간 최대 길이 */
const MAX_PERIOD_MS = 31 * 24 * 60 * MINUTE;
/** 거절 메모·사용 부품·수행 메모 최대 글자 수 */
const MAX_TEXT_LENGTH = 255;

// 기사에게 보이는 작업. 거절하면 대기함(REGISTERED)으로 돌아가 보이지 않는다
const visible = (work: WorkDetailResponse) => work.status !== 'REGISTERED';
// 내 일정에 나오는 상태
const scheduled: readonly WorkStatusCode[] = [
  'PENDING_ACCEPT',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
];
const rejectionReasons: readonly RejectionReason[] = [
  'SCHEDULE_CONFLICT',
  'ALREADY_ASSIGNED',
  'LOCATION_TOO_FAR',
  'SCOPE_MISMATCH',
  'OTHER',
];

const errors = {
  notFound: () =>
    new ApiError({
      kind: 'http',
      status: 404,
      code: WorkErrorCode.notFound,
      message: '작업을 찾을 수 없습니다.',
    }),
  invalidState: () =>
    new ApiError({
      kind: 'http',
      status: 409,
      code: WorkErrorCode.invalidState,
      message: '작업의 현재 상태에서는 요청한 처리를 할 수 없습니다.',
    }),
  invalidInput: () =>
    new ApiError({
      kind: 'http',
      status: 400,
      code: WorkErrorCode.invalidInput,
      message: '작업 요청 값이 올바르지 않습니다.',
    }),
  notAssignee: () =>
    new ApiError({
      kind: 'http',
      status: 403,
      code: WorkErrorCode.notAssignee,
      message: '담당 기사가 아닙니다.',
    }),
  assignmentChanged: () =>
    new ApiError({
      kind: 'http',
      status: 409,
      code: WorkErrorCode.assignmentChanged,
      message: '배정이 바뀌었습니다. 최신 배정을 확인해 주세요.',
    }),
  tooEarlyToStart: () =>
    new ApiError({
      kind: 'http',
      status: 409,
      code: WorkErrorCode.tooEarlyToStart,
      message: '아직 작업을 시작할 수 없습니다.',
    }),
  startTimePassed: () =>
    new ApiError({
      kind: 'http',
      status: 409,
      code: WorkErrorCode.startTimePassed,
      message:
        '예정 시간이 지나 시작할 수 없습니다. 사무실에 일정 변경을 요청해 주세요.',
    }),
};

// 저장한 값을 밖으로 내보내거나 받을 때 복사한다 (JSON 으로 받은 모양 그대로라 JSON 으로 복사된다)
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const time = (instant: string | null | undefined) =>
  instant ? Date.parse(instant) : NaN;

function requirePeriod({ from, to }: Period) {
  const length = time(to) - time(from);
  if (!(length > 0 && length <= MAX_PERIOD_MS)) {
    throw errors.invalidInput();
  }
}

// 반열림 구간 [from, to) 와 일정 [start, end) 가 겹치는지
function overlaps(work: WorkDetailResponse, { from, to }: Period) {
  return (
    work.schedule !== null &&
    time(work.schedule.startTime) < time(to) &&
    time(work.schedule.endTime) > time(from)
  );
}

const byStart = (a: WorkDetailResponse, b: WorkDetailResponse) =>
  time(a.schedule?.startTime) - time(b.schedule?.startTime) ||
  a.workId - b.workId;

const blankToNull = (value: string | null) =>
  value === null || value.trim() === '' ? null : value;

export function createLocalWorkRepository({
  seed,
  organizationName = null,
  now = () => new Date(),
}: {
  /** 처음 데이터. 서버 작업 상세 응답 모양. 운영은 빈 목록이고 테스트가 시드(localSeedTesting.ts)를 넣는다 */
  seed: readonly WorkDetailResponse[];
  /** 목록 행의 업체명. 작업 상세 응답에 없어 따로 받는다. 없으면 HTTP 처럼 null */
  organizationName?: string | null;
  now?: () => Date;
}): WorkRepository {
  let works: WorkDetailResponse[] = copy([...seed]);

  // 조회 시각 기준 지연: 예정 종료가 지났는데 끝나지 않았거나, 예정 종료 시각이나 그 뒤에 완료했다. 취소는 지연이 아니다
  function isDelayed(work: WorkDetailResponse) {
    const end = time(work.schedule?.endTime);
    if (work.status === 'COMPLETED') {
      return time(work.completedAt) >= end;
    }
    return (
      ['PENDING_ACCEPT', 'ACCEPTED', 'IN_PROGRESS'].includes(work.status) &&
      now().getTime() >= end
    );
  }

  const view = (work: WorkDetailResponse): WorkDetailResponse => ({
    ...copy(work),
    delayed: isDelayed(work),
  });

  function requireWork(workId: number) {
    const work = works.find(item => item.workId === workId && visible(item));
    if (!work) {
      throw errors.notFound();
    }
    return work;
  }

  // 기사 명령 공통: 화면에서 본 배정이 지금 배정인지 (없으면 -009, 지난 배정이면 -010)
  function requireCurrentAssignment(
    work: WorkDetailResponse,
    assignmentNumber: number,
  ): AssignmentResponse {
    if (!Number.isInteger(assignmentNumber) || assignmentNumber < 1) {
      throw errors.invalidInput();
    }
    const assignment = work.assignments.find(
      item => item.assignmentNumber === assignmentNumber,
    );
    if (!assignment) {
      throw errors.notAssignee();
    }
    if (assignment !== work.assignments[work.assignments.length - 1]) {
      throw errors.assignmentChanged();
    }
    return assignment;
  }

  // 백엔드 Rejection: 사유 필수, 기타만 메모(공백→미입력, 필수, 255자)
  function requireRejection(reason: RejectionReason, note: string | null) {
    const text = blankToNull(note);
    const valid =
      rejectionReasons.includes(reason) &&
      (reason === 'OTHER'
        ? text !== null && text.length <= MAX_TEXT_LENGTH
        : text === null);
    if (!valid) {
      throw errors.invalidInput();
    }
    return text;
  }

  // 백엔드 CompletionReport: 사진 각 6장·null 없음, 부품·메모 255자(공백→null), 금액 0 이상
  function toReport(
    command: SubmitCompletionReportCommand,
  ): CompletionReportResponse {
    const photos = (ids: readonly string[]) => {
      if (ids.length > PHOTO_LIMIT || ids.some(id => typeof id !== 'string')) {
        throw errors.invalidInput();
      }
      return ids.map(id => ({ photoId: id, url: id }));
    };
    const text = (value: string | null) => {
      const normalized = blankToNull(value);
      if (normalized !== null && normalized.length > MAX_TEXT_LENGTH) {
        throw errors.invalidInput();
      }
      return normalized;
    };
    if (command.actualFee !== null && !(command.actualFee >= 0)) {
      throw errors.invalidInput();
    }
    return {
      beforePhotos: photos(command.beforePhotos),
      afterPhotos: photos(command.afterPhotos),
      usedParts: text(command.usedParts),
      workNote: text(command.workNote),
      actualFee: command.actualFee,
      actualPaymentMethod: command.actualPaymentMethod,
    };
  }

  const nowInstant = () => now().toISOString();

  const repository: WorkRepository = {
    async getMySchedule(period) {
      requirePeriod(period);
      return {
        works: works
          .filter(
            work => scheduled.includes(work.status) && overlaps(work, period),
          )
          .sort(byStart)
          .map(
            (work): ScheduledWork => ({
              workId: work.workId,
              name: work.name,
              status: work.status,
              assignmentNumber:
                work.assignments[work.assignments.length - 1]
                  ?.assignmentNumber ?? 0,
              startTime: work.schedule!.startTime,
              endTime: work.schedule!.endTime,
              customerAddress: work.customer?.address ?? null,
              customerAddressDetail: work.customer?.addressDetail ?? null,
              delayed: isDelayed(work),
              customerName: work.customer?.name ?? null,
              organizationName,
            }),
          ),
      };
    },

    async getWorkDetail(workId) {
      return toWorkDetail(view(requireWork(workId)));
    },

    async acceptWork({ workId, assignmentNumber }) {
      const work = requireWork(workId);
      const assignment = requireCurrentAssignment(work, assignmentNumber);
      // 같은 배정에 다시 보내면 바꾸지 않고 성공한다
      if (assignment.result === 'ACCEPTED') {
        return;
      }
      if (work.status !== 'PENDING_ACCEPT') {
        throw errors.invalidState();
      }
      work.status = 'ACCEPTED';
      assignment.result = 'ACCEPTED';
      assignment.decidedAt = nowInstant();
    },

    async rejectWork({ workId, assignmentNumber, reason, note }) {
      const work = requireWork(workId);
      const text = requireRejection(reason, note);
      const assignment = requireCurrentAssignment(work, assignmentNumber);
      if (work.status !== 'PENDING_ACCEPT') {
        throw errors.invalidState();
      }
      // 대기함으로 돌아가 기사 목록에서 사라진다 (다시 보내면 404)
      work.status = 'REGISTERED';
      assignment.result = 'REJECTED';
      assignment.decidedAt = nowInstant();
      assignment.rejectionReason = reason;
      assignment.rejectionNote = text;
    },

    async startWork({ workId, assignmentNumber }) {
      const work = requireWork(workId);
      const assignment = requireCurrentAssignment(work, assignmentNumber);
      // 이미 시작한 작업(완료 포함)에 다시 보내면 바꾸지 않고 성공한다
      if (work.startedAt !== null) {
        return;
      }
      if (work.status !== 'ACCEPTED') {
        throw errors.invalidState();
      }
      const at = now().getTime();
      if (time(assignment.schedule.startTime) - at > START_LEAD_MS) {
        throw errors.tooEarlyToStart();
      }
      if (at > time(assignment.schedule.endTime)) {
        throw errors.startTimePassed();
      }
      work.status = 'IN_PROGRESS';
      work.startedAt = nowInstant();
    },

    async submitCompletionReport(command) {
      const work = requireWork(command.workId);
      const report = toReport(command);
      requireCurrentAssignment(work, command.assignmentNumber);
      // 같은 내용을 다시 보내면 성공한다. 제출 후에는 고칠 수 없다
      if (
        work.status === 'COMPLETED' &&
        JSON.stringify(work.completionReport) === JSON.stringify(report)
      ) {
        return;
      }
      if (work.status !== 'IN_PROGRESS') {
        throw errors.invalidState();
      }
      work.status = 'COMPLETED';
      work.completedAt = nowInstant();
      work.completionReport = report;
    },

    async getWorkHistory(period) {
      requirePeriod(period);
      const completed = works.filter(work => work.status === 'COMPLETED');
      const inPeriod = completed
        .filter(work => overlaps(work, period))
        .sort((a, b) => byStart(b, a));
      const startsIn = (work: WorkDetailResponse) =>
        time(work.schedule?.startTime) >= time(period.from) &&
        time(work.schedule?.startTime) < time(period.to);
      return {
        works: inPeriod.map((work): HistoryWork => {
          const assignment = work.assignments[work.assignments.length - 1];
          return {
            workId: work.workId,
            name: work.name,
            status: work.status,
            current: true,
            assignmentNumber: assignment?.assignmentNumber ?? 0,
            startTime: work.schedule!.startTime,
            endTime: work.schedule!.endTime,
            result: assignment?.result ?? 'ACCEPTED',
            endReason: assignment?.endReason ?? null,
            customerName: work.customer?.name ?? null,
            customerAddress: work.customer?.address ?? null,
            customerAddressDetail: work.customer?.addressDetail ?? null,
            organizationName,
          };
        }),
        statistics: {
          assigned: inPeriod.length,
          completed: inPeriod.filter(startsIn).length,
          rejected: 0,
          cancelled: 0,
        },
        totalCompleted: completed.length,
      };
    },

    // 처음 데이터로 되돌린다 (로그아웃·계정 전환)
    reset() {
      works = copy([...seed]);
    },
  };
  return repository;
}
