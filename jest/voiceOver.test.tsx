import { render } from '@testing-library/react-native';
import { Modal, Text, View } from 'react-native';
import { escapeFrom, escapeTarget } from './voiceOver';

describe('VoiceOver escape 헬퍼', () => {
  it('제목에서 위로 올라가 가장 가까운 escape 를 받는 뷰에 보낸다', async () => {
    const outer = jest.fn();
    const inner = jest.fn();
    await render(
      <View onAccessibilityEscape={outer}>
        <View onAccessibilityEscape={inner}>
          <Text accessibilityRole="header">제목</Text>
        </View>
      </View>,
    );

    await escapeFrom('제목');

    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  // 'Modal' 은 jest 프리셋 목의 호스트 이름이다. 프리셋이 바뀌어 이름이 달라지면 이 테스트가 알린다
  it('Modal 밖(가린 화면)으로는 올라가지 않는다', async () => {
    await render(
      <View onAccessibilityEscape={jest.fn()}>
        <Modal visible>
          <Text accessibilityRole="header">제목</Text>
        </Modal>
      </View>,
    );

    expect(escapeTarget('제목')).toBeNull();
  });

  it('받는 뷰가 없으면 escapeFrom 이 알린다', async () => {
    await render(<Text accessibilityRole="header">제목</Text>);

    expect(() => escapeFrom('제목')).toThrow('escape 를 받는 뷰가 없다');
  });
});
