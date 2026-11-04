import type { QueryClient } from '@tanstack/react-query';
import { workDetailQuery } from '../../features/work/data/queries';
import type { WorkRepository } from '../../features/work/data/types';

// 알림으로 연 작업을 어느 화면으로 열지 (알림센터 #117·푸시 #118 공용). 홈의 작업 열기와 같은 규칙이다:
// 수락 대기(배정됨) 작업은 수락·거절하는 요청 상세, 나머지는 작업 상세.
// 알림에는 작업 상태가 없어 상세를 먼저 받는다. 받은 상세는 같은 캐시 키에 남아 연 작업 상세가 바로 그린다.
// 누를 때의 경합(겹친 누름·그사이 화면 이동)은 부르는 쪽이 정한다

/** 알림으로 연 작업의 화면: 요청 상세 또는 작업 상세 */
export type NotificationWorkScreen = 'request' | 'detail';

/**
 * 미리 받기는 다시 시도하지 않는다(기다리는 동안 표시가 없다).
 * 받지 못하면(볼 수 없는 작업·네트워크) 작업 상세 — 그 화면이 상태와 다시 시도를 보인다
 */
export async function notificationWorkScreen(
  queryClient: QueryClient,
  repository: WorkRepository,
  workId: number,
  organizationId?: number,
): Promise<NotificationWorkScreen> {
  try {
    const work = await queryClient.fetchQuery({
      ...workDetailQuery(repository, workId, organizationId),
      retry: false,
    });
    return work.workStatus === 'PENDING_ACCEPT' ? 'request' : 'detail';
  } catch {
    return 'detail';
  }
}
