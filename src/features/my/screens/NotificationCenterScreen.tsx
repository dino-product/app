import { useQueryClient } from '@tanstack/react-query';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type Ref,
} from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type PressableStateCallbackType,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, pressedBackground, Text } from '../../../shared/design-system';
import { LoadStateView } from '../../../shared/layout/LoadStateView';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { SubScreenHeader } from '../components/SubScreenHeader';
import {
  formatRelativeTime,
  notificationTargetOf,
  notificationTypeLabels,
  type AppNotification,
  type NotificationTarget,
  type NotificationType,
} from '../model';
import {
  refreshForOpenedNotification,
  useMarkNotificationRead,
  useNotificationList,
} from '../notificationQueries';

// Figma 마이페이지-알림센터 (2935:15831). 서버 알림 목록(#117)을 쪽마다 이어 받는다.
// 읽지 않은 알림은 회색 배경이고, 누르면 읽음을 보낸 뒤(실패해도) 작업 상세·참여 거절 화면을 연다.
// 로딩·오류(다시 시도)는 Figma 에 없어 공용 자리(LoadStateView)로 둔다 (Figma 미확인)
export function NotificationCenterScreen({
  focused = true,
  onOpen,
  onBack,
  titleRef,
}: {
  /** 화면이 보이는지 (내비게이션 포커스). 가려진 동안은 목록을 받지 않고, 다시 보이면 새로 받는다 */
  focused?: boolean;
  /** 열 곳이 있는 알림(작업·참여 거절)을 눌렀을 때. 행이 memo 라 렌더마다 새로 만들지 않는 함수를 넘긴다 */
  onOpen?: (target: NotificationTarget) => void;
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const {
    data,
    dataUpdatedAt,
    status,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useNotificationList(focused);
  const markRead = useMarkNotificationRead();
  const queryClient = useQueryClient();
  // 누르면 읽음을 보내고 결과를 기다리지 않고 연다 (읽음이 실패해도 이동한다)
  const select = useCallback(
    (item: AppNotification, target: NotificationTarget | null) => {
      if (!item.read) {
        markRead(item.id);
      }
      refreshForOpenedNotification(queryClient, item);
      if (target !== null) {
        onOpen?.(target);
      }
    },
    [markRead, onOpen, queryClient],
  );
  const canOpen = onOpen !== undefined;

  // 상대 시간(3시간 전)은 목록을 받은 시각 기준이다. 다시 받을 때만 바뀌어, 열어 둔 동안 시간이 흘러도
  // 다시 그리지 않는다 (유휴 상태 = 0 작업)
  const now = useMemo(() => new Date(dataUpdatedAt), [dataUpdatedAt]);

  // 당겨서 새로고침 표시는 사용자가 당겼을 때만. 화면 진입·앱 복귀 때 다시 받는 것은 조용히 한다
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // 받는 중(전체 다시 받기 포함)에는 다음 쪽을 부르지 않는다. 부르면 다시 받기가 취소되어 새 알림이 빠지고
  // 밀린 쪽이 붙는다. 다음 쪽을 받지 못했으면 스크롤로 다시 부르지 않고 목록 끝의 다시 시도를 기다린다
  const canLoadMore = hasNextPage && !isFetching && !isFetchNextPageError;
  const loadMore = useCallback(() => {
    if (canLoadMore) {
      fetchNextPage({ cancelRefetch: false });
    }
  }, [canLoadMore, fetchNextPage]);

  // 한 쪽이 모두 앱이 모르는 종류(사무실 알림 등)라 걸러져 비었으면 빈 상태에서 멈추지 않고 다음 쪽을 받는다
  const filteredEmpty = data?.length === 0 && canLoadMore;
  useEffect(() => {
    if (filteredEmpty) {
      fetchNextPage({ cancelRefetch: false });
    }
  }, [filteredEmpty, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => (
      <NotificationRow
        item={item}
        now={now}
        canOpen={canOpen}
        onSelect={select}
      />
    ),
    [now, canOpen, select],
  );

  // 다시 받기(새로고침·화면 진입·앱 복귀)가 실패하면 받은 목록은 두고 위에서 알린다
  let header: ReactElement | undefined;
  if (status === 'error' && !isFetchNextPageError) {
    header = (
      <View testID="notification-refresh-error">
        <LoadStateView
          state={{
            status: 'error',
            message: LOAD_ERROR_MESSAGE,
            onRetry: () => refetch(),
          }}
          style={styles.more}
        />
      </View>
    );
  }
  // 다음 쪽은 목록 끝에서 받는 중을 보이고, 실패하면 그 쪽만 다시 받는다
  let footer: ReactElement | undefined;
  if (isFetchingNextPage) {
    footer = (
      <LoadStateView state={{ status: 'loading' }} style={styles.more} />
    );
  } else if (isFetchNextPageError) {
    footer = (
      <LoadStateView
        state={{
          status: 'error',
          message: LOAD_ERROR_MESSAGE,
          onRetry: () => fetchNextPage({ cancelRefetch: false }),
        }}
        style={styles.more}
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader title="알림센터" onBack={onBack} titleRef={titleRef} />
      {data === undefined ? (
        <LoadStateView
          state={
            status === 'error'
              ? {
                  status: 'error',
                  message: LOAD_ERROR_MESSAGE,
                  onRetry: () => refetch(),
                }
              : { status: 'loading' }
          }
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          // 더 받을 쪽이 남아 있으면 아직 비었다고 하지 않는다
          ListEmptyComponent={hasNextPage ? undefined : Empty}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          contentContainerStyle={styles.content}
          onEndReached={loadMore}
          onEndReachedThreshold={END_REACHED_THRESHOLD}
          refreshing={refreshing}
          onRefresh={refresh}
          testID="notification-list"
        />
      )}
    </SafeAreaView>
  );
}

const LOAD_ERROR_MESSAGE = '알림을 불러오지 못했어요';
// 남은 길이가 화면 높이의 절반보다 짧아지면 다음 쪽을 미리 받는다
const END_REACHED_THRESHOLD = 0.5;

const keyExtractor = (item: AppNotification) => item.id;

// Figma 의 '신규 배정' 남색은 컬렉션 밖 값이다. 작업 취소만 빨강이고 나머지는 남색으로 둔다
const NOTICE_COLOR = '#4A4193';
const typeColor = (type: NotificationType) =>
  type === 'WORK_CANCELED' ? colors.warning[1] : NOTICE_COLOR;

const targetHints: Record<NotificationTarget['kind'], string> = {
  work: '작업 상세를 엽니다',
  participationRejected: '참여 요청 결과를 엽니다',
};

const NotificationRow = memo(function MyNotificationRow({
  item,
  now,
  canOpen,
  onSelect,
}: {
  item: AppNotification;
  now: Date;
  /** 작업 상세·참여 거절 화면을 열 수 있는지 */
  canOpen: boolean;
  onSelect: (item: AppNotification, target: NotificationTarget | null) => void;
}) {
  const label = notificationTypeLabels[item.type];
  const time = formatRelativeTime(item.createdAt, now);
  const description = `${label}, ${item.message}, ${time}`;
  // 읽으면 같은 행(Pressable)에서 역할·동작만 뺀다. 다른 컴포넌트로 바꿔 그리면 행이 새로 만들어져
  // 방금 누른 스크린리더 포커스가 사라진다. 읽었고 열 곳도 없는 알림은 버튼이 아닌 정보 행이다
  const target = canOpen ? notificationTargetOf(item) : null;
  const pressable = !item.read || target !== null;
  const press = () => onSelect(item, target);
  return (
    <Pressable
      accessible
      accessibilityRole={pressable ? 'button' : undefined}
      accessibilityLabel={item.read ? description : `읽지 않음, ${description}`}
      accessibilityHint={
        target !== null
          ? targetHints[target.kind]
          : item.read
          ? undefined
          : '읽음으로 표시합니다'
      }
      onPress={pressable ? press : undefined}
      style={
        pressable
          ? item.read
            ? rowStyles.read
            : rowStyles.unread
          : rowStyles.info
      }
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
  more: { paddingVertical: 24 },
  row: { paddingHorizontal: 24 },
  unread: { backgroundColor: colors.background[3] },
  unreadPressed: { backgroundColor: pressedBackground.onGray },
  read: { backgroundColor: colors.white[100] },
  readPressed: { backgroundColor: pressedBackground.onWhite },
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

// 누르는 동안 회색 배경 (#102). 읽지 않은 알림은 이미 회색이라 한 단계 진하게 칠한다.
// 읽었고 열 곳도 없는 알림은 누를 수 없어 바뀌지 않는다
const rowStyles = {
  unread: ({ pressed }: PressableStateCallbackType) => [
    styles.row,
    pressed ? styles.unreadPressed : styles.unread,
  ],
  read: ({ pressed }: PressableStateCallbackType) => [
    styles.row,
    pressed ? styles.readPressed : styles.read,
  ],
  info: [styles.row, styles.read],
};
