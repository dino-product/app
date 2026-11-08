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
// 스크롤 영역 밖에 두어 내용과 함께 스크롤되지 않는다. 탭 첫 화면은 AutoHideHeaderLayout 으로 리스트 위에 겹쳐
// 아래로 스크롤하면 숨기고 위로 스크롤하면 다시 보인다 (#148)

const BAR_PADDING_TOP = 12;
const ROW_MIN_HEIGHT = 34;
/** 기본 글자 크기에서 상단 바의 높이 (화면이 더한 아래 여백은 빼고). 큰 글자에서는 제목 줄이 더 높아진다 */
export const TAB_HEADER_HEIGHT = BAR_PADDING_TOP + ROW_MIN_HEIGHT;

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
          style={styles.title}
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
    paddingTop: BAR_PADDING_TOP,
    pointerEvents: 'box-none',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: ROW_MIN_HEIGHT,
    pointerEvents: 'box-none',
  },
  // 큰 글자에서 줄 폭을 넘으면 제목이 줄바꿈되어 종이 화면 밖으로 밀리지 않는다
  title: { flexShrink: 1 },
});
