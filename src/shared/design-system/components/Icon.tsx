import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { icons, type IconName } from '../icons/svgs';

export type { IconName };

export type IconProps = {
  name: IconName;
  /** 기본값은 Figma 프레임 크기 */
  size?: number;
  /** 한 가지 색 아이콘만 적용된다. 기본값은 Figma 색 */
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
  const icon: { xml: string; size: number; color?: string } = icons[name];
  const dimension = size ?? icon.size;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: dimension, height: dimension }, style]}
      testID={testID ?? `icon-${name}`}
    >
      <SvgXml
        xml={icon.xml}
        width={dimension}
        height={dimension}
        color={color ?? icon.color}
      />
    </View>
  );
});
