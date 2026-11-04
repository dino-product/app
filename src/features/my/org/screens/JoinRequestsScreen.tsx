import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from 'react';
import {
  AccessibilityInfo,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  CTA,
  Icon,
  Text,
  touchSlop,
} from '../../../../shared/design-system';
import { smallestLineHeight } from '../../../../shared/design-system/tokens/touchTarget';
import { readableColumn } from '../../../../shared/layout/readableColumn';
import { SubScreenHeader } from '../../components/SubScreenHeader';
import { CancelRequestSheet } from '../components/CancelRequestSheet';
import { LoadState } from '../components/LoadState';
import {
  formatRequestDate,
  participationTypeLabels,
  pendingRequests,
  type ParticipationRequest,
} from '../model';
import { cancelFailure } from '../notices';
import {
  useCancelParticipationRequest,
  useParticipationRequests,
} from '../participationQueries';

// Figma 마이페이지-신청현황 (2880:15194 빈 상태 / 2874:14773 승인 대기 목록).
// 목록은 서버 신청 현황(GET /api/v1/participation-requests)의 승인 대기 요청이고 당겨서 새로고침한다 (#116).
// 받는 동안·받지 못했을 때와 실패 안내는 Figma 에 없어 기본안이다 (Figma 미확인).
// 취소 실패는 시트가 내려가는 중에도 뜨도록 시스템 알림(Alert)으로 알린다 (RN Modal 두 개를 겹쳐 띄우지 않는다)

/** 취소를 확정한 신청. 서버가 취소를 받고 시트가 다 내려가면 알린다 */
type Canceling = {
  request: ParticipationRequest;
  sheetClosed: boolean;
  canceled: boolean;
};

const NO_REQUESTS: readonly ParticipationRequest[] = [];

export function JoinRequestsScreen({
  onJoin,
  onBack,
  titleRef,
}: {
  /** 조직 참여하기 (회사 찾기) */
  onJoin: () => void;
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const query = useParticipationRequests(pendingRequests);
  const cancel = useCancelParticipationRequest();
  const [canceling, setCanceling] = useState<ParticipationRequest | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // 방금 취소한 신청. 서버가 취소를 받고 시트가 다 내려간 뒤 알리고,
  // 사라진 카드 대신 목록 제목(빈 상태면 그 제목)으로 포커스를 옮긴다
  const canceled = useRef<Canceling | null>(null);
  const listTitleRef = useRef<TextInstance>(null);
  const announceCanceled = (current: Canceling) => {
    if (!current.sheetClosed || !current.canceled || !mounted.current) {
      return;
    }
    if (canceled.current === current) {
      canceled.current = null;
    }
    AccessibilityInfo.announceForAccessibility(
      `${current.request.organizationName} 참여 신청을 취소했어요`,
    );
    if (listTitleRef.current) {
      AccessibilityInfo.sendAccessibilityEvent(listTitleRef.current, 'focus');
    }
  };
  const afterSheetClosed = () => {
    const current = canceled.current;
    if (current) {
      current.sheetClosed = true;
      announceCanceled(current);
    }
  };
  const confirmCancel = (request: ParticipationRequest) => {
    const current = { request, sheetClosed: false, canceled: false };
    canceled.current = current;
    setCanceling(null);
    // mutate 의 콜백은 마지막 호출만 불리므로, 연달아 취소해도 건마다 결과를 받게 promise 로 받는다
    cancel.mutateAsync(request.requestId).then(
      () => {
        current.canceled = true;
        announceCanceled(current);
      },
      error => {
        if (canceled.current === current) {
          canceled.current = null;
        }
        if (mounted.current) {
          const { title, message } = cancelFailure(error);
          Alert.alert(title, message);
        }
      },
    );
  };

  // 당겨서 새로고침. 보던 목록이 있는데 새로 받지 못하면 알리고 목록은 남긴다 (처음부터 받지 못했으면 화면이 오류를 보여 준다)
  const refresh = async () => {
    setRefreshing(true);
    const result = await query.refetch();
    if (!mounted.current) {
      return;
    }
    setRefreshing(false);
    if (result.isError && result.data !== undefined) {
      Alert.alert('목록을 새로 고치지 못했어요', '잠시 후 다시 시도해 주세요.');
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: ParticipationRequest }) => (
      <RequestCard request={item} onCancel={setCanceling} />
    ),
    [],
  );
  const requests = query.data;
  const hasRequests = requests !== undefined && requests.length > 0;
  // 다시 받는 동안은 오류 대신 불러오는 중을 보인다 (isFetching 은 오류일 때만 읽어 평소 다시 받기로 다시 그리지 않는다)
  const failed = query.isError && !query.isFetching;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader
        title="참여 신청 현황"
        onBack={onBack}
        titleRef={titleRef}
      />
      <FlatList
        testID="join-requests-list"
        data={requests ?? NO_REQUESTS}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={
          hasRequests ? (
            <Text
              ref={listTitleRef}
              accessibilityRole="header"
              variant="Body/S/SemiBold"
              style={styles.listTitle}
            >
              승인 대기 {requests.length}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          requests === undefined ? (
            <LoadState
              failed={failed}
              failedTitle="신청 현황을 불러오지 못했어요"
              onRetry={() => query.refetch()}
            />
          ) : (
            <EmptyRequests titleRef={listTitleRef} onJoin={onJoin} />
          )
        }
        ItemSeparatorComponent={Separator}
        contentContainerStyle={[
          readableColumn,
          hasRequests ? styles.list : styles.emptyList,
        ]}
      />
      {hasRequests && (
        <View style={[readableColumn, styles.actions]}>
          <CTA label="조직 참여하기" onPress={onJoin} />
        </View>
      )}

      <CancelRequestSheet
        request={canceling}
        onClose={() => setCanceling(null)}
        onClosed={afterSheetClosed}
        onConfirm={() => {
          if (canceling) {
            confirmCancel(canceling);
          }
        }}
      />
    </SafeAreaView>
  );
}

function EmptyRequests({
  titleRef,
  onJoin,
}: {
  titleRef: RefObject<TextInstance | null>;
  onJoin: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Icon name="document" size={40} color={colors.gray[400]} />
      <Text
        ref={titleRef}
        accessibilityRole="header"
        variant="Body/S/Bold"
        style={styles.center}
      >
        참여 신청 내역이 없어요
      </Text>
      <Text
        variant="Caption/M/Medium"
        color={colors.gray[600]}
        style={styles.center}
      >
        {'회사 코드나 참여 링크·QR로 조직에 참여를\n신청해 보세요.'}
      </Text>
      <CTA label="조직 참여하기" onPress={onJoin} style={styles.emptyCta} />
    </View>
  );
}

const keyExtractor = (item: ParticipationRequest) => item.requestId;

function Separator() {
  return <View style={styles.separator} />;
}

// '신청 취소' 글자 줄을 가장 작은 글자 설정에서도 최소 터치 영역으로 넓힌다
const CANCEL_SLOP = touchSlop(smallestLineHeight('Caption/M/SemiBold'));
const CANCEL_HIT_SLOP = {
  top: CANCEL_SLOP,
  bottom: CANCEL_SLOP,
  left: 8,
  right: 8,
};

const RequestCard = memo(function MyRequestCard({
  request,
  onCancel,
}: {
  request: ParticipationRequest;
  onCancel: (request: ParticipationRequest) => void;
}) {
  return (
    <View style={styles.card} testID={`join-request-${request.requestId}`}>
      <View style={styles.cardTop}>
        <Text variant="Body/S/Bold" style={styles.cardTitle}>
          {request.organizationName}
        </Text>
        <View style={styles.chip}>
          <Text variant="Caption/M/Medium" color={colors.gray[700]}>
            승인 대기
          </Text>
        </View>
      </View>
      <Text variant="Caption/M/Medium" color={colors.gray[600]}>
        희망 유형 {participationTypeLabels[request.desiredType]} ·{' '}
        {formatRequestDate(request.requestedAt)} 신청
      </Text>
      <View style={styles.cardBottom}>
        <Text variant="Caption/M/Medium" color={colors.inspection[1]}>
          사무실에서 검토 중이에요
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${request.organizationName} 신청 취소`}
          hitSlop={CANCEL_HIT_SLOP}
          onPress={() => onCancel(request)}
        >
          <Text variant="Caption/M/SemiBold" color={colors.warning[1]}>
            신청 취소
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  center: { textAlign: 'center' },
  // 빈 상태·불러오는 중은 남은 높이 가운데에 둔다 (당겨서 새로고침이 되게 목록 안에 그린다)
  emptyList: { flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  emptyCta: { alignSelf: 'stretch', marginTop: 28 },
  list: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  listTitle: { marginBottom: 16 },
  separator: { height: 12 },
  card: {
    gap: 8,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: { flex: 1 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.gray[100],
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actions: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
});
