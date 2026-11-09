import type { WorkDetail } from '../model';
import type { WorkStatusCode } from './status';

// 작업 데이터 포트(WorkRepository)와 주고받는 값, 그리고 기사 작업 API 의 요청·응답 본문(*Request·*Response).
// 이름은 백엔드 schedule 모듈의 웹 DTO(adapter/in/web)를 따른다 (Dino develop 79b47ad8, #155).
// 발주사(organizationId)는 저장소가 정한다: HTTP 는 소속 목록의 기사 발주사, 로컬(테스트)은 쓰지 않는다

// 작업 상태는 화면 모델(model.ts)도 쓰므로 status.ts 에 따로 둔다 (model ↔ types 가 서로 가져오지 않게)
export type { WorkStatusCode };

/** 배정 응답 결과 */
export type AssignmentResult =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN';

/** 배정이 끝난 방식. CANCELLED 는 L 이 두 개다 */
export type AssignmentEndReason =
  | 'REASSIGNED'
  | 'RESCHEDULED'
  | 'UNASSIGNED'
  | 'CANCELLED'
  | 'ACCOUNT_WITHDRAWN';

/** 거절 사유 (객관식 5종). OTHER 만 메모를 받는다 */
export type RejectionReason =
  | 'SCHEDULE_CONFLICT'
  | 'ALREADY_ASSIGNED'
  | 'LOCATION_TOO_FAR'
  | 'SCOPE_MISMATCH'
  | 'OTHER';

/** 등록 때 정한 결제 방식 (PaymentMethod) */
export type PlannedPaymentMethod =
  | 'ON_SITE_CARD'
  | 'ON_SITE_CASH'
  | 'BANK_TRANSFER'
  | 'INVOICE';

/** 완료 보고의 실제 결제 방식 (ActualPaymentMethod) */
export type ActualPaymentMethod =
  | 'CREDIT_CARD'
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'INVOICE';

export type CancellationReason =
  | 'CUSTOMER_REQUEST'
  | 'TECHNICIAN_ISSUE'
  | 'DUPLICATE_REGISTRATION'
  | 'OTHER';

/** 시각은 모두 ISO-8601 UTC 문자열 */
export type Instant = string;

export type LabelResponse = {
  id: number;
  name: string | null;
  color: string | null;
};

export type TechnicianResponse = {
  technicianId: number;
  name: string | null;
  technicianType: LabelResponse | null;
};

export type PhotoResponse = { photoId: string; url: string };

export type ScheduleResponse = {
  technician: TechnicianResponse | null;
  startTime: Instant;
  expectedDurationMinutes: number;
  endTime: Instant;
};

export type AssignmentResponse = {
  assignmentNumber: number;
  schedule: ScheduleResponse;
  assignedAt: Instant;
  assignedBy: number;
  result: AssignmentResult;
  decidedAt: Instant | null;
  rejectionReason: RejectionReason | null;
  rejectionNote: string | null;
  endReason: AssignmentEndReason | null;
  endedAt: Instant | null;
  endedBy: number | null;
};

export type CompletionReportResponse = {
  beforePhotos: PhotoResponse[];
  afterPhotos: PhotoResponse[];
  usedParts: string | null;
  workNote: string | null;
  actualFee: number | null;
  actualPaymentMethod: ActualPaymentMethod | null;
};

/** GET /api/v1/organizations/{organizationId}/works/{workId} 의 result (WorkDetailResponse, 기사 시점) */
export type WorkDetailResponse = {
  workId: number;
  name: string;
  status: WorkStatusCode;
  delayed: boolean;
  workType: LabelResponse | null;
  /** 기사에게는 null */
  registrar: unknown;
  registeredAt: Instant;
  customer: {
    name: string | null;
    phone: string | null;
    postalCode: string | null;
    address: string | null;
    addressDetail: string | null;
    /** 기본주소가 없거나 서버가 좌표를 구하지 못했으면 null. 그때는 주소로 길찾기한다 */
    location: LocationResponse | null;
  } | null;
  payment: { fee: number | null; method: PlannedPaymentMethod | null } | null;
  schedule: ScheduleResponse | null;
  plannedSchedule: unknown;
  /** 기사에게는 지금 자기 배정 하나만 (원래 순번 그대로) */
  assignments: AssignmentResponse[];
  startedAt: Instant | null;
  completedAt: Instant | null;
  cancellation: {
    cancelledAt: Instant;
    cancelledBy: number;
    reason: CancellationReason;
    note: string | null;
  } | null;
  completionReport: CompletionReportResponse | null;
  sitePhotos: PhotoResponse[];
  /** 기사에게는 빈 목록 */
  completionReportRequests: unknown[];
  completionReportRequestable: boolean;
  version: number;
};

/** 조회 구간 [from, to). 백엔드 규칙: from 보다 to 가 늦고 최대 31일 */
export type Period = { from: Instant; to: Instant };

/** 현장 좌표 (LocationResponse, WGS84 소수점 6자리). 주소가 없거나 서버가 구하지 못했으면 null 로 온다 */
export type LocationResponse = { latitude: number; longitude: number };

/** GET …/my-schedule · …/my-schedule/pending 의 행 (MyScheduleResponse.ScheduledWork) */
export type ScheduledWorkResponse = {
  workId: number;
  name: string;
  /** my-schedule 은 ACCEPTED·IN_PROGRESS·COMPLETED, pending 은 PENDING_ACCEPT */
  status: WorkStatusCode;
  assignmentNumber: number;
  startTime: Instant;
  endTime: Instant;
  customerName: string | null;
  customerAddress: string | null;
  customerAddressDetail: string | null;
  customerLocation: LocationResponse | null;
  delayed: boolean;
};

/**
 * GET /api/v1/organizations/{organizationId}/my-schedule?from&to (구간과 겹치는 확정 일정, 수락 대기 제외)
 * · …/my-schedule/pending (날짜와 관계없이 수락 대기 전부) 의 result. 시작 시각·작업 id 순
 */
export type MyScheduleResponse = { works: ScheduledWorkResponse[] };

/** GET …/work-history 의 행 (WorkHistoryResponse.AssignedWork). 고객 정보는 없다 */
export type AssignedWorkResponse = {
  workId: number;
  name: string;
  status: WorkStatusCode;
  current: boolean;
  assignmentNumber: number;
  startTime: Instant;
  endTime: Instant;
  result: AssignmentResult;
  endReason: AssignmentEndReason | null;
  workType: LabelResponse | null;
  startedAt: Instant | null;
  completedAt: Instant | null;
};

/** GET /api/v1/organizations/{organizationId}/work-history?from&to 의 result (기사 본인 조회: 본인이 완료한 작업만) */
export type WorkHistoryResponse = {
  technicianId: number;
  /** 최근 먼저 */
  works: AssignedWorkResponse[];
  statistics: {
    assigned: number;
    completed: number;
    rejected: number;
    cancelled: number;
  };
  /** 구간과 관계없는 누적 완료 수 */
  totalCompleted: number;
};

/** POST …/works/{workId}/acceptance · …/start 본문 (AssignmentNumberRequest) */
export type AssignmentNumberRequest = { assignmentNumber: number };

/** POST …/works/{workId}/rejection 본문 (RejectWorkRequest). OTHER 가 아니면 note 는 null */
export type RejectWorkRequest = {
  assignmentNumber: number;
  reason: RejectionReason;
  note: string | null;
};

/** POST …/works/{workId}/completion-report 본문 (SubmitCompletionReportRequest). 사진은 업로드 발급의 fileId */
export type SubmitCompletionReportRequest = {
  assignmentNumber: number;
  beforePhotoIds: string[];
  afterPhotoIds: string[];
  usedParts: string | null;
  workNote: string | null;
  actualFee: number | null;
  actualPaymentMethod: ActualPaymentMethod | null;
};

/** POST …/works/{workId}/completion-photo-uploads 본문 (PhotoUploadRequest) */
export type PhotoUploadRequest = { contentType: string; sizeBytes: number };

/** 업로드 주소 발급 result (PhotoUploadResponse). uploadUrl 에 requiredHeaders 를 붙여 사진 바이트를 PUT 한다 (10분 안에) */
export type PhotoUploadResponse = {
  fileId: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: Instant;
};

/**
 * 내 일정의 작업 하나 (MyScheduleResponse.ScheduledWork).
 * organizationName 은 목록 행에 보이는 값인데 백엔드 행에 없어, HTTP 저장소는 경로의 발주사(소속 목록) 이름으로 채운다.
 * 로컬 저장소(테스트)는 작업의 고객과 만들 때 받은 업체명(없으면 null)으로 채운다
 */
export type ScheduledWork = {
  workId: number;
  name: string;
  status: WorkStatusCode;
  /** 지금 배정의 순번. 수락·거절·시작·완료 보고에 그대로 쓴다 */
  assignmentNumber: number;
  startTime: Instant;
  endTime: Instant;
  customerAddress: string | null;
  customerAddressDetail: string | null;
  delayed: boolean;
  customerName: string | null;
  /** 백엔드 행에 없음: HTTP 는 경로의 발주사 이름(소속 목록에서 찾지 못하면 null) */
  organizationName: string | null;
};

/** 구간과 일정이 겹치는, 지금 본인이 담당인 작업(수락대기·수락됨·작업중·완료). 시작 시각, 작업 id 순 */
export type MySchedule = { works: ScheduledWork[] };

/**
 * 작업 이력의 작업 하나 (WorkHistoryResponse.AssignedWork, 기사 본인 조회라 본인이 완료한 작업만).
 * 고객 값은 목록 행에 보이는 값인데 백엔드 행에 없다 (#112 G14). HTTP 저장소는 null 을 주고 화면은 '-' 로 보인다.
 * 발주사 이름은 내 일정과 같이 경로의 발주사 이름으로 채운다
 */
export type HistoryWork = {
  workId: number;
  name: string;
  status: WorkStatusCode;
  current: boolean;
  assignmentNumber: number;
  startTime: Instant;
  endTime: Instant;
  result: AssignmentResult;
  endReason: AssignmentEndReason | null;
  /** 백엔드 행에 없음: HTTP 는 null */
  customerName: string | null;
  /** 백엔드 행에 없음: HTTP 는 null */
  customerAddress: string | null;
  /** 백엔드 행에 없음: HTTP 는 null */
  customerAddressDetail: string | null;
  /** 백엔드 행에 없음: HTTP 는 경로의 발주사 이름(소속 목록에서 찾지 못하면 null) */
  organizationName: string | null;
};

export type WorkHistory = {
  /** 최근 먼저 */
  works: HistoryWork[];
  /** 구간 통계. 기사 본인 조회라 rejected·cancelled 는 0 */
  statistics: {
    assigned: number;
    completed: number;
    rejected: number;
    cancelled: number;
  };
  /** 지금까지 완료한 작업 수 (화면의 누적 완료). null 이면 화면은 '-' */
  totalCompleted: number | null;
};

/** 수락 (AcceptWorkCommand) */
export type AcceptWorkCommand = { workId: number; assignmentNumber: number };

/** 거절 (RejectWorkCommand). OTHER 면 note 필수(최대 255자), 다른 사유면 note 는 null */
export type RejectWorkCommand = {
  workId: number;
  assignmentNumber: number;
  reason: RejectionReason;
  note: string | null;
};

/** 시작 (StartWorkCommand). 예정 시작 10분 전부터 예정 종료까지만 */
export type StartWorkCommand = { workId: number; assignmentNumber: number };

/**
 * 완료 보고 제출 (SubmitCompletionReportCommand). 사진은 기기 사진(촬영·앨범)의 로컬 URI, 각 최대 6장.
 * HTTP 저장소가 한 장씩 업로드 API 로 올리고 받은 파일 식별자로 제출한다
 */
export type SubmitCompletionReportCommand = {
  workId: number;
  assignmentNumber: number;
  beforePhotos: string[];
  afterPhotos: string[];
  /** 최대 255자, 공백만이면 null */
  usedParts: string | null;
  /** 최대 255자, 공백만이면 null */
  workNote: string | null;
  /** 원, 0 이상 */
  actualFee: number | null;
  actualPaymentMethod: ActualPaymentMethod | null;
};

type ReadOptions = { signal?: AbortSignal };

/**
 * 작업 상세 조회 옵션. organizationId 는 알림처럼 발주사를 아는 곳에서 연 작업 (#117).
 * 없으면 HTTP 저장소가 소속 목록의 활성 기사 소속으로 정한다. 로컬 저장소는 발주사를 쓰지 않는다
 */
type DetailOptions = ReadOptions & { organizationId?: number };

/**
 * 작업 데이터 포트. 화면은 React Query 훅(data/queries.ts)으로만 쓴다.
 * 구현: HttpWorkRepository(운영, 기사 작업 API), LocalWorkRepository(테스트·픽스처용 기기 안 저장소). 운영 저장소를 만드는 곳은 data/config.ts
 */
export type WorkRepository = {
  /** 내 일정 (기간) */
  getMySchedule(period: Period, options?: ReadOptions): Promise<MySchedule>;
  /** 응답 필요: 날짜와 관계없이 지금 본인에게 배정돼 수락·거절을 기다리는 작업(수락 대기) 전부. 시작 시각, 작업 id 순 */
  getPendingWorks(options?: ReadOptions): Promise<MySchedule>;
  /** 작업 상세를 화면 모델로 */
  getWorkDetail(workId: number, options?: DetailOptions): Promise<WorkDetail>;
  acceptWork(command: AcceptWorkCommand): Promise<void>;
  rejectWork(command: RejectWorkCommand): Promise<void>;
  startWork(command: StartWorkCommand): Promise<void>;
  submitCompletionReport(command: SubmitCompletionReportCommand): Promise<void>;
  /** 작업 이력 (월) */
  getWorkHistory(period: Period, options?: ReadOptions): Promise<WorkHistory>;
  /** 로그아웃·계정 전환 때 이 기기에 들고 있는 작업 상태를 처음으로 돌린다. HTTP 저장소는 올려 두고 아직 제출하지 않은 사진 식별자를 잊는다 */
  reset(): void;
};
