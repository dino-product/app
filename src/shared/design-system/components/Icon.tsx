import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { iconSvgs, type SvgIconName } from '../icons/svgs';
import { colors } from '../tokens/colors';

// Figma App Icon 세트와 화면 아이콘. SVG 는 icons/svgs.ts 에 있다.
export type IconName = SvgIconName;

export type IconProps = {
  name: IconName;
  /** 폭. 기본값은 Figma 프레임 크기. 세로가 다른 아이콘은 높이가 비율대로 정해진다 */
  size?: number;
  /** 단색 아이콘(tint)에만 적용된다. 기본값은 Figma 색 */
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export const Icon = memo(function DesignSystemIcon({
  name,
  size,
  color,
  style,
  testID,
}: IconProps) {
  const svg: { xml: string; size: number; height?: number; color?: string } =
    iconSvgs[name];
  // 기본 크기·색은 Figma 값 (icons/svgs.ts). size 는 폭이고, 세로가 다른 아이콘은 Figma 비율대로 높이를 잡는다
  const width = size ?? svg.size;
  const height =
    svg.height === undefined ? width : (width * svg.height) / svg.size;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height }, style]}
      testID={testID}
    >
      <SvgXml
        xml={svg.xml}
        width={width}
        height={height}
        color={color ?? svg.color ?? colors.gray[900]}
      />
    </View>
  );
});
