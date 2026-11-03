import type { Ref } from 'react';
import { ScrollView, StyleSheet, View, type TextInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, CTA, Icon, Text } from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import {
  STANDALONE_SCREEN_EDGES,
  standaloneScreen,
} from '../../../shared/layout/standaloneScreen';
import { SubScreenHeader } from '../../my/components/SubScreenHeader';
import { InfoNotice } from '../../my/org/components/InfoNotice';
import { SummaryCard } from '../../my/org/components/SummaryCard';
import {
  formatRequestDate,
  participationTypeLabels,
  type ParticipationRequest,
} from '../../my/org/model';
import { withRo } from '../model';

// Figma 참여 완료 (3227:8525), 참여 완료-유형 변경 (3239:9100).
// 유형 변경 화면은 제목이 '직원' 인데 요약 유형은 '기사' 라, 둘 다 확정된 유형으로 보인다 (기본안, 디자인 확인 항목).
// '승인 전까지 …' 안내는 Figma 대로 승인 완료 화면에도 둔다 (디자인 확인 항목)
export function JoinApprovedScreen({
  request,
  onStart,
  onBack,
  titleRef,
}: {
  /** 승인된 요청 (approvedType 이 확정 유형) */
  request: ParticipationRequest;
  /** 시작하기. 메인(홈 탭)으로 간다 */
  onStart: () => void;
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const approvedType = request.approvedType ?? request.desiredType;
  const typeLabel = participationTypeLabels[approvedType];
  const typeChanged = approvedType !== request.desiredType;

  return (
    <SafeAreaView
      edges={STANDALONE_SCREEN_EDGES}
      style={standaloneScreen.screen}
    >
      <SubScreenHeader title="참여 완료" onBack={onBack} titleRef={titleRef} />
      <ScrollView
        {...noOverscroll}
        contentContainerStyle={[readableColumn, styles.content]}
      >
        <View style={styles.intro}>
          <Icon name="modal-check" />
          <View style={styles.texts}>
            <Text
              accessibilityRole="header"
              variant="Body/L/Bold"
              style={styles.center}
            >
              {`${
                typeChanged ? typeLabel : request.organizationName
              } 참여 승인 완료`}
            </Text>
            <Text
              variant="Body/XS/Medium"
              color={colors.gray[600]}
              style={styles.center}
            >
              {typeChanged
                ? '사무실에서 요청하신 유형과 다르게 확정했어요.'
                : `${typeLabel}${withRo(
                    typeLabel,
                  )} 승인되었어요.\n이제 배정된 작업을 확인할 수 있어요.`}
            </Text>
          </View>
        </View>

        <View style={styles.summary}>
          <SummaryCard
            rows={[
              { label: '회사', value: request.organizationName },
              { label: '유형', value: typeLabel },
              {
                label: '승인일',
                value: formatRequestDate(
                  request.decidedAt ?? request.requestedAt,
                ),
              },
            ]}
          />
          <Text
            variant="Caption/S/Medium"
            color={colors.libraryGray[500]}
            style={styles.center}
          >
            승인 전까지 회사의 일정과 작업은 표시되지 않습니다.
          </Text>
        </View>
      </ScrollView>

      {typeChanged && (
        <View style={[readableColumn, styles.notice]}>
          <InfoNotice
            message={
              '유형이 맞지 않다면 사무실 관리자에게 문의해 주세요.\n유형은 사무실에서 변경할 수 있어요.'
            }
          />
        </View>
      )}
      <View style={[readableColumn, standaloneScreen.actions]}>
        <CTA label="시작하기" onPress={onStart} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 머리 아래 42 에 아이콘, 안내와 요약 사이 42 (Figma 3227:8525)
  content: {
    gap: 42,
    paddingHorizontal: 24,
    paddingTop: 42,
    paddingBottom: 24,
  },
  intro: { alignItems: 'center', gap: 24 },
  texts: { gap: 6 },
  center: { textAlign: 'center' },
  summary: { gap: 12 },
  // 안내 상자는 아래 버튼 줄 위 16 에 붙는다 (Figma 위치 668)
  notice: { paddingHorizontal: 24, paddingBottom: 16 },
});
