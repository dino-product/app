import { colors } from '../../../shared/design-system';
import { WEEKDAYS } from '../model';

// 주간 줄·월 달력이 함께 쓰는 날짜 표기. 색은 Figma DesignSystem › Calendar Contents 를 따른다

export function dayA11yLabel(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${
    WEEKDAYS[date.getDay()]
  }요일`;
}

/** 날짜 숫자(주간 줄은 요일 글자도) 색. 일요일 Warning1, 토요일 Accents/Blue, 평일은 주간 Gray900·달력 Gray800 */
export function dayColor(day: number, view: 'week' | 'month'): string {
  if (day === 0) {
    return colors.warning[1];
  }
  if (day === 6) {
    return colors.accents.blue;
  }
  return view === 'week' ? colors.gray[900] : colors.gray[800];
}

/** 월 달력 맨 위 요일 줄 색. 날짜 칸과 달리 Type Color 를 쓴다: 일 Red, 토 Blue, 평일 Gray800 */
export function weekdayHeaderColor(day: number): string {
  if (day === 0) {
    return colors.typeColor.red;
  }
  if (day === 6) {
    return colors.typeColor.blue;
  }
  return colors.gray[800];
}
