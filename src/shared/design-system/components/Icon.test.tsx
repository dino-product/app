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
    await render(<Icon name="apple" testID="icon" />);
    expect(screen.getByTestId('icon', hidden)).toHaveStyle({
      width: 20,
      height: 23,
    });
    expect(svgOf('icon').props).toMatchObject({ width: 20, height: 23 });

    await render(<Icon name="apple" size={10} testID="icon-10" />);
    expect(screen.getByTestId('icon-10', hidden)).toHaveStyle({
      width: 10,
      height: 11.5,
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

  // Figma App Icon · Time History (2824:10297 Active / 2824:10301 Default). 그림이 24 프레임 밖으로 조금 넘쳐 내보낸 SVG 가 25×24 다 (#82)
  it('선택된 작업 이력 탭은 App Icon · Time History · Active(속도선 채운 시계)이고 색을 바꿀 수 있으며 기본색은 Primary 다', () => {
    const active = iconSvgs['tab-history-active'];
    expect(active).toMatchObject({
      tint: true,
      size: 25,
      height: 24,
      color: '#1C1B2A',
    });
    expect(active.xml).toContain('d="M6.78608 10.5365L6.26806 10.4458H1.54111');
    expect(active.xml).not.toContain('M5 2.667V6.167H8.5'); // 옛 history-clock(#86)의 화살표
  });

  it('선택되지 않은 작업 이력 탭은 App Icon · Time History · Default(속도선 테두리 시계, Gray500 선)다', () => {
    const inactive = iconSvgs['tab-history'];
    expect(inactive).toMatchObject({ tint: false, size: 25, height: 24 });
    expect(inactive.xml).toContain(
      'd="M1.22217 5.88892H6.11106M1.22217 12H7.94439M1.22217 18.1111H6.11106"',
    ); // 속도선
    expect(inactive.xml).toContain('d="M15.5832 19.6389C19.8021 19.6389'); // 시계판
    expect(inactive.xml).toContain('stroke="#9B9B9B"');
  });

  // DesignSystem App Icon · Type=Modal-check (2791:27085). 원이 그라데이션(흰색→#E7E1FF)에서 Select/1(#4F3BFE 6%) 단색으로 바뀌었다 (#194).
  // 승인 대기·요청완료·참여 완료·제출 완료가 모두 이 원본의 인스턴스다
  it('결과 체크(modal-check)는 App Icon · Modal-check 를 내보낸 Select/1 6% 원에 Secondary 체크다', () => {
    const icon = iconSvgs['modal-check'];
    expect(icon).toMatchObject({ tint: false, size: 40 });
    expect(icon.xml).toContain(
      '<rect width="40" height="40" rx="20" fill="#4F3BFE" fill-opacity="0.06"/>',
    );
    expect(icon.xml).toContain('d="M25.1046 14.8223C25.3606 14.5773');
    expect(icon.xml).toContain('fill="#6452FD"');
    expect(icon.xml).not.toContain('linearGradient'); // 옛 그라데이션 원
  });

  it('같은 원본을 따로 내보낸 제출 완료 체크(submit-check)는 두지 않는다', () => {
    expect(Object.keys(iconSvgs)).not.toContain('submit-check');
  });

  // 진행 단계 첫 원 (Figma 3235:14906 마이 · 3227:8844 온보딩): Secondary 원 40 에 흰 체크. 체크 그림은 Modal-check 와 같다 (#194)
  it('진행 단계 체크(check)는 Figma 단계 원의 흰 체크를 원 가운데 24 칸으로 잘라 낸 것이고 색을 바꿀 수 있다', () => {
    const icon = iconSvgs.check;
    expect(icon).toMatchObject({ tint: true, size: 24, color: '#FFFFFF' });
    expect(icon.xml).toContain('viewBox="14 14 24 24"');
    expect(icon.xml).toContain('d="M31.1045 20.8222C31.3605 20.5772');
    expect(icon.xml).toContain('fill="currentColor"');
    expect(icon.xml).not.toContain('M6 12.5L10 16.5L18 8'); // 옛 선 체크(Figma 에서 내보낸 것이 아님)
  });

  // DesignSystem App Icon 의 x 는 사진 삭제용(어두운 원), Modal-X 는 결과 상태라 일반 닫기 X 를 더한다 (#98)
  it('일반 닫기 X(close-line)는 뒤로 가기(chevron-left)와 같은 선 아이콘이고 색을 바꿀 수 있다', () => {
    const x = iconSvgs['close-line'];
    expect(x).toMatchObject({ tint: true, size: 24, color: '#32303A' });
    expect(x.xml).toContain('stroke-width="2"');
    expect(x.xml).toContain('stroke-linecap="round"');
    expect(x.xml).not.toContain('<rect');
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
