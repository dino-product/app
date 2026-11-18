import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, Text } from '../../../shared/design-system';

// 마이페이지 소속 카드의 상태 칩 (Figma 마이페이지 3235:17104 › 소속 카드 3235:17146 의 '작업상태 컬러칩').
// 승인(3235:17151)은 초록, 검토(3235:17157)는 회색이다. 비활성(소속이 꺼짐)은 Figma 에 없어 회색으로 둔다.
// 참여 요청 현황(마이페이지 검토 줄에서 연 요청 완료, #199)의 상태 칩도 같은 칩이다
export type MembershipChipStatus = 'approved' | 'review' | 'deactivated';

const spec = {
  approved: {
    label: '승인',
    background: colors.completed[2],
    foreground: colors.completed[1],
  },
  review: {
    label: '검토',
    background: colors.registered[2],
    foreground: colors.registered[1],
  },
  deactivated: {
    label: '비활성',
    background: colors.registered[2],
    foreground: colors.registered[1],
  },
} as const satisfies Record<
  MembershipChipStatus,
  { label: string; background: string; foreground: string }
>;

export const membershipChipLabels: Record<MembershipChipStatus, string> = {
  approved: spec.approved.label,
  review: spec.review.label,
  deactivated: spec.deactivated.label,
};

export const MembershipChip = memo(function MyMembershipChip({
  status,
  testID,
}: {
  status: MembershipChipStatus;
  testID?: string;
}) {
  return (
    <View style={[styles.chip, backgrounds[status]]} testID={testID}>
      <Text variant="Caption/S/Medium" color={spec[status].foreground}>
        {spec[status].label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  // 글꼴 확대 시 잘리지 않도록 Figma 높이(21)는 최소값으로만 건다
  chip: {
    minHeight: 21,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
});

const backgrounds = StyleSheet.create({
  approved: { backgroundColor: spec.approved.background },
  review: { backgroundColor: spec.review.background },
  deactivated: { backgroundColor: spec.deactivated.background },
});
