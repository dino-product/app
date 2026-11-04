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
  StyleSheet,
  TextInput,
} from 'react-native';
import { hideKeyboard, showKeyboard } from '../../../../jest/keyboard';
import { colors, typography } from '../../../shared/design-system';
import { haptic } from '../../../shared/haptics';
import { RejectReasonScreen } from './RejectReasonScreen';

jest.mock('../../../shared/haptics', () => ({
  haptic: { success: jest.fn(), warning: jest.fn(), selection: jest.fn() },
}));

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

  it('사유를 고르거나 풀 때 선택 햅틱, 거절이 성공하면 경고 햅틱을 울린다', async () => {
    jest.mocked(haptic.selection).mockClear();
    jest.mocked(haptic.warning).mockClear();
    await renderReject();

    await userEvent.press(option('일정이 맞지 않습니다'));
    await userEvent.press(option('일정이 맞지 않습니다'));
    expect(haptic.selection).toHaveBeenCalledTimes(2);
    expect(haptic.warning).not.toHaveBeenCalled();

    await userEvent.press(option('일정이 맞지 않습니다'));
    await userEvent.press(submitButton());
    expect(haptic.warning).toHaveBeenCalledTimes(1);
  });

  // #32: 햅틱은 결과다. 서버가 거절을 받은 뒤에만 울린다
  it('거절이 실패하면 경고 햅틱을 울리지 않는다', async () => {
    jest.mocked(haptic.warning).mockClear();
    await renderReject({
      onSubmit: jest.fn(async () => {
        throw new Error('실패');
      }),
    });

    await userEvent.press(option('일정이 맞지 않습니다'));
    await userEvent.press(submitButton());

    expect(haptic.warning).not.toHaveBeenCalled();
  });

  it('사유 없이 누르거나 기타 내용이 비어 제출되지 않으면 경고 햅틱을 울리지 않는다', async () => {
    jest.mocked(haptic.warning).mockClear();
    await renderReject();
    await userEvent.press(submitButton());
    await userEvent.press(otherOption());
    await userEvent.press(submitButton());
    expect(haptic.warning).not.toHaveBeenCalled();
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

  // 고른 사유를 다시 누르면 선택을 푼다 (#101)
  describe('다시 눌러 선택 풀기', () => {
    it('고른 사유를 다시 누르면 아무것도 고르지 않은 상태가 되고 거절 제출이 비활성이 된다', async () => {
      const onSubmit = jest.fn();
      await renderReject({ onSubmit });
      const schedule = option('일정이 맞지 않습니다');

      await userEvent.press(schedule);
      expect(schedule).toBeChecked();
      await userEvent.press(schedule);

      // 스크린리더는 선택 해제(checked false)를 읽는다
      expect(schedule).not.toBeChecked();
      expect(
        screen
          .getAllByRole('radio')
          .filter(radio => radio.props.accessibilityState?.checked),
      ).toEqual([]);
      expect(schedule).toHaveStyle({
        borderColor: colors.gray[200],
      });
      expect(submitButton()).toBeDisabled();
      await userEvent.press(submitButton());
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('푼 뒤 다른 사유를 누르면 그 사유를 고른다', async () => {
      await renderReject();

      await userEvent.press(option('일정이 맞지 않습니다'));
      await userEvent.press(option('일정이 맞지 않습니다'));
      await userEvent.press(option('작업 위치가 너무 멉니다'));

      expect(option('작업 위치가 너무 멉니다')).toBeChecked();
      expect(option('일정이 맞지 않습니다')).not.toBeChecked();
      expect(submitButton()).toBeEnabled();
    });

    it('펼친 기타를 다시 누르면 선택이 풀리고 키보드를 내리며 입력란을 접는다', async () => {
      const timing = jest.spyOn(Animated, 'timing');
      const dismiss = jest.spyOn(Keyboard, 'dismiss');
      await renderReject();

      await userEvent.press(otherOption());
      await finishAnimations();
      await userEvent.type(otherInput()!, '개인 사정');
      await userEvent.press(otherOption());

      expect(otherOption()).not.toBeChecked();
      expect(otherOption()).toBeCollapsed();
      expect(dismiss).toHaveBeenCalledTimes(1);
      expect(timing).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ toValue: 0, useNativeDriver: true }),
      );
      expect(submitButton()).toBeDisabled();
      // 접히는 동안 화면에는 남지만 스크린리더에서는 바로 숨기고, 다 접히면 내린다
      expect(otherInput()).toBeNull();
      await finishAnimations();
      expect(otherInputEvenHidden()).toBeNull();

      // 다시 기타를 고르면 쓰던 글이 남아 있다
      await userEvent.press(otherOption());
      expect(otherInput()).toHaveDisplayValue('개인 사정');
    });

    it('기타를 펼치는 중에 다시 누르면 접히고, 스크린리더 포커스를 입력란으로 옮기지 않는다', async () => {
      const focus = spyScreenReaderFocus();
      await renderReject();

      await userEvent.press(otherOption());
      await userEvent.press(otherOption());
      await finishAnimations();

      expect(otherOption()).not.toBeChecked();
      expect(otherInputEvenHidden()).toBeNull();
      expect(focus).not.toHaveBeenCalled();
    });

    it('비워서 제출해 보인 안내도 기타를 풀면 지운다', async () => {
      await renderReject();

      await userEvent.press(otherOption());
      await userEvent.press(submitButton());
      expect(screen.getByText('기타 사유를 입력해 주세요.')).toBeOnTheScreen();

      await userEvent.press(otherOption());
      await finishAnimations();
      await userEvent.press(otherOption());

      expect(screen.queryByText('기타 사유를 입력해 주세요.')).toBeNull();
    });
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

    expect(onSubmit).toHaveBeenCalledWith({ key: 'distance', note: null });
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

    expect(onSubmit).toHaveBeenCalledWith({ key: 'other', note: '개인 사정' });
  });

  it('기타 사유는 255자까지 쓸 수 있다 (서버 한도)', async () => {
    await renderReject();

    await userEvent.press(otherOption());

    expect(otherInput()).toHaveProp('maxLength', 255);
  });

  it('제출을 보내는 동안 거절 제출이 잠기고, 다시 눌러도 한 번만 보낸다. 실패하면 풀린다', async () => {
    let finish: () => void = () => {};
    const onSubmit = jest.fn(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    await renderReject({ onSubmit });

    await userEvent.press(option('작업 위치가 너무 멉니다'));
    await userEvent.press(submitButton());
    await userEvent.press(submitButton());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(submitButton()).toBeDisabled();

    await act(async () => finish());
    expect(submitButton()).toBeEnabled();
  });

  it('선택지 사유로 제출하고, 취소·뒤로는 onBack 을 부른다', async () => {
    const onSubmit = jest.fn();
    const onBack = jest.fn();
    await renderReject({ onSubmit, onBack });

    await userEvent.press(option('작업 위치가 너무 멉니다'));
    await userEvent.press(submitButton());
    await userEvent.press(screen.getByRole('button', { name: '취소' }));
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onSubmit).toHaveBeenCalledWith({ key: 'distance', note: null });
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  // 앱이 종료됐다가 다시 열리면 기기에 남긴 초안으로 이어 고른다 (#34)
  describe('고르던 사유 이어 고르기', () => {
    it('기타 초안으로 열면 애니메이션 없이 펼친 채로 쓰던 글을 보이고, 키보드는 올리지 않는다', async () => {
      const timing = jest.spyOn(Animated, 'timing');
      await renderReject({
        initialDraft: { selected: 'other', otherText: '차량 고장' },
      });

      expect(otherOption()).toBeChecked();
      expect(otherOption()).toBeExpanded();
      expect(otherInput()).toHaveDisplayValue('차량 고장');
      expect(otherInput()).toHaveProp('autoFocus', false);
      expect(screen.getByTestId('reject-other-content')).toHaveStyle({
        opacity: 1,
      });
      expect(timing).not.toHaveBeenCalled();
      expect(submitButton()).toBeEnabled();
    });

    it('이어 고른 화면도 접었다 다시 펼치면 처음처럼 입력란에 포커스한다', async () => {
      await renderReject({
        initialDraft: { selected: 'other', otherText: '차량 고장' },
      });

      await userEvent.press(option('일정이 맞지 않습니다'));
      await finishAnimations();
      expect(otherInputEvenHidden()).toBeNull();

      await userEvent.press(otherOption());
      expect(otherInput()).toHaveProp('autoFocus', true);
      expect(otherInput()).toHaveDisplayValue('차량 고장');
    });

    it('다른 사유 초안으로 열면 그 사유를 고른 채로 열리고, 기타를 고르면 남겨 둔 글이 보인다', async () => {
      const onSubmit = jest.fn();
      await renderReject({
        onSubmit,
        initialDraft: { selected: 'distance', otherText: '차량 고장' },
      });

      expect(option('작업 위치가 너무 멉니다')).toBeChecked();
      expect(otherInputEvenHidden()).toBeNull();
      await userEvent.press(submitButton());
      expect(onSubmit).toHaveBeenCalledWith({ key: 'distance', note: null });

      await userEvent.press(otherOption());
      expect(otherInput()).toHaveDisplayValue('차량 고장');
    });

    it('고르거나 쓸 때마다 지금 선택과 글을 넘긴다', async () => {
      const onDraftChange = jest.fn();
      await renderReject({ onDraftChange });

      await userEvent.press(otherOption());
      expect(onDraftChange).toHaveBeenLastCalledWith({
        selected: 'other',
        otherText: '',
      });

      await userEvent.type(otherInput()!, '개인');
      expect(onDraftChange).toHaveBeenLastCalledWith({
        selected: 'other',
        otherText: '개인',
      });

      await userEvent.press(option('일정이 맞지 않습니다'));
      expect(onDraftChange).toHaveBeenLastCalledWith({
        selected: 'schedule',
        otherText: '개인',
      });
    });

    // 앱이 종료돼도 푼 상태로 다시 열리도록 초안에 남긴다 (#101)
    it('고른 사유를 다시 눌러 풀면 선택 없음과 쓴 글을 넘긴다', async () => {
      const onDraftChange = jest.fn();
      await renderReject({ onDraftChange });

      await userEvent.press(otherOption());
      await userEvent.type(otherInput()!, '개인');
      await userEvent.press(otherOption());
      expect(onDraftChange).toHaveBeenLastCalledWith({
        selected: null,
        otherText: '개인',
      });

      await userEvent.press(option('일정이 맞지 않습니다'));
      await userEvent.press(option('일정이 맞지 않습니다'));
      expect(onDraftChange).toHaveBeenLastCalledWith({
        selected: null,
        otherText: '개인',
      });
    });

    it('선택을 푼 초안으로 열면 아무것도 고르지 않은 채 열리고, 기타를 고르면 남겨 둔 글이 보인다', async () => {
      await renderReject({
        initialDraft: { selected: null, otherText: '차량 고장' },
      });

      expect(
        screen
          .getAllByRole('radio')
          .filter(radio => radio.props.accessibilityState?.checked),
      ).toEqual([]);
      expect(otherInputEvenHidden()).toBeNull();
      expect(submitButton()).toBeDisabled();

      await userEvent.press(otherOption());
      expect(otherInput()).toHaveDisplayValue('차량 고장');
    });
  });

  // Figma 스케줄 › 거절 사유: 처음 3239:9164, 선택 2714:12181, 기타 펼침 3227:8674, 입력 중 3239:9238
  describe('Figma 값', () => {
    it('소개는 제목·안내 문구 사이 12, 안내 문구 Caption/M/Medium Gray600 이고, 선택지와 48 떨어진다', async () => {
      await renderReject();

      const title = screen.getByText('작업을 거절할까요?');
      expect(title).toHaveStyle({
        ...typography['Body/XL/Bold'],
        color: colors.gray[900],
      });
      expect(
        screen.getByText(
          '거절 사유를 선택해 주세요. 사유는 등록 담당자에게 전달됩니다.',
        ),
      ).toHaveStyle({
        ...typography['Caption/M/Medium'],
        color: colors.gray[600],
      });
      expect(title.parent).toHaveStyle({ gap: 12 });
      // 소개 묶음 아래 여백 24 + 묶음 사이 24
      expect(
        StyleSheet.flatten(
          screen.getByTestId('reject-reason-scroll').props
            .contentContainerStyle,
        ),
      ).toEqual(
        expect.objectContaining({
          gap: 48,
          paddingHorizontal: 24,
          paddingTop: 24,
        }),
      );
    });

    it('선택지는 여백 20(높이 64)·모서리 12·Gray200 테두리로 8 씩 떨어지고, 글자는 Body/XS/SemiBold Gray800 이다', async () => {
      await renderReject();

      const radios = screen.getAllByRole('radio');
      expect(radios[0].parent).toHaveStyle({ gap: 8 });
      radios.forEach(radio =>
        expect(radio).toHaveStyle({
          padding: 20,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.gray[200],
        }),
      );
      expect(screen.getByText('일정이 맞지 않습니다')).toHaveStyle({
        ...typography['Body/XS/SemiBold'],
        color: colors.gray[800],
      });
      expect(screen.getByText('(직접 입력)')).toHaveStyle({
        ...typography['Body/XS/SemiBold'],
        color: colors.gray[500],
      });
    });

    it('직접 입력 섹션은 선택지와 24 떨어지고, 제목 Body/XS/Medium Gray900 과 입력란이 12 떨어진다', async () => {
      await renderReject();

      await userEvent.press(otherOption());

      const sectionTitle = screen.getByText('기타 사유를 직접 입력해 주세요');
      expect(sectionTitle).toHaveStyle({
        ...typography['Body/XS/Medium'],
        color: colors.gray[900],
      });
      expect(sectionTitle.parent).toHaveStyle({ gap: 12, paddingTop: 24 });
    });

    it('입력란은 높이 136·여백 16·모서리 12·Gray200 테두리, 글자 Body/XS/Medium Gray800, placeholder Gray600 이고, 비어서 제출하면 테두리가 Warning 이다', async () => {
      await renderReject();

      await userEvent.press(otherOption());

      const input = otherInput();
      expect(input).toHaveStyle({
        ...typography['Body/XS/Medium'],
        color: colors.gray[800],
        height: 136,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.gray[200],
      });
      expect(input).toHaveProp('placeholder', '거절 사유를 입력해 주세요.');
      expect(input).toHaveProp('placeholderTextColor', colors.gray[600]);

      await userEvent.press(submitButton());
      expect(otherInput()).toHaveStyle({ borderColor: colors.warning[1] });
    });

    it('아래 버튼은 CTA L(56) 두 개가 10 떨어지고, 위 여백 14, 아래는 안전 영역과 32 중 큰 값이다', async () => {
      await renderReject();

      const cancel = screen.getByRole('button', { name: '취소' });
      expect(cancel).toHaveStyle({ minHeight: 56 });
      expect(submitButton()).toHaveStyle({ minHeight: 56 });
      expect(cancel.parent).toHaveStyle({
        gap: 10,
        paddingTop: 14,
        paddingHorizontal: 24,
      });
      // 버튼 아래 32 는 홈 인디케이터 자리다. 안전 영역이 더 크면 그만큼, 없는 기기는 32 를 둔다
      expect(screen.root?.props.edges).toEqual(
        expect.objectContaining({ top: 'additive', bottom: 'maximum' }),
      );
      expect(screen.root).toHaveStyle({ paddingBottom: 32 });
    });

    it('사유를 고르기 전 거절 제출은 Disabled 변수(Primary 50%) 채움이다', async () => {
      await renderReject();

      expect(submitButton()).toHaveStyle({ backgroundColor: colors.disabled });
    });
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
