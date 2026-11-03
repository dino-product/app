import { memo, type Ref } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Icon, Text, touchSlop } from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { SubScreenHeader } from '../components/SubScreenHeader';
import {
  withdrawalBlockCards,
  type WithdrawalBlock,
  type WithdrawalBlockCard,
  type WithdrawalBlockReason,
} from '../model';

// Figma 마이페이지-탈퇴 불가 (2935:14696). 있는 사유만 카드로 보인다
export function WithdrawalBlockedScreen({
  blocks,
  onOpenBlock,
  onBack,
  titleRef,
}: {
  blocks: readonly WithdrawalBlock[];
  /** 사유를 정리할 곳(진행 중인 작업 → 홈, 미완료 배정 → 내 일정 응답 필요)으로 */
  onOpenBlock: (reason: WithdrawalBlockReason) => void;
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const cards = withdrawalBlockCards(blocks);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SubScreenHeader title="계정 관리" onBack={onBack} titleRef={titleRef} />
      <ScrollView contentContainerStyle={[readableColumn, styles.content]}>
        <View style={styles.intro}>
          <Icon name="info-circle" size={36} />
          <Text accessibilityRole="header" variant="Body/L/Bold">
            계정 탈퇴 불가
          </Text>
          <Text
            variant="Body/XS/Regular"
            color={colors.gray[600]}
            style={styles.center}
          >
            현재 다음 사유로 인해 탈퇴가 불가능합니다
          </Text>
        </View>
        {cards.length > 0 ? (
          <View style={styles.cards}>
            {cards.map(card => (
              <BlockCard key={card.reason} card={card} onOpen={onOpenBlock} />
            ))}
          </View>
        ) : (
          // 사유를 다 정리하고 돌아왔거나, 서버가 사유 없이 탈퇴 불가를 준 경우 (문구는 기본안)
          <Text
            variant="Caption/M/Medium"
            color={colors.gray[600]}
            style={styles.center}
          >
            지금은 탈퇴를 막는 사유가 없어요. 계정 관리에서 다시 시도해 주세요.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// 진행 중인 작업은 연주황(작업중 색), 나머지는 회색. 유일한 총관리자는 앱 안에 정리할 곳이 없어 > 가 없다
const tones: Record<
  WithdrawalBlockReason,
  { background: string; count: string; openable: boolean }
> = {
  WORK_IN_PROGRESS: {
    background: colors.inProgress[4],
    count: colors.inProgress[5],
    openable: true,
  },
  WORK_PENDING_ACCEPT: {
    background: colors.registered[2],
    count: colors.gray[600],
    openable: true,
  },
  SOLE_OWNER: {
    background: colors.registered[2],
    count: colors.gray[600],
    openable: false,
  },
};

const cardBackgrounds = StyleSheet.create({
  WORK_IN_PROGRESS: { backgroundColor: tones.WORK_IN_PROGRESS.background },
  WORK_PENDING_ACCEPT: {
    backgroundColor: tones.WORK_PENDING_ACCEPT.background,
  },
  SOLE_OWNER: { backgroundColor: tones.SOLE_OWNER.background },
});

const OPEN_BUTTON_SIZE = 32;
const OPEN_HIT_SLOP = touchSlop(OPEN_BUTTON_SIZE);

const BlockCard = memo(function MyBlockCard({
  card,
  onOpen,
}: {
  card: WithdrawalBlockCard;
  onOpen: (reason: WithdrawalBlockReason) => void;
}) {
  const tone = tones[card.reason];
  return (
    <View
      style={[styles.card, cardBackgrounds[card.reason]]}
      testID={`withdrawal-block-${card.reason}`}
    >
      <View style={styles.cardText}>
        <Text variant="Body/S/SemiBold">
          {card.title}
          {'  '}
          <Text variant="Body/S/SemiBold" color={tone.count}>
            {card.count}
          </Text>
        </Text>
        <Text variant="Caption/M/Medium" color={colors.gray[600]}>
          {card.description}
        </Text>
      </View>
      {tone.openable && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${card.title} ${card.count}건 보기`}
          hitSlop={OPEN_HIT_SLOP}
          onPress={() => onOpen(card.reason)}
          style={styles.openButton}
        >
          <Icon name="chevron-right-line" size={20} color={colors.white[100]} />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  content: {
    gap: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  intro: { alignItems: 'center', gap: 8 },
  center: { textAlign: 'center' },
  cards: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 16,
  },
  cardText: { flex: 1, gap: 4 },
  openButton: {
    width: OPEN_BUTTON_SIZE,
    height: OPEN_BUTTON_SIZE,
    borderRadius: OPEN_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
});
