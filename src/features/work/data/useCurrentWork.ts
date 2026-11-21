import { useCallback, useMemo } from 'react';
import { useNow } from '../../../shared/time/useNow';
import type { ScheduledWork } from './types';
import { nextCurrentWorkChange, pickCurrentWork } from './views';

/**
 * 내 작업 홈 히어로 박스의 작업: 지금 시각에 진행 중인 작업 (pickCurrentWork, #205). 없으면 undefined ('메인화면 - 진행(무)').
 * 화면을 켜 둔 채 작업전의 예정 시작·종료에 닿으면 새로고침 없이 바뀐다 (그 시각까지 타이머 하나, shared/time/useNow).
 * active 는 화면 포커스다: 떠나 있거나 앱이 background 면 타이머를 지우고, 돌아오면 그사이 지난 시각을 반영한다.
 * 서버는 시각이 되었다고 알려 주지 않는다 (기사는 실시간 연결을 열 수 없다)
 */
export function useCurrentWork(
  works: readonly ScheduledWork[] | undefined,
  active: boolean,
): ScheduledWork | undefined {
  const nextChange = useCallback(
    (now: number) => (works ? nextCurrentWorkChange(works, now) : undefined),
    [works],
  );
  const now = useNow(nextChange, active);
  return useMemo(
    () => (works ? pickCurrentWork(works, new Date(now)) : undefined),
    [works, now],
  );
}
