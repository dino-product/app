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

  it('세로가 다른 아이콘은 Figma 비율대로 높이를 잡는다', async () => {
    await render(<Icon name="calendar-switch" testID="icon" />);
    expect(screen.getByTestId('icon', hidden)).toHaveStyle({
      width: 24,
      height: 28,
    });
    expect(svgOf('icon').props).toMatchObject({ width: 24, height: 28 });

    await render(<Icon name="calendar-switch" size={12} testID="icon-12" />);
    expect(screen.getByTestId('icon-12', hidden)).toHaveStyle({
      width: 12,
      height: 14,
    });
  });

  it('색을 바꾸는 아이콘은 color 를 따르고, 없으면 Figma 색을 쓴다', async () => {
    await render(<Icon name="chevron-left" color="#123456" testID="tinted" />);
    expect(svgOf('tinted').props.color).toBe('#123456');

    await render(<Icon name="chevron-left" testID="default" />);
    expect(svgOf('default').props.color).toBe('#32303A');
  });

  it('채운 달력(App Icon · Calendar · Active)은 색을 바꿀 수 있고 기본색은 탭의 Primary 다', () => {
    expect(iconSvgs['tab-calendar-active']).toMatchObject({
      tint: true,
      color: '#1C1B2A',
    });
  });

  it('선택된 작업 이력 탭은 화살표가 있는 채운 시계(history-clock)이고 기본색은 탭의 Primary 다', () => {
    const active = iconSvgs['tab-history-active'];
    expect(active).toMatchObject({ tint: true, size: 24, color: '#1C1B2A' });
    expect(active.xml).toContain('M5 2.667V6.167H8.5'); // 도는 화살표
    expect(active.xml).toContain('M2.736 10.863A9.333 9.333 0 1 0 6.781 4.262');
  });

  it('작업 이력 빈 상태 시계(history-empty)는 화살표 없는 채운 시계를 유지한다', () => {
    const empty = iconSvgs['history-empty'];
    expect(empty).toMatchObject({ tint: true, size: 24, color: '#1C1B2A' });
    expect(empty.xml).not.toContain('M5 2.667V6.167H8.5');
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

  it('height 를 둔 아이콘은 SVG 의 height 와 같고 폭과 다르다', () => {
    for (const [name, icon] of Object.entries(iconSvgs)) {
      if ('height' in icon) {
        const height = Number(
          /<svg [^>]*height="([\d.]+)"/.exec(icon.xml)?.[1],
        );
        expect({ name, height: icon.height }).toEqual({ name, height });
        expect(icon.height).not.toBe(icon.size);
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
