import { render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { GestureExclusionArea } from './GestureExclusionArea';
import { gestureExclusionStyle } from './gestureExclusion';

// Platform.OS 만 바꾼다. 컴포넌트가 render 안에서 Platform.OS 를 읽어야 반영된다
const renderOn = async (os: 'ios' | 'android') => {
  jest.replaceProperty(Platform, 'OS', os);
  await render(<GestureExclusionArea edgeInset={24} top={8} height={300} />);
};

describe('GestureExclusionArea', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Android 에서는 제외 영역 네이티브 뷰를 계산한 자리에 그린다', async () => {
    await renderOn('android');

    const area = screen.getByTestId('gesture-exclusion');
    expect(area.type).toBe('GestureExclusionView');
    expect(StyleSheet.flatten(area.props.style)).toEqual(
      gestureExclusionStyle({ edgeInset: 24, top: 8, height: 300 }),
    );
  });

  // iOS 는 가장자리 뒤로 가기가 네이티브 스택 안쪽 화면에만 있어 탭 첫 화면과 겹치지 않는다 (#45)
  it('iOS 에서는 아무것도 그리지 않는다', async () => {
    await renderOn('ios');

    expect(screen.queryByTestId('gesture-exclusion')).toBeNull();
  });
});
