import { fireEvent, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { measureRenders } from 'reassure';
import { hideKeyboard, showKeyboard } from '../../../../jest/keyboard';
import { perfBudget } from '../../../shared/perf/budget';
import { workDetail } from '../mockData';
import { WorkDetailScreen } from './WorkDetailScreen';

const detail = (
  <WorkDetailScreen
    work={workDetail}
    onBack={() => {}}
    onSubmitReport={() => ({ kind: 'submitted', at: '10.01 15:15' })}
    onDone={() => {}}
    onCall={() => {}}
    onNavigate={() => {}}
    onPickPhoto={async () => null}
  />
);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('WorkDetailScreen 렌더 예산', () => {
  // perf 테스트는 jest 기본값인 iOS 로 돈다. 키보드 회피는 Android 에서만 하므로 따로 잰다
  it('Android 에서 키보드가 열리고 닫힐 때만 다시 그리고 중복 렌더가 없다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');

    const result = await measureRenders(detail, {
      scenario: async () => {
        await fireEvent(screen.getByTestId('work-detail-body'), 'layout', {
          nativeEvent: { layout: { x: 0, y: 100, width: 360, height: 700 } },
        });
        await showKeyboard(500);
        await showKeyboard(500);
        await hideKeyboard();
      },
    });

    // 마운트 1 + 열림 1 + 닫힘 1. 크기를 알리거나 같은 키보드가 다시 와도 렌더하지 않는다
    expect(Math.max(...result.counts)).toBe(3);
    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  }, 30_000);
});
