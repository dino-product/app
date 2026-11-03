import { memo, useCallback, type Ref } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Text } from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { SubScreenHeader } from '../components/SubScreenHeader';
import {
  formatRelativeTime,
  notificationTypeLabels,
  type AppNotification,
  type NotificationType,
} from '../model';

// Figma 마이페이지-알림센터 (2935:15831). 읽지 않은 알림은 회색 배경이고, 누르면 읽음이 된다.
// 누르면 작업으로 이동할지는 디자인 확인 전이라 읽음 처리만 한다
export function NotificationCenterScreen({
  notifications,
  now,
  onRead,
  onBack,
  titleRef,
}: {
  notifications: readonly AppNotification[];
  /** 상대 시간(3시간 전)의 기준 */
  now: Date;
  onRead: (id: string) => void;
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => (
      <NotificationRow item={item} now={now} onRead={onRead} />
    ),
    [now, onRead],
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader title="알림센터" onBack={onBack} titleRef={titleRef} />
      <FlatList
        data={notifications}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={Empty}
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const keyExtractor = (item: AppNotification) => item.id;

// Figma 의 '신규 배정' 남색은 컬렉션 밖 값이다. 작업 취소만 빨강이고 나머지는 남색으로 둔다
const NOTICE_COLOR = '#4A4193';
const typeColor = (type: NotificationType) =>
  type === 'WORK_CANCELED' ? colors.warning[1] : NOTICE_COLOR;

const NotificationRow = memo(function MyNotificationRow({
  item,
  now,
  onRead,
}: {
  item: AppNotification;
  now: Date;
  onRead: (id: string) => void;
}) {
  const label = notificationTypeLabels[item.type];
  const time = formatRelativeTime(item.createdAt, now);
  const description = `${label}, ${item.message}, ${time}`;
  // 읽으면 같은 행(Pressable)에서 역할·동작만 뺀다. 다른 컴포넌트로 바꿔 그리면 행이 새로 만들어져
  // 방금 누른 스크린리더 포커스가 사라진다. 읽은 알림은 눌러도 할 일이 없어 버튼이 아닌 정보 행이다
  return (
    <Pressable
      accessible
      accessibilityRole={item.read ? undefined : 'button'}
      accessibilityLabel={item.read ? description : `읽지 않음, ${description}`}
      accessibilityHint={item.read ? undefined : '읽음으로 표시합니다'}
      onPress={item.read ? undefined : () => onRead(item.id)}
      style={[styles.row, item.read ? styles.read : styles.unread]}
      testID={`notification-${item.id}`}
    >
      <View style={[readableColumn, styles.rowContent]}>
        <View style={styles.rowTop}>
          <Text variant="Caption/S/Medium" color={typeColor(item.type)}>
            {label}
          </Text>
          <Text variant="Caption/S/Medium" color={colors.gray[500]}>
            {time}
          </Text>
        </View>
        <Text variant="Caption/M/Medium" color={colors.gray[800]}>
          {item.message}
        </Text>
        <View style={styles.rule} />
      </View>
    </Pressable>
  );
});

function Empty() {
  return (
    <Text
      variant="Body/XS/Medium"
      color={colors.gray[600]}
      style={styles.empty}
    >
      새 알림이 없어요
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  content: { paddingTop: 8, paddingBottom: 24 },
  row: { paddingHorizontal: 24 },
  unread: { backgroundColor: colors.background[3] },
  read: { backgroundColor: colors.white[100] },
  rowContent: { gap: 8, paddingVertical: 22 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  // 행 사이 구분선은 Figma 처럼 양옆을 조금 비운다 (배경은 끝까지 칠한다)
  rule: {
    position: 'absolute',
    left: -4,
    right: -4,
    bottom: 0,
    height: 1,
    backgroundColor: colors.gray[100],
  },
  empty: { paddingTop: 120, textAlign: 'center' },
});
