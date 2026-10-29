import { Icon, type BottomNavigationItem } from '../design-system';

// 앱 하단 탭 (Figma Bottom Navigation Bar). 활성 탭은 App Icon 의 Active(채움), 나머지는 Default(선) 아이콘.
export type MainTabKey = 'home' | 'schedule' | 'history' | 'my';

export const mainTabs: readonly BottomNavigationItem<MainTabKey>[] = [
  {
    key: 'home',
    label: '홈',
    renderIcon: ({ active, color }) => (
      <Icon name={active ? 'home-filled' : 'home'} color={color} />
    ),
  },
  {
    key: 'schedule',
    label: '내 일정',
    renderIcon: ({ active, color }) => (
      <Icon name={active ? 'calendar-filled' : 'calendar'} color={color} />
    ),
  },
  {
    key: 'history',
    label: '작업 이력',
    renderIcon: ({ active, color }) => (
      <Icon name={active ? 'history-filled' : 'history'} color={color} />
    ),
  },
  {
    key: 'my',
    label: '마이',
    renderIcon: ({ active, color }) => (
      <Icon name={active ? 'user-filled' : 'user'} color={color} />
    ),
  },
];
