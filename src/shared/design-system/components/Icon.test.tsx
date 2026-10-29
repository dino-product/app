import { render, screen } from '@testing-library/react-native';
import { iconSvgs } from '../icons/svgs';
import { Icon } from './Icon';

const hidden = { includeHiddenElements: true };

describe('Icon', () => {
  it('지정한 크기의 자리를 차지하고 그 안에 그림을 그린다 (기본 24)', async () => {
    await render(<Icon name="bell" testID="icon" />);
    const icon = screen.getByTestId('icon', hidden);
    expect(icon).toHaveStyle({ width: 24, height: 24 });
    expect(icon.children.length).toBeGreaterThan(0);

    await render(<Icon name="camera" size={20} testID="icon-20" />);
    expect(screen.getByTestId('icon-20', hidden)).toHaveStyle({
      width: 20,
      height: 20,
    });
  });

  it('렌치는 Figma 일러스트 PNG 로 그린다', async () => {
    await render(<Icon name="wrench" size={32} testID="icon" />);

    expect(screen.getByTestId('icon-image', hidden)).toHaveStyle({
      width: 32,
      height: 32,
    });
  });

  it('장식용이라 스크린리더에서 숨긴다', async () => {
    await render(<Icon name="phone" testID="icon" />);

    expect(screen.getByTestId('icon', hidden)).toHaveProp(
      'importantForAccessibility',
      'no-hide-descendants',
    );
    expect(screen.getByTestId('icon', hidden)).toHaveProp(
      'accessibilityElementsHidden',
      true,
    );
  });
});

describe('iconSvgs', () => {
  it('모든 아이콘이 SVG 마크업이고, 색을 바꾸는 아이콘은 currentColor 만 쓴다', () => {
    for (const [name, icon] of Object.entries(iconSvgs)) {
      expect(icon.xml.startsWith('<svg')).toBe(true);
      if (icon.tint) {
        expect({ name, hex: /[=]"#[0-9a-f]{3,8}"/i.test(icon.xml) }).toEqual({
          name,
          hex: false,
        });
      }
    }
  });
});
