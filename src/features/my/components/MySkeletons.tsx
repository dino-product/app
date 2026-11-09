import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  colors,
  Skeleton,
  SkeletonBlock,
  SkeletonLine,
} from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';

// 마이 탭 화면들을 받는 동안의 스켈레톤 (#139). Figma 에 없어 각 화면의 실제 카드·행과 같은
// 여백·모서리·글자 줄 높이로 최소 구성한다 (Figma 미확인)

/** 마이페이지 프로필 카드 안: 사진, 이름·연락처·가입일. 카드(흰 배경·모서리)는 화면이 그린다 */
export const ProfileCardSkeleton = memo(function ProfileCardSkeletonView() {
  return (
    <Skeleton style={styles.profile} testID="profile-card-skeleton">
      <SkeletonBlock width={60} height={60} radius={30} />
      <View style={styles.fill}>
        <SkeletonLine variant="Body/S/SemiBold" width="40%" />
        <SkeletonLine variant="Caption/M/Medium" width="55%" />
        <SkeletonLine variant="Caption/S/Medium" width="35%" />
      </View>
    </Skeleton>
  );
});

function MembershipRowSkeleton() {
  return (
    <View style={styles.membershipRow}>
      <View style={styles.fill}>
        <SkeletonLine variant="Body/XS/SemiBold" width="45%" />
        <SkeletonLine variant="Caption/M/Medium" width="25%" />
      </View>
      <SkeletonBlock width={40} height={21} radius={8} />
    </View>
  );
}

/** 마이페이지 소속 발주사 카드 안: 소속 행 두 줄. 카드는 화면이 그린다 */
export const MembershipsSkeleton = memo(function MembershipsSkeletonView() {
  return (
    <Skeleton testID="memberships-skeleton">
      <MembershipRowSkeleton />
      <View style={styles.membershipDivider} />
      <MembershipRowSkeleton />
    </Skeleton>
  );
});

function NotificationRowSkeleton() {
  return (
    <View style={styles.notificationRow} testID="notification-row-skeleton">
      <View style={[readableColumn, styles.notificationContent]}>
        <View style={styles.spread}>
          <SkeletonLine variant="Caption/S/Medium" width={48} />
          <SkeletonLine variant="Caption/S/Medium" width={40} />
        </View>
        <SkeletonLine variant="Caption/M/Medium" width="85%" />
        <View style={styles.notificationRule} />
      </View>
    </View>
  );
}

/** 알림센터 첫 쪽: 알림 행 여섯 줄. 상단 바 아래 목록 자리에 그린다 */
export const NotificationListSkeleton = memo(
  function NotificationListSkeletonView() {
    return (
      <Skeleton
        style={styles.notificationList}
        testID="notification-list-skeleton"
      >
        <NotificationRowSkeleton />
        <NotificationRowSkeleton />
        <NotificationRowSkeleton />
        <NotificationRowSkeleton />
        <NotificationRowSkeleton />
        <NotificationRowSkeleton />
      </Skeleton>
    );
  },
);

/** 알림센터 다음 쪽: 목록 끝의 알림 행 두 줄 */
export const NotificationMoreSkeleton = memo(
  function NotificationMoreSkeletonView() {
    return (
      <Skeleton testID="notification-more-skeleton">
        <NotificationRowSkeleton />
        <NotificationRowSkeleton />
      </Skeleton>
    );
  },
);

function SettingCardSkeleton() {
  return (
    <View style={styles.settingCard}>
      <View style={styles.settingText}>
        <SkeletonLine variant="Body/S/SemiBold" width="45%" />
        <SkeletonLine variant="Caption/M/Medium" width="85%" />
      </View>
      <SkeletonBlock width={46} height={26} radius={13} />
    </View>
  );
}

/** 알림 설정: 설정 카드 세 장 */
export const NotificationSettingsSkeleton = memo(
  function NotificationSettingsSkeletonView() {
    return (
      <Skeleton
        style={[readableColumn, styles.settings]}
        testID="notification-settings-skeleton"
      >
        <SettingCardSkeleton />
        <SettingCardSkeleton />
        <SettingCardSkeleton />
      </Skeleton>
    );
  },
);

function FormFieldSkeleton() {
  return (
    <View style={styles.formField}>
      <SkeletonLine variant="Caption/M/SemiBold" width={56} />
      <SkeletonBlock height={50} radius={12} />
    </View>
  );
}

/** 프로필 수정: 사진과 이름·연락처 입력칸 */
export const ProfileFormSkeleton = memo(function ProfileFormSkeletonView() {
  return (
    <Skeleton
      style={[readableColumn, styles.form]}
      testID="profile-form-skeleton"
    >
      <SkeletonBlock
        width={96}
        height={96}
        radius={48}
        style={styles.formAvatar}
      />
      <FormFieldSkeleton />
      <FormFieldSkeleton />
    </Skeleton>
  );
});

function BlockCardSkeleton() {
  return (
    <View style={styles.blockCard}>
      <View style={styles.blockText}>
        <SkeletonLine variant="Body/S/SemiBold" width="50%" />
        <SkeletonLine variant="Caption/M/Medium" width="75%" />
      </View>
      <SkeletonBlock width={32} height={32} radius={16} />
    </View>
  );
}

/** 계정 관리(탈퇴 불가): 사유 카드 두 장. 안내 아래에 그린다 */
export const WithdrawalBlocksSkeleton = memo(
  function WithdrawalBlocksSkeletonView() {
    return (
      <Skeleton style={styles.blocks} testID="withdrawal-blocks-skeleton">
        <BlockCardSkeleton />
        <BlockCardSkeleton />
      </Skeleton>
    );
  },
);

const styles = StyleSheet.create({
  fill: { flex: 1 },
  spread: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  // MyPageScreen 프로필 카드와 같은 여백
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  // MyPageScreen 소속 행과 같은 여백 (카드 안 8 + 행 안 12)
  membershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  membershipDivider: {
    height: 1,
    marginHorizontal: 12,
    backgroundColor: colors.gray[100],
  },
  // NotificationCenterScreen 목록·행과 같은 여백
  notificationList: { paddingTop: 8 },
  notificationRow: { paddingHorizontal: 24 },
  notificationContent: { gap: 8, paddingVertical: 22 },
  // 행 사이 선은 실제처럼 높이를 차지하지 않고 양옆을 조금 넘는다
  notificationRule: {
    position: 'absolute',
    left: -4,
    right: -4,
    bottom: 0,
    height: 1,
    backgroundColor: colors.gray[100],
  },
  // NotificationSettingsScreen 과 같은 여백·카드
  settings: { gap: 12, paddingHorizontal: 24, paddingTop: 18 },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.background[3],
  },
  settingText: { flex: 1, gap: 4 },
  // ProfileEditScreen 과 같은 여백
  form: { gap: 24, paddingHorizontal: 24, paddingTop: 36 },
  formAvatar: { alignSelf: 'center', marginBottom: 8 },
  formField: { gap: 8 },
  // WithdrawalBlockedScreen 사유 카드와 같은 카드
  blocks: { gap: 12 },
  blockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.background[3],
  },
  blockText: { flex: 1, gap: 4 },
});
