import { memo, useCallback, useRef, useState, type Ref } from 'react';
import {
  AccessibilityInfo,
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
import {
  formatRequestDate,
  participationTypeLabels,
  type ParticipationRequest,
} from '../model';

// Figma 마이페이지-신청현황 (2880:15194 빈 상태 / 2874:14773 승인 대기 목록)
export function JoinRequestsScreen({
  requests,
  onCancel,
  onJoin,
  onBack,
  titleRef,
}: {
  /** 승인 대기 중인 신청 */
  requests: readonly ParticipationRequest[];
  onCancel: (requestId: string) => void;
  /** 조직 참여하기 (회사 찾기) */
  onJoin: () => void;
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const [canceling, setCanceling] = useState<ParticipationRequest | null>(null);
  // 방금 취소한 신청. 시트가 다 내려간 뒤 알리고, 사라진 카드 대신 목록 제목(빈 상태면 그 제목)으로 포커스를 옮긴다
  const canceled = useRef<ParticipationRequest | null>(null);
  const listTitleRef = useRef<TextInstance>(null);
  const afterSheetClosed = () => {
    const request = canceled.current;
    if (!request) {
      return;
    }
    canceled.current = null;
    AccessibilityInfo.announceForAccessibility(
      `${request.organizationName} 참여 신청을 취소했어요`,
    );
    if (listTitleRef.current) {
      AccessibilityInfo.sendAccessibilityEvent(listTitleRef.current, 'focus');
    }
  };
  const renderItem = useCallback(
    ({ item }: { item: ParticipationRequest }) => (
      <RequestCard request={item} onCancel={setCanceling} />
    ),
    [],
  );
  const empty = requests.length === 0;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader
        title="참여 신청 현황"
        onBack={onBack}
        titleRef={titleRef}
      />
      {empty ? (
        <View style={[readableColumn, styles.empty]}>
          <Icon name="document" size={40} color={colors.gray[400]} />
          <Text
            ref={listTitleRef}
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
      ) : (
        <>
          <FlatList
            data={requests}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={
              <Text
                ref={listTitleRef}
                accessibilityRole="header"
                variant="Body/S/SemiBold"
                style={styles.listTitle}
              >
                승인 대기 {requests.length}
              </Text>
            }
            ItemSeparatorComponent={Separator}
            contentContainerStyle={[readableColumn, styles.list]}
          />
          <View style={[readableColumn, styles.actions]}>
            <CTA label="조직 참여하기" onPress={onJoin} />
          </View>
        </>
      )}

      <CancelRequestSheet
        request={canceling}
        onClose={() => setCanceling(null)}
        onClosed={afterSheetClosed}
        onConfirm={requestId => {
          canceled.current = canceling;
          onCancel(requestId);
          setCanceling(null);
        }}
      />
    </SafeAreaView>
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
