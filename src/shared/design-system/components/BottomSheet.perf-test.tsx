import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { measureRenders } from 'reassure';
import { perfBudget } from '../../perf/budget';
import { BottomSheet } from './BottomSheet';

// 버튼으로 시트를 여는 화면
function Harness() {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setVisible(true)}>
        <Text>열기</Text>
      </Pressable>
      <BottomSheet visible={visible} onClose={() => setVisible(false)}>
        <Text>시트 내용</Text>
      </BottomSheet>
    </>
  );
}

describe('BottomSheet 렌더 예산', () => {
  it('시트를 열면 한 번만 다시 그리고, 올라오는 애니메이션은 다시 그리지 않는다', async () => {
    const result = await measureRenders(<Harness />, {
      scenario: async () => {
        await fireEvent.press(screen.getByRole('button', { name: '열기' }));
        await screen.findByText('시트 내용');
      },
    });

    // 마운트 1 + 열기 1. 애니메이션은 네이티브 드라이버라 JS 렌더가 없다
    expect(Math.max(...result.counts)).toBe(2);
    expect(result.issues.initialUpdateCount).toBeLessThanOrEqual(
      perfBudget.render.maxInitialUpdateCount,
    );
    expect(result.issues.redundantUpdates.length).toBeLessThanOrEqual(
      perfBudget.render.maxRedundantUpdates,
    );
  });
});
