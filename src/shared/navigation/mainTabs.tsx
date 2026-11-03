import { Icon, type BottomNavigationItem } from '../design-system';

// 앱 하단 탭 (Figma Bottom Navigation Bar). 아이콘은 Figma App Icon 의 Active / Default 그대로다. 단 선택된 작업 이력은 Figma 에 없는 history-clock(화살표 있는 채운 시계, 2026-11-03 사용자 결정 #86).
export type MainTabKey = 'home' | 'schedule' | 'history' | 'my';

export const mainTabs: readonly BottomNavigationItem<MainTabKey>[] = [
  {
    key: 'home',
    label: '홈',
    renderIcon: ({ active }) => (
      <Icon name={active ? 'tab-home-active' : 'tab-home'} />
    ),
  },
  {
    key: 'schedule',
    label: '내 일정',
    renderIcon: ({ active }) => (
      <Icon name={active ? 'tab-calendar-active' : 'tab-calendar'} />
    ),
  },
  {
    key: 'history',
    label: '작업 이력',
    renderIcon: ({ active }) => (
      <Icon name={active ? 'tab-history-active' : 'tab-history'} />
    ),
  },
  {
    key: 'my',
    label: '마이',
    renderIcon: ({ active }) => (
      <Icon name={active ? 'tab-user-active' : 'tab-user'} />
    ),
  },
];
