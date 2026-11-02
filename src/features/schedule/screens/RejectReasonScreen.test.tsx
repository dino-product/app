import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Animated,
  Keyboard,
  NativeModules,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import { hideKeyboard, showKeyboard } from '../../../../jest/keyboard';
import { colors } from '../../../shared/design-system';
import { RejectReasonScreen } from './RejectReasonScreen';

const renderReject = (
  overrides: Partial<Parameters<typeof RejectReasonScreen>[0]> = {},
) =>
  render(
    <RejectReasonScreen
      onBack={jest.fn()}
      onSubmit={jest.fn()}
      {...overrides}
    />,
  );

const option = (name: string) => screen.getByRole('radio', { name });
const otherOption = () => option('기타 (직접 입력)');
const otherInput = () => screen.queryByLabelText('기타 거절 사유 입력');
// 접히는 동안에는 스크린리더에서 숨기므로 숨긴 것까지 찾아야 남아 있는지 안다
const otherInputEvenHidden = () =>
  screen.queryByLabelText('기타 거절 사유 입력', {
    includeHiddenElements: true,
  });
const submitButton = () => screen.getByRole('button', { name: '거절 제출' });

// jest 프리셋의 네이티브 애니메이션 목은 16ms 뒤에 저절로 끝난다.
// 펼치는 '도중'을 재현하려고 끝내는 시점을 테스트가 정한다 (멈춘 애니메이션은 JS 가 먼저 finished: false 로 알린다)
let runningAnimations: Array<(result: { finished: boolean }) => void> = [];
const finishAnimations = () =>
  act(() => {
    runningAnimations.splice(0).forEach(end => end({ finished: true }));
  });

// 프리셋 목은 공유 jest.fn 이라 spyOn 이 같은 목을 돌려주고 restoreAllMocks 로도 돌아가지 않는다.
// 테스트마다 기록을 지운다
const spyScreenReaderFocus = () =>
  jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear();
// 테스트 환경의 TextInput ref 는 목 컴포넌트 인스턴스라 props 로 어떤 입력란인지 확인한다
const otherInputNode = expect.objectContaining({
  props: expect.objectContaining({
    accessibilityLabel: '기타 거절 사유 입력',
  }),
});

describe('RejectReasonScreen', () => {
  beforeEach(() => {
    runningAnimations = [];
    jest
      .spyOn(NativeModules.NativeAnimatedModule, 'startAnimatingNode')
      .mockImplementation((...args: unknown[]) => {
        runningAnimations.push(
          args[3] as (result: { finished: boolean }) => void,
        );
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('처음에는 제목과 선택지 다섯 개만 보이고, 직접 입력란은 없다', async () => {
    await renderReject();

    expect(screen.getByRole('header', { name: '거절 사유' })).toBeOnTheScreen();
    expect(screen.getByText('작업을 거절할까요?')).toBeOnTheScreen();
    expect(
      screen.getAllByRole('radio').map(radio => radio.props.accessibilityLabel),
    ).toEqual([
      '일정이 맞지 않습니다',
      '이미 다른 작업이 있습니다',
      '작업 위치가 너무 멉니다',
      '작업 내용이 맞지 않습니다',
      '기타 (직접 입력)',
    ]);
    expect(
      screen.queryByText('기타 사유를 직접 입력해 주세요', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
    expect(otherInputEvenHidden()).toBeNull();
    expect(otherOption()).toBeCollapsed();
  });

  it('사유를 고르기 전에는 거절 제출이 비활성이고, 아무 사유나 고르면 활성이 된다', async () => {
    const onSubmit = jest.fn();
    await renderReject({ onSubmit });

    expect(submitButton()).toBeDisabled();
    await userEvent.press(submitButton());
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.press(option('일정이 맞지 않습니다'));
    expect(submitButton()).toBeEnabled();
  });

  it('사유를 고르면 선택 상태와 강조 테두리가 된다', async () => {
    await renderReject();

    const otherWork = option('이미 다른 작업이 있습니다');
    await userEvent.press(otherWork);

    expect(otherWork).toBeChecked();
    expect(otherWork).toHaveStyle({
      borderColor: colors.secondary,
      backgroundColor: colors.select[1],
    });
  });

  it('기타가 아닌 선택지끼리 바꾸면 입력란은 계속 숨어 있고, 애니메이션도 키보드 내리기도 없다', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    await renderReject();

    await userEvent.press(option('일정이 맞지 않습니다'));
    await userEvent.press(option('작업 위치가 너무 멉니다'));

    expect(otherInputEvenHidden()).toBeNull();
    expect(timing).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('기타를 고르면 직접 입력란이 펼쳐져 포커스를 받고, 다 펼친 뒤 스크린리더 포커스가 입력란으로 간다', async () => {
    const focus = spyScreenReaderFocus();
    await renderReject();

    await userEvent.press(otherOption());

    expect(otherOption()).toBeExpanded();
    expect(
      screen.getByText('기타 사유를 직접 입력해 주세요'),
    ).toBeOnTheScreen();
    const input = otherInput();
    expect(input).toBeOnTheScreen();
    // 나타나자마자 포커스를 받아 키보드가 올라온다
    expect(input).toHaveProp('autoFocus', true);
    // 펼치는 중에는 투명하고 잘려 있어 스크린리더가 건너뛸 수 있다
    expect(focus).not.toHaveBeenCalled();

    await finishAnimations();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(otherInputNode, 'focus');
  });

  it('펼침·접힘은 220ms 로 UI 스레드에서 애니메이션한다', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await renderReject();

    await userEvent.press(otherOption());
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    );

    await finishAnimations();
    await userEvent.press(option('일정이 맞지 않습니다'));
    expect(timing).toHaveBeenCalledTimes(2);
    expect(timing.mock.calls[1][1]).toEqual(
      expect.objectContaining({ toValue: 0, useNativeDriver: true }),
    );
  });

  // 높이는 네이티브 드라이버로 바꿀 수 없어, 잘라 내는 영역은 위로·내용은 같은 만큼 아래로 옮긴다.
  // 내용은 제자리에 있고 보이는 영역만 위에서부터 자란다
  it('펼치기 시작할 때는 내용 높이만큼 잘라 내 보이지 않게 하고, 선택지는 계속 누를 수 있다', async () => {
    await renderReject();

    await userEvent.press(otherOption());
    const content = screen.getByTestId('reject-other-content');
    await fireEvent(content, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 312, height: 170 } },
    });
    // 잰 높이는 다시 그리지 않고 네이티브 값만 바꾼다. 테스트 환경의 스타일에는 다음 렌더에 보인다
    await userEvent.type(otherInput()!, '가');

    const clip = screen.getByTestId('reject-other-clip');
    expect(clip).toHaveStyle({
      overflow: 'hidden',
      transform: [{ translateY: -170 }],
    });
    expect(content).toHaveStyle({
      opacity: 0,
      transform: [{ translateY: 170 }],
    });
    // 위로 옮긴 잘라 내는 영역이 선택지를 덮어도 터치는 선택지로 간다
    expect(clip).toHaveProp('pointerEvents', 'box-none');
  });

  it('기타에서 다른 선택지로 바꾸면 키보드를 내리며 접고, 다시 기타를 고르면 쓰던 내용이 남아 있다', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    await renderReject();

    await userEvent.press(otherOption());
    await finishAnimations();
    await userEvent.type(otherInput()!, '개인 사정');
    expect(dismiss).not.toHaveBeenCalled();

    await userEvent.press(option('일정이 맞지 않습니다'));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(otherOption()).toBeCollapsed();
    // 접히는 동안 화면에는 남지만 스크린리더에서는 바로 숨긴다
    expect(otherInput()).toBeNull();
    expect(otherInputEvenHidden()).toBeOnTheScreen();

    await finishAnimations();
    expect(otherInputEvenHidden()).toBeNull();

    await userEvent.press(otherOption());
    expect(otherInput()).toHaveDisplayValue('개인 사정');
  });

  it('펼친 채로 기타를 다시 누르면 아무것도 하지 않는다', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    const focus = spyScreenReaderFocus();
    await renderReject();

    await userEvent.press(otherOption());
    await finishAnimations();
    await userEvent.press(otherOption());
    await finishAnimations();

    expect(timing).toHaveBeenCalledTimes(1);
    expect(dismiss).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('펼치거나 접히는 중에 눌러도 막히지 않고 마지막 선택대로 끝나며, 다 펼치기 전에는 스크린리더 포커스를 옮기지 않는다', async () => {
    const focus = spyScreenReaderFocus();
    const keyboardFocus = jest.spyOn(TextInput.prototype, 'focus').mockClear();
    await renderReject();

    await userEvent.press(otherOption());
    await userEvent.press(option('일정이 맞지 않습니다'));
    // 접히는 중에 다시 펼치면 남아 있던 입력란을 그대로 쓰므로 직접 포커스한다
    await userEvent.press(otherOption());
    expect(keyboardFocus).toHaveBeenCalledTimes(1);
    expect(otherInput()).toBeOnTheScreen();

    await userEvent.press(option('이미 다른 작업이 있습니다'));
    await finishAnimations();

    expect(option('이미 다른 작업이 있습니다')).toBeChecked();
    expect(otherInputEvenHidden()).toBeNull();
    expect(focus).not.toHaveBeenCalled();
  });

  it('다 펼치고 접은 뒤에는 처음보다 타이머가 늘지 않는다', async () => {
    jest.useFakeTimers();
    // 한 번짜리 타이머는 돌려 보내고 남는 것만 센다. 테스트 환경의 act 도 하나를 계속 걸어 두므로 처음과 비교한다
    const settledTimerCount = async () => {
      await act(() => jest.runOnlyPendingTimers());
      return jest.getTimerCount();
    };
    try {
      await renderReject();
      const before = await settledTimerCount();

      await userEvent.press(otherOption());
      await finishAnimations();
      await userEvent.press(option('일정이 맞지 않습니다'));
      await finishAnimations();

      expect(await settledTimerCount()).toBe(before);
    } finally {
      jest.useRealTimers();
    }
  });

  it('기타에서 쓰다가 다른 선택지로 바꿔 제출하면 마지막으로 고른 사유로 제출한다', async () => {
    const onSubmit = jest.fn();
    await renderReject({ onSubmit });

    await userEvent.press(otherOption());
    await userEvent.type(otherInput()!, '개인 사정');
    await userEvent.press(option('작업 위치가 너무 멉니다'));
    await userEvent.press(submitButton());

    expect(onSubmit).toHaveBeenCalledWith('작업 위치가 너무 멉니다');
  });

  it('기타를 고르고 내용을 비우면 안내하고, 채우면 그 내용으로 제출한다', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockClear();
    const onSubmit = jest.fn();
    await renderReject({ onSubmit });

    await userEvent.press(otherOption());
    // 비어 있어도 버튼은 활성이고, 누르면 무엇이 빠졌는지 알려 준다
    expect(submitButton()).toBeEnabled();
    await userEvent.press(submitButton());
    expect(screen.getByText('기타 사유를 입력해 주세요.')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('기타 사유를 입력해 주세요.');
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(otherInput()!, '개인 사정');
    expect(screen.queryByText('기타 사유를 입력해 주세요.')).toBeNull();
    await userEvent.press(submitButton());

    expect(onSubmit).toHaveBeenCalledWith('개인 사정');
  });

  it('선택지 사유로 제출하고, 취소·뒤로는 onBack 을 부른다', async () => {
    const onSubmit = jest.fn();
    const onBack = jest.fn();
    await renderReject({ onSubmit, onBack });

    await userEvent.press(option('작업 위치가 너무 멉니다'));
    await userEvent.press(submitButton());
    await userEvent.press(screen.getByRole('button', { name: '취소' }));
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onSubmit).toHaveBeenCalledWith('작업 위치가 너무 멉니다');
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  describe('동작 줄이기', () => {
    const reduceMotion = async () => {
      jest
        .mocked(AccessibilityInfo.isReduceMotionEnabled)
        .mockResolvedValueOnce(true);
      await renderReject();
      // 설정은 비동기로 읽는다
      await act(async () => {});
    };

    it('켜져 있으면 애니메이션 없이 바로 다 보이고, 스크린리더 포커스도 다음 프레임에 옮긴다', async () => {
      const timing = jest.spyOn(Animated, 'timing');
      const focus = spyScreenReaderFocus();
      await reduceMotion();

      await userEvent.press(otherOption());

      expect(timing).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ toValue: 1, duration: 0 }),
      );
      expect(screen.getByTestId('reject-other-clip')).toHaveStyle({
        transform: [{ translateY: 0 }],
      });
      expect(screen.getByTestId('reject-other-content')).toHaveStyle({
        opacity: 1,
        transform: [{ translateY: 0 }],
      });

      await finishAnimations();
      expect(focus).toHaveBeenCalledWith(otherInputNode, 'focus');
    });

    it('켜져 있으면 접을 때도 바로 감춘다', async () => {
      await reduceMotion();

      await userEvent.press(otherOption());
      await finishAnimations();
      await userEvent.press(option('일정이 맞지 않습니다'));

      expect(
        screen.getByTestId('reject-other-content', {
          includeHiddenElements: true,
        }),
      ).toHaveStyle({ opacity: 0 });
      await finishAnimations();
      expect(otherInputEvenHidden()).toBeNull();
    });
  });

  describe('키보드', () => {
    // Platform.OS 만 바꾼다. render·effect 안에서 읽는 Platform.OS 에만 반영된다
    // (jest 의 Platform.select·모듈 상수는 늘 ios)
    const renderOn = async (os: 'ios' | 'android') => {
      jest.replaceProperty(Platform, 'OS', os);
      await renderReject();
      return screen.getByTestId('reject-reason-scroll');
    };

    afterEach(async () => {
      // Keyboard 모듈은 마지막 키보드 상태를 들고 있어 다음 테스트로 넘어가지 않게 내린다
      await hideKeyboard();
      jest.restoreAllMocks();
    });

    it('iOS 는 내용을 끌어내리면 키보드가 따라 내려간다', async () => {
      const scroll = await renderOn('ios');

      expect(scroll).toHaveProp('keyboardDismissMode', 'interactive');
      expect(scroll).toHaveProp('keyboardShouldPersistTaps', 'handled');
      expect(scroll).toHaveProp('automaticallyAdjustKeyboardInsets', true);
    });

    it('Android 는 interactive 가 없어 끌기 시작하면 내린다', async () => {
      const scroll = await renderOn('android');

      expect(scroll).toHaveProp('keyboardDismissMode', 'on-drag');
      expect(scroll).toHaveProp('keyboardShouldPersistTaps', 'handled');
    });

    // 스크롤 영역이 화면 위 80 ~ 700 이고 키보드 윗변이 500 이면 200 을 가린다
    const layoutBody = async () => {
      const body = screen.getByTestId('reject-reason-body');
      await fireEvent(body, 'layout', {
        nativeEvent: { layout: { x: 0, y: 80, width: 360, height: 620 } },
      });
      return body;
    };

    it('Android 는 키보드에 가린 만큼 스크롤 영역을 줄여, 펼친 사유 입력칸이 키보드 위에 남는다', async () => {
      await renderOn('android');
      const body = await layoutBody();

      // 기타를 고르면 입력란이 펼쳐지며 포커스를 받아 키보드가 올라온다
      await userEvent.press(otherOption());
      await showKeyboard(500);
      // 내용 여백이 아니라 스크롤 영역을 줄여야 Android ScrollView 가 포커스된 칸을 보이게 스크롤한다
      expect(body).toHaveStyle({ paddingBottom: 200 });
      expect(
        within(within(body).getByTestId('reject-reason-scroll')).getByLabelText(
          '기타 거절 사유 입력',
        ),
      ).toBeOnTheScreen();

      await hideKeyboard();
      expect(body).toHaveStyle({ paddingBottom: 0 });
    });

    // Android ScrollView 는 크기가 줄 때 보이던 입력칸만 따라간다. 펼친 입력란이 처음부터
    // 화면 아래에 있으면 키보드 뒤에 남으므로, 포커스를 받으면 맨 끝(섹션)까지 내린다
    it('Android 는 펼친 입력란이 포커스를 받으면 끝까지 스크롤한다', async () => {
      const scrollToEnd = jest
        .spyOn(ScrollView.prototype, 'scrollToEnd')
        .mockClear();
      await renderOn('android');

      await userEvent.press(otherOption());
      await fireEvent(otherInput()!, 'focus');

      expect(scrollToEnd).toHaveBeenCalledTimes(1);
    });

    it('iOS 는 키보드가 떠도 스크롤 영역을 줄이지 않고, 포커스된 입력칸 스크롤은 automaticallyAdjustKeyboardInsets 에 맡긴다', async () => {
      const scrollToEnd = jest
        .spyOn(ScrollView.prototype, 'scrollToEnd')
        .mockClear();
      await renderOn('ios');
      const body = await layoutBody();

      await userEvent.press(otherOption());
      await fireEvent(otherInput()!, 'focus');
      await showKeyboard(500);

      expect(body).toHaveStyle({ paddingBottom: 0 });
      expect(scrollToEnd).not.toHaveBeenCalled();
    });
  });
});
