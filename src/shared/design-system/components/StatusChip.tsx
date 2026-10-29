import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../tokens/colors';
import { Text } from './Text';

// Figma DesignSystem › 작업상태 컬러칩(M) / 작업 상세 컬러 칩(S). 두 세트는 크기만 다르다.
export type WorkStatus =
  | 'registered'
  | 'assigned'
  | 'beforeWork'
  | 'inProgress'
  | 'completed'
  | 'rejected'
  | 'delayed';

export type StatusChipProps = {
  status: WorkStatus;
  size?: 'M' | 'S';
  /** 기본값은 상태 이름 (등록, 배정됨 …) */
  label?: string;
  /** 기본은 내용 폭(alignSelf: flex-start). 가로 줄 안에서 정렬을 바꿀 때 쓴다. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const statusSpec: Record<
  WorkStatus,
  { label: string; background: string; foreground: string }
> = {
  registered: {
    label: '등록',
    background: colors.registered[2],
    foreground: colors.registered[1],
  },
  assigned: {
    label: '배정됨',
    background: colors.pending[3],
    foreground: colors.pending[1],
  },
  beforeWork: {
    label: '작업전',
    background: colors.accepted[2],
    foreground: colors.accepted[1],
  },
  inProgress: {
    label: '작업중',
    background: colors.inProgress[4],
    foreground: colors.inProgress[5],
  },
  completed: {
    label: '완료',
    background: colors.completed[2],
    foreground: colors.completed[1],
  },
  rejected: {
    label: '거절',
    background: colors.warning[2],
    foreground: colors.warning[1],
  },
  delayed: {
    label: '지연',
    background: colors.delayed[2],
    foreground: colors.delayed[1],
  },
};

export const StatusChip = memo(function DesignSystemStatusChip({
  status,
  size = 'M',
  label,
  style,
  testID,
}: StatusChipProps) {
  const spec = statusSpec[status];

  return (
    <View
      testID={testID}
      style={[styles.base, sizeStyles[size], backgroundStyles[status], style]}
    >
      <Text
        variant={size === 'M' ? 'Body/XS/Medium' : 'Caption/M/SemiBold'}
        color={spec.foreground}
      >
        {label ?? spec.label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
});

// 글꼴 확대 시 잘리지 않도록 Figma 높이는 최소값으로만 건다
const sizeStyles = StyleSheet.create({
  M: { minHeight: 30 },
  S: { minHeight: 28 },
});

const backgroundStyles = StyleSheet.create(
  Object.fromEntries(
    Object.entries(statusSpec).map(([status, spec]) => [
      status,
      { backgroundColor: spec.background },
    ]),
  ) as Record<WorkStatus, { backgroundColor: string }>,
);
