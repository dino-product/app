import { colors } from '../../../shared/design-system';
import { WEEKDAYS } from '../model';

// 주간 줄·월 달력이 함께 쓰는 날짜 표기

export function dayA11yLabel(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${
    WEEKDAYS[date.getDay()]
  }요일`;
}

/** 일요일 빨강, 토요일 파랑, 평일 Gray900 */
export function weekdayColor(day: number): string {
  if (day === 0) {
    return colors.warning[1];
  }
  if (day === 6) {
    return colors.inspection[1];
  }
  return colors.gray[900];
}
