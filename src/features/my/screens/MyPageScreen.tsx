import { Fragment, memo, type Ref } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type PressableStateCallbackType,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  createTextStyle,
  fonts,
  Icon,
  pressedBackground,
  Text,
  touchSlop,
  type IconName,
} from '../../../shared/design-system';
import { noOverscroll } from '../../../shared/layout/noOverscroll';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { TabHeader } from '../../../shared/layout/TabHeader';
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
      <TabHeader title="마이페이지" onOpenNotifications={onOpenNotifications} />
      {/* 소속 발주사는 한 사람이 몇 곳뿐이라 카드 하나 안에 다 그린다 (가상화할 만큼 길지 않다) */}
      <ScrollView
        {...noOverscroll}
        ref={scrollRef}
        contentContainerStyle={[readableColumn, styles.content]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${profile.name}, ${phone}, ${joinDate}`}
          accessibilityHint="프로필을 수정합니다"
          onPress={onEditProfile}
          style={profileCardStyle}
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
                  pressed && styles.buttonPressed,
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
              <Text
                variant="Caption/M/Medium"
                color={colors.gray[600]}
                style={styles.membershipEmpty}
              >
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

// Figma 에 누르는 동작이 없어 정보 행이다. 스크린리더는 한 줄로 읽는다.
// 누르고 있는 동안에는 다른 리스트 행처럼 회색 배경을 보인다 (#102). 동작은 없어 버튼으로 읽히지 않는다
const MembershipRow = memo(function MyMembershipRow({
  membership,
}: {
  membership: Membership;
}) {
  const { organizationId, organizationName, role, status } = membership;
  const spec = statusSpec[status];
  const roleLabel = memberRoleLabels[role];
  return (
    <Pressable
      accessible
      accessibilityLabel={`${organizationName}, ${roleLabel}, ${spec.label}`}
      // 누를 동작이 없으니 Android 에서 클릭할 수 있는 뷰로 만들지 않는다 (TalkBack 이 활성화하라고 읽지 않게)
      focusable={false}
      style={membershipRowStyle}
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
    </Pressable>
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
      style={settingRowStyle}
    >
      <Icon name={icon} size={20} color={colors.gray[700]} />
      <Text variant="Body/XS/Medium">{label}</Text>
    </Pressable>
  );
}

// 누르는 동안 회색 배경 (#102). 흰 카드 안 행은 카드 모서리와 같은 중심의 둥근 사각형으로 칠한다
const profileCardStyle = ({ pressed }: PressableStateCallbackType) => [
  styles.card,
  styles.profileCard,
  pressed && styles.rowPressed,
];
const membershipRowStyle = ({ pressed }: PressableStateCallbackType) => [
  styles.membershipRow,
  pressed && styles.rowPressed,
];
const settingRowStyle = ({ pressed }: PressableStateCallbackType) => [
  styles.settingRow,
  pressed && styles.rowPressed,
];

// Figma 에만 있는 색 (컬렉션 밖 값)
const CHEVRON_COLOR = '#A1A1AA';
const REQUEST_STATUS_COLOR = '#6B6E76';

/** '신청 현황'·'조직 참여' 줄의 높이 (조직 참여 버튼) */
const ACTION_HEIGHT = 30;
const ACTION_HIT_SLOP = {
  top: touchSlop(ACTION_HEIGHT),
  bottom: touchSlop(ACTION_HEIGHT),
};
/** 소속·설정 카드 안에서 눌림 회색이 카드 가장자리와 떨어지는 거리. 글자는 지금처럼 카드 안 20 에서 시작한다 */
const CARD_INSET = 8;
/** 카드 모서리(16)와 같은 중심이 되는 눌림 회색의 모서리 */
const ROW_RADIUS = 16 - CARD_INSET;
/** 소속 행 위아래 여백. 행 사이 간격(13 · 선 · 13)을 행 안으로 옮겼다 */
const MEMBERSHIP_ROW_PADDING = 13;
/** 설정 행 높이. Figma 의 글자 줄(22)과 행 사이 간격(24)을 행 안 여백으로 옮겼다 */
const SETTING_ROW_HEIGHT = 46;
const SETTING_ROW_HIT_SLOP = {
  top: touchSlop(SETTING_ROW_HEIGHT),
  bottom: touchSlop(SETTING_ROW_HEIGHT),
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background[3] },
  // 프로필 카드는 지금처럼 제목 줄 아래 20 에서 시작한다. 제목 줄은 스크롤 밖 상단 바다 (#103)
  content: {
    gap: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 16,
    backgroundColor: colors.white[100],
  },
  // '조직 참여' 는 CTA 처럼 눌리는 동안 흐려진다
  buttonPressed: { opacity: 0.8 },
  rowPressed: { backgroundColor: pressedBackground.onWhite },
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
  // 카드 안 여백 20 중 일부(가로 12, 세로 13)를 행 안으로 옮겨, 눌림 회색이 글자 둘레에 둥글게 칠해진다 (#102)
  membershipCard: {
    paddingHorizontal: CARD_INSET,
    paddingVertical: 20 - MEMBERSHIP_ROW_PADDING,
    boxShadow: '0px 1px 18px rgba(119, 107, 168, 0.08)',
  },
  membershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20 - CARD_INSET,
    paddingVertical: MEMBERSHIP_ROW_PADDING,
    borderRadius: ROW_RADIUS,
  },
  membershipEmpty: {
    paddingHorizontal: 20 - CARD_INSET,
    paddingVertical: MEMBERSHIP_ROW_PADDING,
  },
  membershipText: { flex: 1 },
  // 행 사이는 지금처럼 13 · 선 · 13 이고 선은 카드 안 20 에서 시작한다
  divider: {
    height: 1,
    marginHorizontal: 20 - CARD_INSET,
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
    paddingHorizontal: CARD_INSET,
    paddingVertical: 8,
    boxShadow: '0px 1px 18px rgba(119, 107, 168, 0.08)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: SETTING_ROW_HEIGHT,
    paddingHorizontal: 20 - CARD_INSET,
    borderRadius: ROW_RADIUS,
  },
});
