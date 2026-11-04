// 서버 작업 상태 (schedule/domain/WorkStatus, api-spec.md §4.1). 화면 모델(model.ts)과 포트 타입(types.ts)이 같이 쓴다
export type WorkStatusCode =
  | 'REGISTERED'
  | 'PENDING_ACCEPT'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELED';
