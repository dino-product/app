// 손가락이 처음 움직인 방향으로 가로 밀기인지 세로 스크롤인지 정한다 (#144).
// 리스트 안에서 가로로 미는 것(내 일정 달력 넘김, 메인 탭 좌우 넘김 #140)이 같은 규칙을 쓴다.
// 한 손길에서 처음 정한 방향을 끝까지 쓰는 것은 부르는 쪽 몫이다. 이 함수는 그때까지 움직인 거리만 본다.

export type PanAxis = 'horizontal' | 'vertical';

/** 가로·세로 중 한쪽으로 이만큼(pt)을 넘게 움직여야 방향을 정한다. 그 전의 흔들림은 탭으로 남는다 */
export const AXIS_DECISION_DISTANCE = 10;
/** 가로축에서 이 각도(도)보다 안쪽으로 움직이면 가로다. 이 각도부터는 세로(리스트 스크롤)다 */
export const HORIZONTAL_MAX_ANGLE = 45;

export type PanAxisThresholds = {
  /** 기본 AXIS_DECISION_DISTANCE */
  distance?: number;
  /** 기본 HORIZONTAL_MAX_ANGLE */
  horizontalMaxAngle?: number;
};

/** 시작점에서 (dx, dy) 만큼 움직였을 때의 방향. 아직 덜 움직였으면 null */
export function decidePanAxis(
  dx: number,
  dy: number,
  {
    distance = AXIS_DECISION_DISTANCE,
    horizontalMaxAngle = HORIZONTAL_MAX_ANGLE,
  }: PanAxisThresholds = {},
): PanAxis | null {
  const x = Math.abs(dx);
  const y = Math.abs(dy);
  if (Math.max(x, y) <= distance) {
    return null;
  }
  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  return angle < horizontalMaxAngle ? 'horizontal' : 'vertical';
}
