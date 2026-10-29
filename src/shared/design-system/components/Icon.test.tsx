import { render, screen } from '@testing-library/react-native';
import { icons, type IconSpec } from '../icons/svgs';
import { Icon, type IconName } from './Icon';

const hidden = { includeHiddenElements: true };

// 감싸는 View 의 첫 자식이 react-native-svg 의 네이티브 SVG 뷰(RNSVGSvgView)다
const svgOf = (testID: string) => {
  const [svg] = screen.getByTestId(testID, hidden).children;
  if (typeof svg === 'string') {
    throw new Error('SVG 뷰가 없습니다');
  }
  return svg;
};

describe('Icon', () => {
  it('Figma 에서 내보낸 SVG 를 이름으로 그린다', async () => {
    await render(<Icon name="bell" />);

    expect(svgOf('icon-bell').props.xml).toBe(icons.bell.xml);
  });

  it('기본 크기는 Figma 프레임 크기를 따르고, size 로 바꿀 수 있다', async () => {
    await render(<Icon name="bell" />);
    expect(screen.getByTestId('icon-bell', hidden)).toHaveStyle({
      width: 26,
      height: 26,
    });
    expect(svgOf('icon-bell').props).toMatchObject({ width: 26, height: 26 });

    await render(<Icon name="camera" size={20} testID="camera-20" />);
    expect(screen.getByTestId('camera-20', hidden)).toHaveStyle({
      width: 20,
      height: 20,
    });
  });

  it('한 가지 색 아이콘은 color 로 칠하고, 없으면 Figma 색을 쓴다', async () => {
    await render(<Icon name="home" color="#123456" testID="tinted" />);
    expect(svgOf('tinted').props.color).toBe('#123456');

    await render(<Icon name="home" testID="default" />);
    expect(svgOf('default').props.color).toBe(icons.home.color);
  });

  it('장식용이라 스크린리더에서 숨긴다', async () => {
    await render(<Icon name="phone" />);

    const icon = screen.getByTestId('icon-phone', hidden);
    expect(icon).toHaveProp('importantForAccessibility', 'no-hide-descendants');
    expect(icon).toHaveProp('accessibilityElementsHidden', true);
  });

  it('한 가지 색 아이콘의 SVG 는 currentColor 로 칠해 둔다', () => {
    const tintable = (Object.keys(icons) as IconName[]).filter(
      name => (icons[name] as IconSpec).color !== undefined,
    );

    expect(tintable.length).toBeGreaterThan(0);
    for (const name of tintable) {
      expect(icons[name].xml).toContain('currentColor');
    }
  });
});
