import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, Icon, Text, touchSlop } from '../design-system';
import { readableColumn } from './readableColumn';

// 탭 첫 화면(내 작업·내 일정·작업 이력·마이페이지)의 상단 바 (#103).
// Figma 작업 수행 › 메인화면 - 시작 가능 (3463:17452) 의 제목 줄 3463:17455: 가로·양끝 정렬, 좌우 24,
// 높이 34, 프레임 위 72 (상태 표시줄 60 아래 12). 제목은 Body/XL/Semibold #000000.
// 스크롤 영역 밖에 두어 내용을 스크롤해도 움직이지 않는다
export type TabHeaderProps = {
  title: string;
  /** 있으면 오른쪽에 종을 그린다. 종이 있는 Figma 화면(내 작업·마이페이지)에만 넘긴다 (#96) */
  onOpenNotifications?: () => void;
  /** 화면마다 상단 바 아래에 더할 여백 등 */
  style?: StyleProp<ViewStyle>;
};

export function TabHeader({
  title,
  onOpenNotifications,
  style,
}: TabHeaderProps) {
  return (
    <View style={[readableColumn, styles.bar, style]}>
      <View style={styles.row}>
        <Text
          accessibilityRole="header"
          variant="Body/XL/SemiBold"
          color={colors.black}
        >
          {title}
        </Text>
        {onOpenNotifications && (
          // 알림센터로 가는 버튼이다. 누르는 동안·누른 뒤에도 아이콘 모양은 그대로다
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="알림센터"
            hitSlop={BELL_HIT_SLOP}
            onPress={onOpenNotifications}
          >
            <Icon name="bell" size={BELL_SIZE} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const BELL_SIZE = 26;
const BELL_HIT_SLOP = touchSlop(BELL_SIZE);

const styles = StyleSheet.create({
  // 종이 아래로 넓힌 터치 영역이 바로 아래 리스트(뒤 형제)에 먼저 잡히지 않도록 위에 쌓는다.
  // 빈 곳은 터치를 받지 않아, 아래 요소(내 일정 하위 탭)가 위로 넓힌 영역은 그대로 아래 요소가 받는다
  bar: {
    zIndex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    pointerEvents: 'box-none',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 34,
    pointerEvents: 'box-none',
  },
});
