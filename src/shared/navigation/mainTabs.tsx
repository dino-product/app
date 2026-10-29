import { Icon, type BottomNavigationItem } from '../design-system';

// 앱 하단 탭 (Figma Bottom Navigation Bar). 아이콘은 Figma App Icon 의 Active / Default 그대로다.
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
