import { render, screen } from '@testing-library/react-native';
import { Icon } from './Icon';

describe('Icon', () => {
  it('지정한 크기의 자리를 차지한다 (기본 24)', async () => {
    await render(<Icon name="bell" testID="icon" />);
    expect(
      screen.getByTestId('icon', { includeHiddenElements: true }),
    ).toHaveStyle({ width: 24, height: 24 });

    await render(<Icon name="camera" size={20} testID="icon-20" />);
    expect(
      screen.getByTestId('icon-20', { includeHiddenElements: true }),
    ).toHaveStyle({ width: 20, height: 20 });
  });

  it('장식용이라 스크린리더에서 숨긴다', async () => {
    await render(<Icon name="phone" testID="icon" />);

    expect(
      screen.getByTestId('icon', { includeHiddenElements: true }),
    ).toHaveProp('importantForAccessibility', 'no-hide-descendants');
    expect(
      screen.getByTestId('icon', { includeHiddenElements: true }),
    ).toHaveProp('accessibilityElementsHidden', true);
  });
});
