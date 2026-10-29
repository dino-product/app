import { Icon, type BottomNavigationItem } from '../design-system';

// 앱 하단 탭 (Figma Bottom Navigation Bar). 내비게이션 라이브러리를 붙이기 전까지 화면이 직접 그린다.
export type MainTabKey = 'home' | 'schedule' | 'history' | 'my';

export const mainTabs: readonly BottomNavigationItem<MainTabKey>[] = [
  {
    key: 'home',
    label: '홈',
    renderIcon: ({ color }) => <Icon name="home" color={color} />,
  },
  {
    key: 'schedule',
    label: '내 일정',
    renderIcon: ({ color }) => <Icon name="calendar" color={color} />,
  },
  {
    key: 'history',
    label: '작업 이력',
    renderIcon: ({ color }) => <Icon name="history" color={color} />,
  },
  {
    key: 'my',
    label: '마이',
    renderIcon: ({ color }) => <Icon name="user" color={color} />,
  },
];
