import { useEffect, useEffectEvent, useRef, useState, type Ref } from 'react';
import {
  AccessibilityInfo,
  Keyboard,
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
  singleLineInputText,
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
  type RequestChannel,
} from '../model';
import { invalidCodeNotice } from '../notices';
import { useCompanyCheck, type CompanyCheckHandlers } from '../useCompanyCheck';

// Figma 회사찾기 (3235:17242 / 3255:18315 / 3255:18375, 유효하지 않은 코드 3255:18149, 이미 참여 51028:17074).
// 온보딩(#85)은 회사 찾기 (3205:6299 / 3278:23116), 유효하지 않은 코드 (3257:10685) 이고 머리 제목이 늘 '회사 참여' 다.
// 회사 확인은 서버(GET /api/v1/organizations/lookup)에 묻는다 (#116). 실패 안내는 Figma 에 없어 기본안이다 (notices).
// QR 코드 인식(#108)은 카메라 권한을 받은 뒤 QR 스캔 화면(QrScanScreen)을 연다. 권한 안내는 Figma 에 없어 시스템 대화상자다.
// QR 스캔 화면은 회사 코드만 읽고 닫힌다. 읽어 온 코드(scannedCode)는 이 화면이 QR 경로로 확인하고, 결과는 카메라가 아니라
// 이 화면 위에 보인다 (#195). 결과 갈래는 회사 코드 입력과 같다: 찾음 → 역할 선택, 이미 참여·승인 대기·확인 실패 → 안내 모달,
// 유효하지 않은 코드 → 모달 없이 제목·설명이 바뀐다 (Figma Spec_회사 참여 요청 플로우: 이전 코드·링크·QR → ⑥ 이전 코드 차단)
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
  scannedCode,
  waitForReturn,
  titleRef,
}: CompanyCheckHandlers & {
  flow?: JoinFlow;
  onBack: () => void;
  /** 화면이 보이는지. 아니면(다른 탭으로 옮김) 늦게 온 안내를 다른 화면 위에 띄우지 않고 돌아올 때까지 미룬다 */
  screenFocused?: boolean;
  /** 카메라 권한을 받았다. QR 스캔 화면을 연다 */
  onScanQr: () => void;
  /**
   * QR 스캔 화면에서 읽어 온 회사 코드. 바뀌어 들어오면 QR 경로로 회사를 확인한다.
   * 바깥은 넘긴 뒤 지운다 (같은 QR 을 다시 읽어 오면 다시 확인하게)
   */
  scannedCode?: string;
  /**
   * 카메라 화면이 닫히며 이 화면이 다시 보이는 전환이 끝나기를 기다린다. 읽어 온 코드의 결과(다음 화면·안내 모달·⑥)는
   * 그 뒤에 보인다 (앱 화면으로 돌아온 뒤 결과). 확인 요청은 기다리지 않고 먼저 보낸다
   */
  waitForReturn?: () => Promise<void>;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  const [invalid, setInvalid] = useState(false);
  const { check, checking, isChecking, notice, closeNotice } = useCompanyCheck({
    onFound,
    onPending,
    onAlreadyMember,
    // 바깥 처리(온보딩 이미 참여 → 신청 현황 받기)를 기다리는 동안 옛 안내가 남지 않게 결과가 오면 바로 맞춘다
    onChecked: kind => setInvalid(kind === 'invalid'),
  });
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  // 권한을 묻는 동안 다시 눌러도 한 번만 묻는다
  const askingCamera = useRef(false);
  // 확인하는 동안 읽어 온 QR 코드. 버리지 않고 그 확인이 끝나면 이어서 확인한다
  const pendingScan = useRef<string | null>(null);

  // 입력은 늘 규칙대로 정리돼 있다 (대문자, 허용 문자, 6자까지). 6자를 채워야 찾는다 (#97)
  const complete = isCompanyCodeComplete(code);
  const shownIntro = invalid ? invalidIntro : intro;
  const look = looks[flow];

  // 회사 코드 입력·QR 이 같이 쓴다. 확인하지 못했으면(안내를 띄웠다) 입력은 그대로 두고 다시 확인할 수 있다
  const checkCompany = async (
    companyCode: string,
    requestChannel: RequestChannel,
    options?: { until?: Promise<void> },
  ) => {
    const kind = await check(companyCode, requestChannel, options);
    if (kind === 'invalid' && Platform.OS === 'ios') {
      // accessibilityLiveRegion 은 Android 만 읽으므로 iOS 만 따로 알린다 (Android 에서 알리면 두 번 읽는다)
      AccessibilityInfo.announceForAccessibility(
        `${invalidIntro.title}. ${invalidIntro.description.replace('\n', ' ')}`,
      );
    }
    // 미뤄 둔 QR 코드. 카메라는 이미 닫혀 돌아온 지 오래라 전환 끝을 기다리지 않는다.
    // 이 호출이 확인하지 못하고 돌아왔으면(이미 확인 중) 그 확인이 끝날 때 이어서 한다
    const next = pendingScan.current;
    if (next !== null && !isChecking()) {
      pendingScan.current = null;
      checkCompany(next, 'QR_CODE');
    }
  };

  const submit = () => {
    if (complete) {
      checkCompany(code, 'COMPANY_CODE');
    }
  };

  // 전환 끝을 기다리는 구독은 코드를 받은 지금 건다 (전환이 끝나기 전에).
  // 확인하는 중이면 버리지 않고 미뤄 두며, 그때는 구독을 만들지 않는다
  const checkScanned = useEffectEvent((companyCode: string) => {
    if (isChecking()) {
      pendingScan.current = companyCode;
      return;
    }
    checkCompany(companyCode, 'QR_CODE', { until: waitForReturn?.() });
  });
  useEffect(() => {
    if (scannedCode) {
      checkScanned(scannedCode);
    }
  }, [scannedCode]);

  // 거부했거나 '다시 묻지 않음'(iOS 는 거부·제한)이면 열지 않고 설정으로 가는 안내를 띄운다
  const scanQr = async () => {
    // 입력하던 키보드가 카메라 화면 위에 남지 않게 내린다
    Keyboard.dismiss();
    if (askingCamera.current) {
      return;
    }
    askingCamera.current = true;
    try {
      if (await requestCameraPermission()) {
        // 묻는 사이 회사 확인이 시작됐으면 열지 않는다 (읽어 온 코드가 확인 중이라 바로 확인되지 못한다)
        if (!isChecking()) {
          onScanQr();
        }
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

          {/* 확인하는 동안 카메라를 다시 열면 읽어 온 코드가 확인 중이라 버려진다 */}
          <CTA
            label="QR 코드 인식"
            icon={<Icon name="qr" color={colors.white[100]} />}
            onPress={scanQr}
            disabled={checking}
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
  // 칸 높이(looks 의 minHeight) 세로 가운데에 값을 둔다 (#151)
  input: {
    ...singleLineInputText('Body/XS/Medium'),
    flex: 1,
    borderWidth: 1,
    color: colors.gray[900],
  },
  inputFocused: { borderColor: colors.secondary },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});

// 마이(3235:17242 외)와 온보딩(3205:6299 / 3278:23116)의 Figma 값이 자리마다 다르다
// 마이는 회사찾기 3255:18315 의 본문(3255:18323): 소개·입력·구분선·QR 사이 24, 소개 안 6, 라벨 아래 8, 입력줄 아래 12
const myStyles = StyleSheet.create({
  content: {
    gap: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  intro: { gap: 6 },
  field: { gap: 8 },
  inputGroup: { gap: 12 },
  // 3255:18332: 높이 56, 모서리 14, 테두리 Gray100, 글자는 칸 왼쪽 16 에서 시작한다. 회사 확인과 사이 10
  input: {
    minHeight: 56,
    marginRight: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderColor: colors.gray[100],
  },
  // 3255:18334: 좌우 16(CTA L 기본), 393 폭에서 102
  checkButton: { minWidth: 102 },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: withOpacity(colors.gray[400], 0.3),
  },
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
    borderRadius: 12,
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
    title: 'Body/L/Bold',
    description: 'Body/XS/Medium',
    label: 'Caption/M/Medium',
    labelColor: colors.gray[700],
    placeholderColor: colors.gray[500],
    checkSize: 'L',
    // 라이브러리 Gray500 (#7F7F7F)
    hintColor: colors.libraryGray[500],
    or: 'Caption/M/Regular',
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
