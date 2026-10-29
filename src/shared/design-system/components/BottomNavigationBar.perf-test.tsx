import { measureRenders } from 'reassure';
import { perfBudget } from '../../perf/budget';
import {
  BottomNavigationBar,
  type BottomNavigationItem,
} from './BottomNavigationBar';

const renderIcon = () => null;
const items: BottomNavigationItem[] = [
  { key: 'home', label: '홈', renderIcon },
  { key: 'schedule', label: '내 일정', renderIcon },
  { key: 'history', label: '작업 이력', renderIcon },
  { key: 'my', label: '마이', renderIcon },
];

describe('BottomNavigationBar 렌더 예산', () => {
  it('마운트 시 추가 렌더와 중복 렌더가 예산 이내다', async () => {
    const result = await measureRenders(
      <BottomNavigationBar
        items={items}
        activeKey="home"
        onChange={() => {}}
      />,
    );

    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  });
});
