import { useEffect, useRef, useState, type Ref } from 'react';
import {
  AccessibilityInfo,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  CTA,
  Icon,
  Text,
  typography,
} from '../../../../shared/design-system';
import { KeyboardAvoidingArea } from '../../../../shared/keyboard/KeyboardAvoidingArea';
import { readableColumn } from '../../../../shared/layout/readableColumn';
import { SubScreenHeader } from '../../components/SubScreenHeader';
import { flowLayouts } from '../components/flowLayouts';
import { NoticeModal, type Notice } from '../components/NoticeModal';
import type { JoinFlow, LookupOutcome, Organization } from '../model';

// Figma 회사찾기 (3235:17242 / 3255:18315 / 3255:18375, 유효하지 않은 코드 3255:18149, 이미 참여 3159:13440).
// 온보딩(#85)은 회사 찾기 (3205:6299 / 3278:23116), 유효하지 않은 코드 (3257:10685) 이고 머리 제목이 늘 '회사 참여' 다.
// QR 코드 인식은 카메라 모듈·권한 문구가 필요해 별도 티켓이라 비활성이다
const intro = {
  title: '회사 찾기',
  description: '회사 코드·참여 링크·QR로 회사를 찾을 수 있습니다.',
};
const invalidIntro = {
  title: '유효하지 않은 회사 코드입니다',
  description: '회사에서 코드를 변경해\n이전 참여 경로를 사용할 수 없습니다.',
};

const noticeFor = (
  outcome: Extract<LookupOutcome, { kind: 'alreadyMember' | 'pending' }>,
): Notice =>
  outcome.kind === 'alreadyMember'
    ? {
        title: '이미 참여 중인 회사예요',
        message: `${outcome.organization.organizationName}에 이미 소속되어 있어\n참여 요청을 다시 보낼 수 없습니다.`,
      }
    : // Figma 에 없는 경우라 문구는 기본안이다
      {
        title: '이미 참여를 요청한 회사예요',
        message: `${outcome.organization.organizationName}에 보낸 참여 요청이\n승인을 기다리고 있어요.`,
      };

export function OrgJoinScreen({
  flow = 'my',
  onBack,
  lookup,
  onFound,
  onPending,
  titleRef,
}: {
  flow?: JoinFlow;
  onBack: () => void;
  /** 입력한 코드로 회사를 찾는다 (GET /api/v1/organizations/lookup) */
  lookup: (code: string) => Promise<LookupOutcome>;
  onFound: (organization: Organization, code: string) => void;
  /** 승인 대기 중인 요청이 있는 회사일 때. 주면 알림 대신 부른다 (온보딩은 그 요청의 승인 대기로 간다) */
  onPending?: (organization: Organization) => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [checking, setChecking] = useState(false);
  // 다시 그리기 전에 연달아 눌러도 한 번만 찾는다
  const checkingRef = useRef(false);
  // 찾는 동안 화면을 떠났으면 늦게 온 결과를 버린다
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const trimmed = code.trim();
  const shownIntro = invalid ? invalidIntro : intro;

  const check = async () => {
    if (checkingRef.current || trimmed === '') {
      return;
    }
    checkingRef.current = true;
    setChecking(true);
    try {
      const outcome = await lookup(trimmed);
      if (!mounted.current) {
        return;
      }
      setInvalid(outcome.kind === 'invalid');
      if (outcome.kind === 'found') {
        onFound(outcome.organization, trimmed);
      } else if (outcome.kind === 'pending' && onPending) {
        onPending(outcome.organization);
      } else if (outcome.kind === 'invalid') {
        // accessibilityLiveRegion 은 Android 만 읽으므로 iOS 만 따로 알린다 (Android 에서 알리면 두 번 읽는다)
        if (Platform.OS === 'ios') {
          AccessibilityInfo.announceForAccessibility(
            `${invalidIntro.title}. ${invalidIntro.description.replace(
              '\n',
              ' ',
            )}`,
          );
        }
      } else {
        setNotice(noticeFor(outcome));
      }
    } catch {
      // 네트워크 오류 등. Figma 에 없는 경우라 문구는 기본안이다
      if (mounted.current) {
        setNotice({
          title: '회사를 확인하지 못했어요',
          message: '잠시 후 다시 시도해 주세요.',
        });
      }
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  };

  return (
    <SafeAreaView
      edges={flowLayouts[flow].edges}
      style={flowLayouts[flow].screen}
    >
      {/* 마이에서는 유효하지 않은 코드면 Figma 처럼 제목이 '회사 참여' 로 바뀐다 (디자인 확인 항목) */}
      <SubScreenHeader
        title={flow === 'onboarding' || invalid ? '회사 참여' : '조직 참여하기'}
        onBack={onBack}
        titleRef={titleRef}
      />

      <KeyboardAvoidingArea testID="org-join-body">
        <ScrollView
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[readableColumn, styles.content]}
        >
          <View accessibilityLiveRegion="polite" style={styles.intro}>
            <Text accessibilityRole="header" variant="Body/XL/Bold">
              {shownIntro.title}
            </Text>
            <Text variant="Caption/M/Medium" color={colors.gray[600]}>
              {shownIntro.description}
            </Text>
          </View>

          <View style={styles.field}>
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              variant="Caption/M/SemiBold"
              color={colors.gray[800]}
            >
              회사 코드 입력
            </Text>
            <View style={styles.codeRow}>
              <TextInput
                accessibilityLabel="회사 코드 입력"
                value={code}
                onChangeText={setCode}
                placeholder="회사 코드 입력"
                placeholderTextColor={colors.gray[400]}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={check}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={[styles.input, focused && styles.inputFocused]}
              />
              <CTA
                label="회사 확인"
                onPress={check}
                disabled={trimmed === '' || checking}
                style={styles.checkButton}
              />
            </View>
            <Text variant="Caption/S/Medium" color={colors.gray[600]}>
              회사 관리자에게 받은 코드를 입력해 주세요.
            </Text>
          </View>

          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.orRow}
          >
            <View style={styles.orLine} />
            <Text variant="Caption/M/Medium" color={colors.gray[400]}>
              또는
            </Text>
            <View style={styles.orLine} />
          </View>

          <CTA
            label="QR 코드 인식"
            icon={<Icon name="qr" color={colors.white[100]} />}
            disabled
            onPress={noop}
          />
        </ScrollView>
      </KeyboardAvoidingArea>

      <NoticeModal notice={notice} onClose={() => setNotice(null)} />
    </SafeAreaView>
  );
}

const noop = () => {};

const styles = StyleSheet.create({
  content: {
    gap: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  intro: { gap: 8 },
  field: { gap: 10 },
  codeRow: { flexDirection: 'row', gap: 12 },
  input: {
    ...typography['Body/XS/Medium'],
    flex: 1,
    minHeight: 56,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
    color: colors.gray[900],
  },
  inputFocused: { borderColor: colors.secondary },
  checkButton: { paddingHorizontal: 20 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.gray[100] },
});
