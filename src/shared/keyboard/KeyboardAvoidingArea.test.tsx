import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';
import { hideKeyboard, showKeyboard } from '../../../jest/keyboard';
import { KeyboardAvoidingArea } from './KeyboardAvoidingArea';

let childRenders = 0;

function Child() {
  childRenders += 1;
  return <Text>내용</Text>;
}

afterEach(async () => {
  // Keyboard 모듈은 마지막 키보드 상태를 들고 있어 다음 테스트로 넘어가지 않게 내린다
  await hideKeyboard();
  jest.restoreAllMocks();
  childRenders = 0;
});

describe('KeyboardAvoidingArea', () => {
  it('키보드가 열리고 닫혀도 아래만 줄였다 되돌리고 안의 내용은 다시 그리지 않는다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await render(
      <KeyboardAvoidingArea testID="area">
        <Child />
      </KeyboardAvoidingArea>,
    );
    const area = screen.getByTestId('area');
    await fireEvent(area, 'layout', {
      nativeEvent: { layout: { x: 0, y: 100, width: 360, height: 700 } },
    });

    await showKeyboard(500);
    expect(area).toHaveStyle({ flex: 1, paddingBottom: 300 });
    await hideKeyboard();
    expect(area).toHaveStyle({ paddingBottom: 0 });

    expect(childRenders).toBe(1);
  });
});
