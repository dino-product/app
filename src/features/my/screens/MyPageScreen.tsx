import { Fragment, memo, type Ref } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  createTextStyle,
  fonts,
  Icon,
  ICON_HIT_SLOP,
  Text,
  touchSlop,
  type IconName,
} from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import {
  formatJoinDate,
  formatPhoneNumber,
  memberRoleLabels,
  type Membership,
  type Profile,
} from '../model';

// Figma 마이페이지 (3235:17104)
export type MyPageScreenProps = {
  profile: Profile;
  memberships: readonly Membership[];
  /** 아직 결과가 나오지 않은 조직 참여 신청 수 */
  pendingRequestCount: number;
  onOpenNotifications: () => void;
  onEditProfile: () => void;
  /** 참여 신청 현황 (#73) */
  onOpenRequestStatus: () => void;
  /** 조직 참여하기 (#73) */
  onJoinOrganization: () => void;
  onOpenNotificationSettings: () => void;
  onOpenTerms: () => void;
  onOpenAccount: () => void;
  /** 바깥에서 맨 위로 올릴 때 쓴다 */
  scrollRef?: Ref<ScrollViewInstance>;
};

export function MyPageScreen({
  profile,
  memberships,
  pendingRequestCount,
  onOpenNotifications,
  onEditProfile,
  onOpenRequestStatus,
  onJoinOrganization,
  onOpenNotificationSettings,
  onOpenTerms,
  onOpenAccount,
  scrollRef,
}: MyPageScreenProps) {
  const phone = formatPhoneNumber(profile.phoneNumber);
  const joinDate = `가입일 ${formatJoinDate(profile.signedUpAt)}`;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {/* 소속 발주사는 한 사람이 몇 곳뿐이라 카드 하나 안에 다 그린다 (가상화할 만큼 길지 않다) */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[readableColumn, styles.content]}
      >
        <View style={styles.titleRow}>
          <Text
            accessibilityRole="header"
            variant="Body/XL/SemiBold"
            color={colors.black}
          >
            마이페이지
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="알림센터"
            hitSlop={ICON_HIT_SLOP}
            onPress={onOpenNotifications}
          >
            <Icon name="bell" />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${profile.name}, ${phone}, ${joinDate}`}
          accessibilityHint="프로필을 수정합니다"
          onPress={onEditProfile}
          style={({ pressed }) => [
            styles.card,
            styles.profileCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.avatar}>
            <Icon name="user" size={30} color={colors.support.sideBarIcon} />
          </View>
          <View style={styles.profileText}>
            <Text variant="Body/S/SemiBold">{profile.name}</Text>
            <Text variant="Caption/M/Medium" color={colors.gray[700]}>
              {phone}
            </Text>
            <Text variant="Caption/S/Medium" color={colors.gray[600]}>
              {joinDate}
            </Text>
          </View>
          <Icon name="chevron-right-line" color={CHEVRON_COLOR} />
        </Pressable>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text accessibilityRole="header" variant="Body/S/SemiBold">
              소속 발주사
            </Text>
            <View style={styles.sectionActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  pendingRequestCount > 0
                    ? `신청 현황, ${pendingRequestCount}건`
                    : '신청 현황'
                }
                hitSlop={ACTION_HIT_SLOP}
                onPress={onOpenRequestStatus}
                style={styles.requestStatus}
              >
                <Text variant="Caption/M/Medium" color={REQUEST_STATUS_COLOR}>
                  신청 현황
                </Text>
                {pendingRequestCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText} color={colors.white[100]}>
                      {pendingRequestCount}
                    </Text>
                  </View>
                )}
                <Icon
                  name="chevron-right-line"
                  size={16}
                  color={colors.gray[500]}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                hitSlop={ACTION_HIT_SLOP}
                onPress={onJoinOrganization}
                style={({ pressed }) => [
                  styles.joinButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text variant="Caption/S/Medium" color={colors.white[100]}>
                  조직 참여
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={[styles.card, styles.membershipCard]}>
            {memberships.length === 0 ? (
              <Text variant="Caption/M/Medium" color={colors.gray[600]}>
                아직 소속된 발주사가 없어요
              </Text>
            ) : (
              memberships.map((membership, index) => (
                <Fragment key={membership.organizationId}>
                  {index > 0 && <View style={styles.divider} />}
                  <MembershipRow membership={membership} />
                </Fragment>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" variant="Body/S/SemiBold">
            설정 및 정보
          </Text>
          <View style={[styles.card, styles.settingsCard]}>
            <SettingRow
              icon="bell"
              label="알림 설정"
              onPress={onOpenNotificationSettings}
            />
            <SettingRow
              icon="document"
              label="약관 및 앱 정보"
              onPress={onOpenTerms}
            />
            <SettingRow icon="user" label="계정 관리" onPress={onOpenAccount} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const statusSpec = {
  ACTIVE: {
    label: '활성',
    background: colors.completed[2],
    foreground: colors.completed[1],
  },
  DEACTIVATED: {
    label: '비활성',
    background: colors.registered[2],
    foreground: colors.registered[1],
  },
} as const;

const chipBackgrounds = StyleSheet.create({
  ACTIVE: { backgroundColor: statusSpec.ACTIVE.background },
  DEACTIVATED: { backgroundColor: statusSpec.DEACTIVATED.background },
});

// Figma 에 누르는 동작이 없어 정보 행이다. 스크린리더는 한 줄로 읽는다
const MembershipRow = memo(function MyMembershipRow({
  membership,
}: {
  membership: Membership;
}) {
  const { organizationId, organizationName, role, status } = membership;
  const spec = statusSpec[status];
  const roleLabel = memberRoleLabels[role];
  return (
    <View
      accessible
      accessibilityLabel={`${organizationName}, ${roleLabel}, ${spec.label}`}
      style={styles.membershipRow}
      testID={`membership-${organizationId}`}
    >
      <View style={styles.membershipText}>
        <Text variant="Body/XS/SemiBold">{organizationName}</Text>
        <Text variant="Caption/M/Medium" color={colors.gray[600]}>
          {roleLabel}
        </Text>
      </View>
      <View
        style={[styles.chip, chipBackgrounds[status]]}
        testID={`membership-${organizationId}-status`}
      >
        <Text variant="Caption/S/Medium" color={spec.foreground}>
          {spec.label}
        </Text>
      </View>
    </View>
  );
});

function SettingRow({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={SETTING_ROW_HIT_SLOP}
      onPress={onPress}
      style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}
    >
      <Icon name={icon} size={20} color={colors.gray[700]} />
      <Text variant="Body/XS/Medium">{label}</Text>
    </Pressable>
  );
}

// Figma 에만 있는 색 (컬렉션 밖 값)
const CHEVRON_COLOR = '#A1A1AA';
const REQUEST_STATUS_COLOR = '#6B6E76';

/** '신청 현황'·'조직 참여' 줄의 높이 (조직 참여 버튼) */
const ACTION_HEIGHT = 30;
const ACTION_HIT_SLOP = {
  top: touchSlop(ACTION_HEIGHT),
  bottom: touchSlop(ACTION_HEIGHT),
};
/** 설정 행 높이. Figma 의 글자 줄(22)과 행 사이 간격(24)을 행 안 여백으로 옮겼다 */
const SETTING_ROW_HEIGHT = 46;
const SETTING_ROW_HIT_SLOP = {
  top: touchSlop(SETTING_ROW_HEIGHT),
  bottom: touchSlop(SETTING_ROW_HEIGHT),
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background[3] },
  content: {
    gap: 24,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -4,
  },
  card: {
    borderRadius: 16,
    backgroundColor: colors.white[100],
  },
  pressed: { opacity: 0.8 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 20,
    boxShadow: '0px 0px 12px rgba(0, 0, 0, 0.04)',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background[2],
  },
  profileText: { flex: 1 },
  section: { gap: 12 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requestStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: ACTION_HEIGHT,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
  },
  // Figma 배지 숫자는 텍스트 스타일 없이 Bold 12 (행간 140%, 자간 -2.5%)
  badgeText: createTextStyle({
    font: fonts.bold,
    size: 12,
    lineHeightPercent: 140,
    letterSpacingPercent: -2.5,
  }),
  joinButton: {
    height: ACTION_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  membershipCard: {
    padding: 20,
    boxShadow: '0px 1px 18px rgba(119, 107, 168, 0.08)',
  },
  membershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  membershipText: { flex: 1 },
  divider: {
    height: 1,
    marginVertical: 13,
    backgroundColor: colors.gray[100],
  },
  // 글꼴 확대 시 잘리지 않도록 Figma 높이(21)는 최소값으로만 건다
  chip: {
    minHeight: 21,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  settingsCard: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    boxShadow: '0px 1px 18px rgba(119, 107, 168, 0.08)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: SETTING_ROW_HEIGHT,
  },
});
