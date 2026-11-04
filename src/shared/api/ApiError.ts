// 서버·네트워크 실패를 한 모양으로 던진다. 사용법: `if (isApiError(error, ApiErrorCode.conflict)) …`
// 화면은 HTTP 상태보다 code 로 나눈다 (백엔드 규칙: code 는 상태와 따로 정해지고 다시 쓰지 않는다)

/** http: 서버가 실패로 답함 · network: 서버에 닿지 못함 · timeout: 15초 안에 답이 없음 · config: API 주소가 없음 */
export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'config';

/** 토대와 여러 화면이 같이 보는 오류 코드 (백엔드 CommonErrorCode·AuthErrorCode). 모듈별 코드는 그 기능 쪽에 둔다 */
export const ApiErrorCode = {
  /** 요청 값 형식 오류. 검증 실패면 fieldErrors·violations 가 붙는다 */
  badRequest: 'COMMON-400',
  /** 토큰 없이 인증 경로를 불렀다 */
  noToken: 'COMMON-401',
  forbidden: 'COMMON-403',
  /** 없는 경로·자원, 또는 만료·폐기된 access token (본문이 같아 구분할 수 없다) */
  notFound: 'COMMON-404',
  conflict: 'COMMON-409',
  serverError: 'COMMON-500',
  /** 잠시 후 다시 (Retry-After 헤더) */
  unavailable: 'COMMON-503',
  /** refresh token 무효 → 다시 로그인 */
  refreshRejected: 'AUTH-009',
} as const;

export const ApiErrorMessage = {
  network: '네트워크에 연결할 수 없습니다.',
  timeout: '서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.',
  config: 'API 서버 주소가 설정되지 않았습니다.',
  invalidResponse: '서버 응답을 처리하지 못했습니다.',
} as const;

type ApiErrorInit = {
  kind: ApiErrorKind;
  message: string;
  status?: number;
  code?: string;
  fieldErrors?: Readonly<Record<string, readonly string[]>>;
  violations?: readonly string[];
  cause?: unknown;
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP 상태 (kind 'http' 일 때) */
  readonly status?: number;
  /** 서버 봉투의 code (봉투가 아닌 본문이면 없다) */
  readonly code?: string;
  /** 본문 검증 실패: { 필드명: [메시지] } */
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
  /** 경로·쿼리 검증 실패: [메시지] */
  readonly violations?: readonly string[];
  readonly cause?: unknown;

  constructor({
    kind,
    message,
    status,
    code,
    fieldErrors,
    violations,
    cause,
  }: ApiErrorInit) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.violations = violations;
    this.cause = cause;
  }
}

/** ApiError 인지, code 를 주면 그 코드인지까지 본다 */
export function isApiError(error: unknown, code?: string): error is ApiError {
  return (
    error instanceof ApiError && (code === undefined || error.code === code)
  );
}
