import { memo } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { iconSvgs, type SvgIconName } from '../icons/svgs';
import { colors } from '../tokens/colors';

// Figma App Icon 세트와 화면 아이콘. SVG 는 icons/svgs.ts, 렌치는 일러스트라 PNG 다.
export type IconName = SvgIconName | 'wrench';

export type IconProps = {
  name: IconName;
  size?: number;
  /** 단색 아이콘(tint)에만 적용된다 */
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const wrench = require('../../../../assets/images/work-wrench.png');

export const Icon = memo(function DesignSystemIcon({
  name,
  size = 24,
  color = colors.gray[900],
  style,
  testID,
}: IconProps) {
  const box = { width: size, height: size };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[box, style]}
      testID={testID}
    >
      {name === 'wrench' ? (
        <Image
          source={wrench}
          style={box}
          testID={testID && `${testID}-image`}
        />
      ) : (
        <SvgXml
          xml={iconSvgs[name].xml}
          width={size}
          height={size}
          color={color}
        />
      )}
    </View>
  );
});
