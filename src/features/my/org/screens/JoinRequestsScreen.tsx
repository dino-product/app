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
import {
  colors,
  CTA,
  Icon,
  ICON_HIT_SLOP,
  Text,
  withOpacity,
} from '../../../../shared/design-system';
import { LoadStateView } from '../../../../shared/layout/LoadStateView';
import { readableColumn } from '../../../../shared/layout/readableColumn';
import { SubScreenHeader } from '../../components/SubScreenHeader';
import { CancelRequestSheet } from '../components/CancelRequestSheet';
import { JoinRequestsSkeleton } from '../components/JoinRequestsSkeleton';
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
import { ScreenSafeAreaView } from '../../../../shared/layout/ScreenSafeAreaView';

// Figma 마이페이지-신청현황 (2880:15194 빈 상태 / 2874:14773 승인 대기 목록). 카드는 흰 바탕·Gray200 테두리이고
// 신청 취소는 오른쪽 위 X 다 (승인 대기 칩·'신청 취소' 글자는 빠졌다, #200). 조직 참여하기는 목록 위에 겹친 그라데이션 자리에 있다.
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
const NO_IDS: ReadonlySet<string> = new Set();

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
  // 서버에 취소를 보내는 중인 신청. 그 카드는 답이 올 때까지 다시 취소할 수 없다 (두 번째는 -017 오안내가 된다)
  const [sending, setSending] = useState<ReadonlySet<string>>(NO_IDS);
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
    const { requestId } = request;
    setCanceling(null);
    if (sending.has(requestId)) {
      return;
    }
    const current = { request, sheetClosed: false, canceled: false };
    canceled.current = current;
    setSending(ids => new Set(ids).add(requestId));
    const settle = () => {
      if (mounted.current) {
        setSending(ids => {
          const next = new Set(ids);
          next.delete(requestId);
          return next.size === 0 ? NO_IDS : next;
        });
      }
    };
    // mutate 의 콜백은 마지막 호출만 불리므로, 연달아 취소해도 건마다 결과를 받게 promise 로 받는다
    cancel.mutateAsync(requestId).then(
      () => {
        settle();
        current.canceled = true;
        announceCanceled(current);
      },
      error => {
        settle();
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
      <RequestCard
        request={item}
        sending={sending.has(item.requestId)}
        onCancel={setCanceling}
      />
    ),
    [sending],
  );
  const requests = query.data;
  const hasRequests = requests !== undefined && requests.length > 0;
  // 다시 받는 동안은 오류 대신 불러오는 중을 보인다 (isFetching 은 오류일 때만 읽어 평소 다시 받기로 다시 그리지 않는다)
  const failed = query.isError && !query.isFetching;

  return (
    <ScreenSafeAreaView style={styles.screen}>
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
        extraData={sending}
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={
          hasRequests ? (
            <Text
              ref={listTitleRef}
              accessibilityRole="header"
              variant="Body/S/SemiBold"
              color={colors.gray[900]}
              style={styles.listTitle}
            >
              승인 대기 {requests.length}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          requests === undefined ? (
            <LoadStateView
              state={
                failed
                  ? {
                      status: 'error',
                      message: '신청 현황을 불러오지 못했어요.',
                      onRetry: () => query.refetch(),
                    }
                  : { status: 'loading' }
              }
              skeleton={<JoinRequestsSkeleton />}
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
        // 그라데이션은 창 폭 전체에 깔고, 버튼은 목록과 같은 기둥(최대 600, 좌우 24) 안에 둬 카드와 폭이 같다
        <View pointerEvents="box-none" style={styles.actions}>
          <View
            pointerEvents="box-none"
            style={[readableColumn, styles.actionsColumn]}
          >
            <CTA label="조직 참여하기" onPress={onJoin} />
          </View>
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
    </ScreenSafeAreaView>
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
      <Icon name="document-fill" color={colors.gray[300]} />
      <View style={styles.emptyTexts}>
        <Text
          ref={titleRef}
          accessibilityRole="header"
          variant="Body/M/SemiBold"
          color={colors.primary}
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
      </View>
      <CTA label="조직 참여하기" onPress={onJoin} style={styles.emptyCta} />
    </View>
  );
}

const keyExtractor = (item: ParticipationRequest) => item.requestId;

function Separator() {
  return <View style={styles.separator} />;
}

// Figma 2874:14773 › 2880:15120. 이름·희망 유형 줄 오른쪽 위에 신청 취소 X(ci:close-md 24, #585858), 아래에 검토 안내
const RequestCard = memo(function MyRequestCard({
  request,
  sending,
  onCancel,
}: {
  request: ParticipationRequest;
  /** 서버에 취소를 보내는 중이다. 답이 올 때까지 X 를 흐리게 잠근다 (Figma 미확인) */
  sending: boolean;
  onCancel: (request: ParticipationRequest) => void;
}) {
  return (
    <View style={styles.card} testID={`join-request-${request.requestId}`}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitle}>
          <Text variant="Body/S/SemiBold" color={colors.gray[900]}>
            {request.organizationName}
          </Text>
          <Text variant="Caption/M/Medium" color={colors.gray[600]}>
            희망 유형 {participationTypeLabels[request.desiredType]} ·{' '}
            {formatRequestDate(request.requestedAt)} 신청
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${request.organizationName} 신청 취소${
            sending ? ' 중' : ''
          }`}
          accessibilityState={{ disabled: sending }}
          disabled={sending}
          hitSlop={ICON_HIT_SLOP}
          onPress={() => onCancel(request)}
        >
          <Icon
            name="close-md"
            color={sending ? colors.gray[400] : colors.gray[700]}
          />
        </Pressable>
      </View>
      <Text variant="Caption/M/Medium" color={colors.typeColor.blue}>
        사무실에서 검토 중이에요
      </Text>
    </View>
  );
});

// 아래 버튼 자리 (Figma 2880:15074): 탭 바 포함 185 높이에 #F5F6F8 그라데이션(위 6.1% 까지 투명, 57.1% 부터 불투명)을
// 목록 위에 겹치고, 버튼은 그 위 3 에 있다. 앱 화면은 탭 바(102) 위에서 끝나므로 보이는 83 만 그린다:
// 13.6% 까지 투명, 아래 끝은 76% 불투명
const ACTIONS_TOP = 3;
const ACTIONS_BOTTOM = 24;
const CTA_HEIGHT = 56;
const FIGMA_FADE_HEIGHT = 185;
const FIGMA_TAB_BAR_HEIGHT = 102;
const ACTIONS_HEIGHT = FIGMA_FADE_HEIGHT - FIGMA_TAB_BAR_HEIGHT;
const FADE_CLEAR_UNTIL = FIGMA_FADE_HEIGHT * 0.06103;
const FADE_SOLID_FROM = FIGMA_FADE_HEIGHT * 0.57114;
const FADE_END_OPACITY =
  Math.round(
    ((ACTIONS_HEIGHT - FADE_CLEAR_UNTIL) /
      (FADE_SOLID_FROM - FADE_CLEAR_UNTIL)) *
      100,
  ) / 100;
const FADE_COLOR = colors.background[3];
const percent = (value: number) => `${Math.round(value * 10) / 10}%`;
/** 목록 끝이 버튼 자리 아래로 숨지 않게 비우는 높이 (버튼 자리 + 지금까지의 목록 아래 여백 24) */
const LIST_BOTTOM = ACTIONS_TOP + CTA_HEIGHT + ACTIONS_BOTTOM + 24;
// 빈 상태 묶음(아이콘 40 · 24 · 글자 82 · 40 · 버튼 56)이 Figma 처럼 머리 아래 152 에서 시작하도록 가운데 정렬의 아래 여백
const EMPTY_BOTTOM = 88;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  center: { textAlign: 'center' },
  // 빈 상태·불러오는 중은 남은 높이 가운데에 둔다 (당겨서 새로고침이 되게 목록 안에 그린다)
  emptyList: { flexGrow: 1 },
  // Figma 3278:23404: 아이콘–글자 24, 제목–설명 12, 설명–버튼 40
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 24,
    paddingBottom: EMPTY_BOTTOM,
  },
  emptyTexts: { alignItems: 'center', gap: 12 },
  emptyCta: { alignSelf: 'stretch', marginTop: 40 - 24 },
  list: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: LIST_BOTTOM },
  // Figma 2880:15160: 머리 아래 12, 첫 카드 위 12
  listTitle: { marginBottom: 12 },
  separator: { height: 12 },
  card: {
    gap: 6,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: colors.white[100],
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: { flex: 1, gap: 6 },
  actionsColumn: { paddingHorizontal: 24 },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: ACTIONS_TOP,
    paddingBottom: ACTIONS_BOTTOM,
    backgroundImage: `linear-gradient(to bottom, ${withOpacity(
      FADE_COLOR,
      0,
    )} ${percent((FADE_CLEAR_UNTIL / ACTIONS_HEIGHT) * 100)}, ${withOpacity(
      FADE_COLOR,
      FADE_END_OPACITY,
    )} 100%)`,
  },
});
