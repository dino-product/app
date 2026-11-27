import { render, renderHook, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ParticipationRequestGate } from '../../app/navigation/orgRoutes';
import { WorkDetailStatusScreen } from '../../features/work/screens/WorkDetailStatusScreen';
import {
  blockedScreens,
  refreshableScreens,
  renderAppScreen,
} from '../testing/appScreens';
import {
  FIGMA_STATUS_BAR_HEIGHT,
  MIN_SCREEN_TOP,
  minScreenTop,
  ScreenSafeAreaView,
  screenTopOf,
  useScreenTop,
} from './ScreenSafeAreaView';

// 화면 위 여백 (#236). iPhone 은 다이내믹 아일랜드 때문에 위 안전 영역이 59(Figma iPhone 16 상태 표시줄 60)인데
// Android 는 상태 표시줄(24dp 안팎)만 비워 머리가 위로 붙는다. Android 는 상태 표시줄과 60 중 큰 값을 비운다.
// 테스트는 iOS 로 돌아 MIN_SCREEN_TOP 이 0 이고, Android 값은 운영체제를 넘기거나 Platform.OS 를 바꿔 본다

afterEach(() => {
  jest.restoreAllMocks();
});

const insetsWrapper =
  (top: number) =>
  ({ children }: { children: ReactNode }) =>
    (
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 393, height: 852 },
          insets: { top, bottom: 34, left: 0, right: 0 },
        }}
      >
        {children}
      </SafeAreaProvider>
    );

describe('화면 위 여백', () => {
  it('Android 는 상태 표시줄과 Figma 상태 표시줄 60 중 큰 값이다', () => {
    expect(FIGMA_STATUS_BAR_HEIGHT).toBe(60);
    expect(minScreenTop('android')).toBe(60);
    expect(screenTopOf(24, 'android')).toBe(60);
    expect(screenTopOf(48, 'android')).toBe(60);
    // 상태 표시줄이 더 높은 기기는 그 높이를 그대로 쓴다
    expect(screenTopOf(72, 'android')).toBe(72);
  });

  it('iOS 는 위 안전 영역 그대로다', () => {
    expect(minScreenTop('ios')).toBe(0);
    expect(screenTopOf(59, 'ios')).toBe(59);
    expect(screenTopOf(20, 'ios')).toBe(20);
    expect(MIN_SCREEN_TOP).toBe(0);
  });

  it('useScreenTop 은 기기의 위 안전 영역에서 낸다', async () => {
    const { result } = await renderHook(() => useScreenTop(), {
      wrapper: insetsWrapper(47),
    });

    expect(result.current).toBe(47);
  });

  it('Android 의 useScreenTop 은 상태 표시줄 24 여도 60 이다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result } = await renderHook(() => useScreenTop(), {
      wrapper: insetsWrapper(24),
    });

    expect(result.current).toBe(60);
  });
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  standalone: { paddingBottom: 32 },
});

describe('ScreenSafeAreaView', () => {
  // top: 'maximum' 은 위 안전 영역과 style 의 paddingTop 중 큰 값을 패딩으로 둔다 (react-native-safe-area-context)
  it('위는 안전 영역과 최솟값 중 큰 값만큼 띄우고, 받은 스타일은 그대로 둔다', async () => {
    await render(<ScreenSafeAreaView style={styles.screen} />);

    expect(screen.root?.props.edges).toEqual({
      top: 'maximum',
      bottom: 'off',
      left: 'off',
      right: 'off',
    });
    expect(screen.root).toHaveStyle({
      paddingTop: MIN_SCREEN_TOP,
      flex: 1,
      backgroundColor: '#FFFFFF',
    });
  });

  it('bottom 이면 아래도 홈 인디케이터와 paddingBottom 중 큰 값만큼 띄운다 (탭 바 없이 여는 화면)', async () => {
    await render(<ScreenSafeAreaView bottom style={styles.standalone} />);

    expect(screen.root?.props.edges).toEqual({
      top: 'maximum',
      bottom: 'maximum',
      left: 'off',
      right: 'off',
    });
    expect(screen.root).toHaveStyle({
      paddingTop: MIN_SCREEN_TOP,
      paddingBottom: 32,
    });
  });

  // 틀이 그릴 때 운영체제를 본다. Android 는 paddingTop 60 이라 top: 'maximum' 이 상태 표시줄과 60 중 큰 값을 둔다
  it('Android 에서는 틀의 paddingTop 이 60 이다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await render(<ScreenSafeAreaView bottom style={styles.standalone} />);

    expect(screen.root?.props.edges).toEqual(
      expect.objectContaining({ top: 'maximum', bottom: 'maximum' }),
    );
    expect(screen.root).toHaveStyle({ paddingTop: 60, paddingBottom: 32 });
  });
});

const noop = () => {};

// 오버스크롤 화면 목록 밖의 틀: 작업 상세를 받는 동안의 화면, 참여 요청을 받는 동안의 화면 (#237 리뷰)
const otherFrames: [string, ReactElement][] = [
  [
    '작업 상세 받는 중',
    <WorkDetailStatusScreen state={{ status: 'loading' }} onBack={noop} />,
  ],
  [
    '참여 요청 받는 중',
    <ParticipationRequestGate
      requestId="request-1"
      title="참여 요청을 보냈어요"
      onBack={noop}
      onMissing={noop}
    >
      {() => <></>}
    </ParticipationRequestGate>,
  ],
];

describe('앱 화면 틀', () => {
  it.each([...blockedScreens, ...refreshableScreens, ...otherFrames])(
    '%s: 위 여백을 화면 틀(ScreenSafeAreaView)로 잡는다',
    async (_, element) => {
      const container = await renderAppScreen(element);
      const [frame] = container.queryAll(
        node => node.props.edges !== undefined,
      );

      expect(frame?.props.edges).toEqual(
        expect.objectContaining({ top: 'maximum' }),
      );
      expect(frame).toHaveStyle({ paddingTop: MIN_SCREEN_TOP });
    },
  );
});
