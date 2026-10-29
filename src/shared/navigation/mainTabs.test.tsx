import { render, screen } from '@testing-library/react-native';
import { colors } from '../design-system';
import { mainTabs } from './mainTabs';

const hidden = { includeHiddenElements: true };

describe('mainTabs', () => {
  it('홈 · 내 일정 · 작업 이력 · 마이 순서다', () => {
    expect(mainTabs.map(tab => tab.label)).toEqual([
      '홈',
      '내 일정',
      '작업 이력',
      '마이',
    ]);
  });

  it.each([
    ['home', 'home-filled', 'home'],
    ['schedule', 'calendar-filled', 'calendar'],
    ['history', 'history-filled', 'history'],
    ['my', 'user-filled', 'user'],
  ])(
    '%s 탭은 활성이면 채운(%s), 아니면 선(%s) 아이콘이다',
    async (key, activeIcon, idleIcon) => {
      const tab = mainTabs.find(item => item.key === key)!;

      await render(
        <>{tab.renderIcon({ active: true, color: colors.primary })}</>,
      );
      expect(screen.getByTestId(`icon-${activeIcon}`, hidden)).toBeTruthy();

      await render(
        <>{tab.renderIcon({ active: false, color: colors.gray[500] })}</>,
      );
      expect(screen.getByTestId(`icon-${idleIcon}`, hidden)).toBeTruthy();
    },
  );
});
