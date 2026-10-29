import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

// Figma App Icon 세트와 화면에 쓰인 아이콘 이름. SVG 를 아직 확보하지 못해 지금은 크기만큼 자리를 비워 둔다.
// SVG 가 들어오면 이 컴포넌트 안에서만 그리면 되도록 호출부는 name·size·color 로 고정한다.
export type IconName =
  | 'bell'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevrons-down'
  | 'phone'
  | 'navigation'
  | 'camera'
  | 'close'
  | 'check'
  | 'list'
  | 'grid'
  | 'wrench'
  | 'home'
  | 'calendar'
  | 'history'
  | 'user';

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export const Icon = memo(function DesignSystemIcon({
  size = 24,
  style,
  testID,
}: IconProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size }, style]}
      testID={testID}
    />
  );
});
