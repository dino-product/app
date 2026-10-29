import { render, screen } from '@testing-library/react-native';
import { iconSvgs } from '../icons/svgs';
import { Icon } from './Icon';

const hidden = { includeHiddenElements: true };

describe('Icon', () => {
  // 감싸는 View 의 첫 자식이 react-native-svg 의 네이티브 SVG 뷰(RNSVGSvgView)다
  const svgOf = (testID: string) => {
    const [svg] = screen.getByTestId(testID, hidden).children;
    if (typeof svg === 'string') {
      throw new Error('SVG 뷰가 없습니다');
    }
    return svg;
  };

  it('기본 크기는 Figma 프레임 크기를 따르고, size 로 바꿀 수 있다', async () => {
    await render(<Icon name="bell" testID="icon" />);
    expect(screen.getByTestId('icon', hidden)).toHaveStyle({
      width: 26,
      height: 26,
    });
    expect(svgOf('icon').props).toMatchObject({ width: 26, height: 26 });

    await render(<Icon name="camera" size={20} testID="icon-20" />);
    expect(screen.getByTestId('icon-20', hidden)).toHaveStyle({
      width: 20,
      height: 20,
    });
  });

  it('색을 바꾸는 아이콘은 color 를 따르고, 없으면 Figma 색을 쓴다', async () => {
    await render(<Icon name="chevron-left" color="#123456" testID="tinted" />);
    expect(svgOf('tinted').props.color).toBe('#123456');

    await render(<Icon name="chevron-left" testID="default" />);
    expect(svgOf('default').props.color).toBe('#32303A');
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
  it('size 는 SVG 의 width(=Figma 프레임 크기)와 같고, 색을 바꾸는 아이콘은 Figma 기본색을 갖는다', () => {
    for (const [name, icon] of Object.entries(iconSvgs)) {
      const width = Number(/<svg width="([\d.]+)"/.exec(icon.xml)?.[1]);
      expect({ name, size: icon.size }).toEqual({ name, size: width });
      if (icon.tint) {
        expect({ name, color: 'color' in icon }).toEqual({ name, color: true });
      }
    }
  });

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
