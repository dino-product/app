import type { WorkDetail } from '../model';
import { workStatusChip } from './convert';
import type { MySchedule, Period, ScheduledWork } from './types';

// 응답(수락·거절)의 낙관 반영 (#197). 캐시는 서버 값 그대로 두고, 보내는 중인 응답을 그 위에 얹어 화면 값을 만든다.
// 그래서 응답을 보내는 동안 어떤 조회(재포커스·당겨서 새로고침)가 와도 흔들리지 않고, 실패한 응답은 진행 중에서 빠져
// 저절로 보내기 전으로 돌아간다. 바뀔 것이 없으면 받은 값을 그대로(같은 객체로) 돌려준다 (다시 그리지 않게)

/** 보내는 중인 응답 하나. 성공한 응답은 서버 값을 다시 받을 때까지 보내는 중이다 */
export type RespondingWork = {
  kind: 'accept' | 'reject';
  workId: number;
  /** 수락: 보낼 때 응답 필요에 있던 행. 내 일정에 수락 대기가 없으면(운영 API) 이 행을 작업전으로 끼워 그린다 */
  request?: ScheduledWork;
};

const byStart = (a: ScheduledWork, b: ScheduledWork) =>
  Date.parse(a.startTime) - Date.parse(b.startTime) || a.workId - b.workId;

// 반열림 구간 [from, to) 과 일정이 겹치는지 (서버의 내 일정 조회와 같다)
const overlaps = (work: ScheduledWork, { from, to }: Period) =>
  Date.parse(work.startTime) < Date.parse(to) &&
  Date.parse(work.endTime) > Date.parse(from);

/** 응답 필요: 수락·거절을 보낸 요청은 빠진다 */
export function pendingWithResponses(
  schedule: MySchedule,
  responses: readonly RespondingWork[],
): MySchedule {
  const responded = new Set(responses.map(response => response.workId));
  return schedule.works.some(work => responded.has(work.workId))
    ? { works: schedule.works.filter(work => !responded.has(work.workId)) }
    : schedule;
}

/**
 * 그 구간의 내 일정: 거절한 요청은 빠지고, 수락한 요청은 작업전이다 (없으면 겹칠 때 끼워 넣는다).
 * 수락 대기인 행만 바꾼다. 서버 값이 이미 수락 대기를 지났으면(취소·재배정·작업중 등) 그 값이 맞다
 */
export function scheduleWithResponses(
  schedule: MySchedule,
  period: Period,
  responses: readonly RespondingWork[],
): MySchedule {
  if (responses.length === 0) {
    return schedule;
  }
  const rejected = new Set(
    responses.filter(r => r.kind === 'reject').map(r => r.workId),
  );
  const accepted = new Set(
    responses.filter(r => r.kind === 'accept').map(r => r.workId),
  );
  let changed = false;
  const works = schedule.works.flatMap(work => {
    if (rejected.has(work.workId)) {
      changed = true;
      return [];
    }
    if (accepted.has(work.workId) && work.status === 'PENDING_ACCEPT') {
      changed = true;
      return [{ ...work, status: 'ACCEPTED' as const }];
    }
    return [work];
  });
  const listed = new Set(works.map(work => work.workId));
  const added = responses.flatMap(({ kind, workId, request }) =>
    kind === 'accept' &&
    request &&
    !listed.has(workId) &&
    overlaps(request, period)
      ? [{ ...request, status: 'ACCEPTED' as const }]
      : [],
  );
  if (added.length > 0) {
    return { works: [...works, ...added].sort(byStart) };
  }
  return changed ? { works } : schedule;
}

/**
 * 작업 상세: 수락을 보낸 작업은 작업전이다. 수락 대기인 상세만 바꾸고(이미 지난 서버 값은 그대로), 앞 상태의 칩 이름은 지운다.
 * 상세는 지연 여부를 칩으로만 들고 있어 지연이면 그대로 둔다
 */
export function detailWithResponses(
  detail: WorkDetail,
  workId: number,
  responses: readonly RespondingWork[],
): WorkDetail {
  const accepting = responses.some(
    response => response.kind === 'accept' && response.workId === workId,
  );
  if (!accepting || detail.workStatus !== 'PENDING_ACCEPT') {
    return detail;
  }
  const chip = workStatusChip('ACCEPTED', detail.status === 'delayed');
  return {
    ...detail,
    workStatus: 'ACCEPTED',
    status: chip.status,
    // 칩 이름은 새 상태를 따른다 (작업전·지연은 이름을 따로 두지 않는다)
    statusLabel: chip.label,
  };
}
