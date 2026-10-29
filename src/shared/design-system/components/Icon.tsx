import { memo } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { iconSvgs, type SvgIconName } from '../icons/svgs';
import { colors } from '../tokens/colors';

// Figma App Icon 세트와 화면 아이콘. SVG 는 icons/svgs.ts, 렌치는 일러스트라 PNG 다.
export type IconName = SvgIconName | 'wrench';

export type IconProps = {
  name: IconName;
  /** 기본값은 Figma 프레임 크기 */
  size?: number;
  /** 단색 아이콘(tint)에만 적용된다. 기본값은 Figma 색 */
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const wrench = require('../../../../assets/images/work-wrench.png');

// 렌치 PNG 의 기본 크기 (호출부가 size 로 정한다)
const WRENCH_SIZE = 24;

export const Icon = memo(function DesignSystemIcon({
  name,
  size,
  color,
  style,
  testID,
}: IconProps) {
  const svg: { xml: string; size: number; color?: string } | undefined =
    name === 'wrench' ? undefined : iconSvgs[name];
  // 기본 크기·색은 Figma 값 (icons/svgs.ts)
  const dimension = size ?? svg?.size ?? WRENCH_SIZE;
  const box = { width: dimension, height: dimension };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[box, style]}
      testID={testID}
    >
      {svg === undefined ? (
        <Image
          source={wrench}
          style={box}
          testID={testID && `${testID}-image`}
        />
      ) : (
        <SvgXml
          xml={svg.xml}
          width={dimension}
          height={dimension}
          color={color ?? svg.color ?? colors.gray[900]}
        />
      )}
    </View>
  );
});
