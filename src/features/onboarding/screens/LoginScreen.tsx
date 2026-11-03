import {
  Pressable,
  StyleSheet,
  View,
  type PressableStateCallbackType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import {
  colors,
  Icon,
  Text,
  withOpacity,
  type IconName,
} from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { loginIllustrationXml, orbitLogoXml } from '../components/loginArt';
import type { LoginMethod } from '../model';

// Figma 로그인 (3284:21451), 로그인-최근 로그인 (3551:18597). 보라 배경 위 문구·로고·일러스트, 아래 흰 시트에 시작 버튼.
// 실제 로그인 전이라 버튼을 누르면 더미 계정으로 로그인한다 (바깥이 정한다).
// 보라 배경의 흰 상태 표시줄 글자는 화면이 보이는 동안만 쓰도록 바깥(LoginRoute)이 맡는다
const RECENT_LOGIN = '최근에 로그인 했어요!';

const buttons: Record<
  LoginMethod,
  { label: string; icon: IconName; background: string; labelColor: string }
> = {
  KAKAO: {
    label: '카카오로 시작하기',
    icon: 'kakao',
    background: colors.kakao,
    labelColor: colors.black,
  },
  APPLE: {
    label: 'Apple로 시작하기',
    icon: 'apple',
    background: colors.primary,
    labelColor: colors.white[100],
  },
};

export function LoginScreen({
  methods,
  recentMethod,
  onLogin,
}: {
  /** 이 기기에서 보일 로그인 방식 (Apple 은 iOS 만) */
  methods: readonly LoginMethod[];
  /** 마지막으로 로그인한 방식. 그 버튼 위에만 말풍선을 띄운다 */
  recentMethod: LoginMethod | null;
  onLogin: (method: LoginMethod) => void;
}) {
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.top}>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel="오늘의 현장, 한눈에. Orbit"
          style={[readableColumn, styles.headline]}
        >
          <Text variant="Body/XL/SemiBold" color={colors.white[100]}>
            {'오늘의 현장,\n한눈에.'}
          </Text>
          {/* Figma 글상자(130×67) 안에서 글자 모양이 놓인 자리 */}
          <View style={styles.logoBox}>
            <SvgXml
              xml={orbitLogoXml}
              width={LOGO_WIDTH}
              height={LOGO_HEIGHT}
            />
          </View>
        </View>
        {/* 화면이 낮으면 일러스트가 비율을 지킨 채 작아진다 */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[readableColumn, styles.art]}
        >
          <View style={styles.illustration}>
            <SvgXml
              xml={loginIllustrationXml}
              width="100%"
              height="100%"
              preserveAspectRatio="xMaxYMax meet"
            />
          </View>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={SHEET_EDGES} style={styles.sheet}>
        <View style={[readableColumn, styles.sheetBody]}>
          <View style={styles.buttons}>
            {methods.map(method => (
              <LoginButton
                key={method}
                method={method}
                recent={method === recentMethod}
                onPress={() => onLogin(method)}
              />
            ))}
          </View>
          <Text
            variant="Caption/S/Medium"
            color={colors.gray[600]}
            style={styles.caption}
          >
            신규 사용자도 카카오로 가입할 수 있습니다
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function LoginButton({
  method,
  recent,
  onPress,
}: {
  method: LoginMethod;
  recent: boolean;
  onPress: () => void;
}) {
  const spec = buttons[method];
  const pressableStyle = ({ pressed }: PressableStateCallbackType) => [
    styles.button,
    { backgroundColor: spec.background },
    pressed && styles.pressed,
  ];
  return (
    <View testID={`login-${method}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={recent ? RECENT_LOGIN : undefined}
        onPress={onPress}
        style={pressableStyle}
      >
        <Icon name={spec.icon} />
        <Text
          variant="Body/XS/Medium"
          color={spec.labelColor}
          numberOfLines={1}
        >
          {spec.label}
        </Text>
      </Pressable>
      {/* 장식이라 스크린리더는 버튼 힌트로 읽는다. 버튼 누르기를 막지 않는다 */}
      {recent && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.bubble}
        >
          <View style={styles.bubbleBody}>
            <Text variant="Caption/S/Medium" color={colors.white[100]}>
              {RECENT_LOGIN}
            </Text>
          </View>
          <View style={styles.bubbleTail} />
        </View>
      )}
    </View>
  );
}

const LOGO_WIDTH = 125;
const LOGO_HEIGHT = 37;
// Figma 말풍선 채움: #1C1B2A 94%
const BUBBLE_COLOR = withOpacity(colors.primary, 0.94);
const TAIL_WIDTH = 14;
const TAIL_HEIGHT = 6;
// 홈 인디케이터가 없는 기기도 Figma 처럼 아래를 띄운다
const SHEET_EDGES = { bottom: 'maximum' } as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.secondary },
  top: { flex: 1 },
  // 상태 표시줄 아래 54, 문구와 로고 사이 4 (Figma 3284:21451)
  headline: { gap: 4, paddingHorizontal: 24, marginTop: 54 },
  // 글상자 130×67 에서 글자 모양은 위 14, 왼쪽 3 에 놓인다 (캔버스에서 잰 값)
  logoBox: { width: 130, height: 67, paddingTop: 14, paddingLeft: 3 },
  // 일러스트는 오른쪽 7, 시트 위 57 에 놓인다 (Figma 왼쪽 157·위 306, 229×213)
  art: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingRight: 7,
    paddingBottom: 57,
  },
  illustration: { width: 229, height: 213, flexShrink: 1 },
  sheet: {
    paddingTop: 24,
    paddingBottom: 34,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.white[100],
  },
  sheetBody: { paddingHorizontal: 24 },
  buttons: { gap: 12 },
  // CTA L 과 같은 치수 (높이 56, 모서리 12, 여백 10·16, 간격 12)
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  pressed: { opacity: 0.8 },
  // 버튼 위 77 아래에 있다 (Figma 시트 안 위치 225)
  caption: { marginTop: 77, textAlign: 'center' },
  // 버튼 오른쪽 끝에서 8 안쪽, 꼬리 끝이 버튼 위 6 에 온다 (Figma 3551:18597)
  bubble: {
    position: 'absolute',
    right: 8,
    bottom: '100%',
    marginBottom: 6,
    alignItems: 'center',
  },
  bubbleBody: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: BUBBLE_COLOR,
  },
  bubbleTail: {
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_WIDTH / 2,
    borderRightWidth: TAIL_WIDTH / 2,
    borderTopWidth: TAIL_HEIGHT,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: BUBBLE_COLOR,
  },
});
