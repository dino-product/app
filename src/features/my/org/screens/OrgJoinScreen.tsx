import { useRef, useState, type Ref } from 'react';
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
  MIN_TOUCH_TARGET,
  typography,
  withOpacity,
} from '../../../../shared/design-system';
import { KeyboardAvoidingArea } from '../../../../shared/keyboard/KeyboardAvoidingArea';
import {
  requestCameraPermission,
  showCameraPermissionGuide,
} from '../../../../shared/native/cameraPermission';
import { readableColumn } from '../../../../shared/layout/readableColumn';
import { noOverscroll } from '../../../../shared/layout/noOverscroll';
import { SubScreenHeader } from '../../components/SubScreenHeader';
import { flowLayouts } from '../components/flowLayouts';
import { NoticeModal } from '../components/NoticeModal';
import {
  isCompanyCodeComplete,
  sanitizeCompanyCodeInput,
  type JoinFlow,
} from '../model';
import { invalidCodeNotice } from '../notices';
import { useCompanyCheck, type CompanyCheckHandlers } from '../useCompanyCheck';

// Figma 회사찾기 (3235:17242 / 3255:18315 / 3255:18375, 유효하지 않은 코드 3255:18149, 이미 참여 3159:13440).
// 온보딩(#85)은 회사 찾기 (3205:6299 / 3278:23116), 유효하지 않은 코드 (3257:10685) 이고 머리 제목이 늘 '회사 참여' 다.
// 회사 확인은 서버(GET /api/v1/organizations/lookup)에 묻는다 (#116). 실패 안내는 Figma 에 없어 기본안이다 (notices).
// QR 코드 인식(#108)은 카메라 권한을 받은 뒤 QR 스캔 화면(QrScanScreen)을 연다. 권한 안내는 Figma 에 없어 시스템 대화상자다
const intro = {
  title: '회사 찾기',
  description: '회사 코드·참여 링크·QR로 회사를 찾을 수 있습니다.',
};
const invalidIntro = {
  title: invalidCodeNotice.title,
  description: invalidCodeNotice.message,
};

export function OrgJoinScreen({
  flow = 'my',
  onBack,
  onFound,
  onPending,
  onAlreadyMember,
  screenFocused = true,
  onScanQr,
  titleRef,
}: CompanyCheckHandlers & {
  flow?: JoinFlow;
  onBack: () => void;
  /** 화면이 보이는지. 아니면(다른 탭으로 옮김) 늦게 온 안내를 다른 화면 위에 띄우지 않고 돌아올 때까지 미룬다 */
  screenFocused?: boolean;
  /** 카메라 권한을 받았다. QR 스캔 화면을 연다 */
  onScanQr: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const { check, checking, notice, closeNotice } = useCompanyCheck({
    onFound,
    onPending,
    onAlreadyMember,
  });
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  // 권한을 묻는 동안 다시 눌러도 한 번만 묻는다
  const askingCamera = useRef(false);

  // 입력은 늘 규칙대로 정리돼 있다 (대문자, 허용 문자, 6자까지). 6자를 채워야 찾는다 (#97)
  const complete = isCompanyCodeComplete(code);
  const shownIntro = invalid ? invalidIntro : intro;
  const look = looks[flow];

  const submit = async () => {
    if (!complete) {
      return;
    }
    const kind = await check(code, 'COMPANY_CODE');
    if (kind === null) {
      // 이미 찾는 중이거나 확인하지 못했다(안내를 띄웠다). 입력은 그대로 두고 다시 누를 수 있다
      return;
    }
    setInvalid(kind === 'invalid');
    if (kind === 'invalid' && Platform.OS === 'ios') {
      // accessibilityLiveRegion 은 Android 만 읽으므로 iOS 만 따로 알린다 (Android 에서 알리면 두 번 읽는다)
      AccessibilityInfo.announceForAccessibility(
        `${invalidIntro.title}. ${invalidIntro.description.replace('\n', ' ')}`,
      );
    }
  };

  // 거부했거나 '다시 묻지 않음'(iOS 는 거부·제한)이면 열지 않고 설정으로 가는 안내를 띄운다
  const scanQr = async () => {
    if (askingCamera.current) {
      return;
    }
    askingCamera.current = true;
    try {
      if (await requestCameraPermission()) {
        onScanQr();
      } else {
        showCameraPermissionGuide(
          'QR 코드를 인식하려면 설정에서 카메라 접근을 허용해 주세요.',
        );
      }
    } finally {
      askingCamera.current = false;
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
          {...noOverscroll}
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[readableColumn, look.styles.content]}
        >
          <View accessibilityLiveRegion="polite" style={look.styles.intro}>
            <Text accessibilityRole="header" variant={look.title}>
              {shownIntro.title}
            </Text>
            <Text variant={look.description} color={colors.gray[600]}>
              {shownIntro.description}
            </Text>
          </View>

          <View style={look.styles.field}>
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              variant={look.label}
              color={look.labelColor}
            >
              회사 코드 입력
            </Text>
            <View style={look.styles.inputGroup}>
              <View style={styles.codeRow}>
                <TextInput
                  accessibilityLabel="회사 코드 입력"
                  value={code}
                  // 허용 밖 문자는 들어가지 않는다. 붙여넣기는 정리한 뒤 6자로 자르므로 maxLength 는 두지 않는다
                  onChangeText={text =>
                    setCode(previous =>
                      sanitizeCompanyCodeInput(text, previous),
                    )
                  }
                  placeholder="회사 코드 입력"
                  placeholderTextColor={look.placeholderColor}
                  // 영문이 섞여 숫자 키패드는 쓰지 않는다. iOS 는 영문·숫자 자판, Android 는 한글 IME·추천이 뜨지 않는 자판
                  keyboardType={
                    Platform.OS === 'ios' ? 'ascii-capable' : 'visible-password'
                  }
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoComplete="off"
                  returnKeyType="done"
                  onSubmitEditing={submit}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  style={[
                    styles.input,
                    look.styles.input,
                    focused && styles.inputFocused,
                  ]}
                />
                <CTA
                  label="회사 확인"
                  size={look.checkSize}
                  onPress={submit}
                  disabled={!complete || checking}
                  style={look.styles.checkButton}
                />
              </View>
              <Text variant="Caption/S/Medium" color={look.hintColor}>
                회사 관리자에게 받은 코드를 입력해 주세요.
              </Text>
            </View>
          </View>

          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.orRow}
          >
            <View style={look.styles.orLine} />
            <Text variant={look.or} color={colors.gray[400]}>
              또는
            </Text>
            <View style={look.styles.orLine} />
          </View>

          <CTA
            label="QR 코드 인식"
            icon={<Icon name="qr" color={colors.white[100]} />}
            onPress={scanQr}
          />
        </ScrollView>
      </KeyboardAvoidingArea>

      <NoticeModal
        notice={screenFocused ? notice : null}
        onClose={closeNotice}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  codeRow: { flexDirection: 'row' },
  input: {
    ...typography['Body/XS/Medium'],
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.gray[900],
  },
  inputFocused: { borderColor: colors.secondary },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});

// 마이(3235:17242 외)와 온보딩(3205:6299 / 3278:23116)의 Figma 값이 자리마다 다르다
const myStyles = StyleSheet.create({
  content: {
    gap: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  intro: { gap: 8 },
  field: { gap: 10 },
  inputGroup: { gap: 10 },
  input: {
    minHeight: 56,
    marginRight: 12,
    paddingHorizontal: 20,
    borderColor: colors.gray[200],
  },
  checkButton: { paddingHorizontal: 20 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.gray[100] },
});

const onboardingStyles = StyleSheet.create({
  // 머리 아래 22, 칸 사이 24 (Figma 위치 132)
  content: {
    gap: 24,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 24,
  },
  intro: { gap: 6 },
  field: { gap: 8 },
  inputGroup: { gap: 12 },
  // 입력칸 46, 테두리 Gray100. 버튼(CTA M)은 393 폭에서 102 다.
  // 입력칸은 hitSlop 으로 넓힐 수 없어 Android 는 최소 터치 영역(48)까지 키운다
  input: {
    minHeight: Math.max(46, MIN_TOUCH_TARGET),
    marginRight: 10,
    paddingHorizontal: 16,
    borderColor: colors.gray[100],
  },
  checkButton: { minWidth: 102 },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: withOpacity(colors.gray[400], 0.3),
  },
});

const looks = {
  my: {
    styles: myStyles,
    title: 'Body/XL/Bold',
    description: 'Caption/M/Medium',
    label: 'Caption/M/SemiBold',
    labelColor: colors.gray[800],
    placeholderColor: colors.gray[400],
    checkSize: 'L',
    hintColor: colors.gray[600],
    or: 'Caption/M/Medium',
  },
  onboarding: {
    styles: onboardingStyles,
    title: 'Body/L/Bold',
    description: 'Body/XS/Medium',
    label: 'Caption/M/Medium',
    labelColor: colors.gray[700],
    placeholderColor: colors.gray[500],
    checkSize: 'M',
    hintColor: colors.libraryGray[500],
    or: 'Caption/M/Regular',
  },
} as const satisfies Record<JoinFlow, unknown>;
