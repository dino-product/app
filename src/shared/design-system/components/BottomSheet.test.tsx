import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, NativeModules, Text } from 'react-native';
import { drag } from '../../../../jest/gesture';
import { BottomSheet } from './BottomSheet';

// jest 프리셋의 네이티브 애니메이션 목은 16ms 뒤에 저절로 끝난다. 끝내는 시점을 테스트가 정한다
let runningAnimations: Array<(result: { finished: boolean }) => void> = [];
const finishAnimations = () =>
  act(() => {
    runningAnimations.splice(0).forEach(end => end({ finished: true }));
  });

const reduceMotion = async () => {
  jest
    .mocked(AccessibilityInfo.isReduceMotionEnabled)
    .mockResolvedValueOnce(true);
};

const sheet = (visible: boolean, onClose = jest.fn()) => (
  <BottomSheet visible={visible} onClose={onClose} testID="sheet">
    <Text>시트 내용</Text>
  </BottomSheet>
);

const content = () => screen.queryByText('시트 내용');
// 시트를 감싼 RN Modal (호스트 요소 이름이 Modal 이다)
const modal = () => {
  let node = screen.getByTestId('sheet').parent;
  while (node && node.type !== 'Modal') {
    node = node.parent;
  }
  if (!node) {
    throw new Error('시트가 Modal 안에 있지 않다');
  }
  return node;
};
const dragArea = () => screen.getByTestId('sheet-content').props;

describe('BottomSheet', () => {
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

  it('닫혀 있으면 그리지 않고, 열면 내용을 모달로 띄운다', async () => {
    const { rerender } = await render(sheet(false));
    expect(content()).toBeNull();

    await rerender(sheet(true));

    expect(content()).toBeOnTheScreen();
    expect(modal().props.visible).toBe(true);
    // Android 는 상태·내비게이션 바 뒤까지 배경을 깐다 (edge-to-edge)
    expect(modal().props).toMatchObject({
      transparent: true,
      statusBarTranslucent: true,
      navigationBarTranslucent: true,
    });
  });

  it('올라오는 애니메이션은 UI 스레드(네이티브 드라이버)에서 돈다', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(sheet(true));

    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 1, useNativeDriver: true }),
    );
  });

  it('동작 줄이기가 켜져 있으면 애니메이션 없이 띄우고 닫는다', async () => {
    await reduceMotion();
    const timing = jest.spyOn(Animated, 'timing');
    const { rerender } = await render(sheet(false));
    // 설정을 읽은 뒤에 연다
    await act(async () => {});

    await rerender(sheet(true));
    expect(content()).toBeOnTheScreen();
    await rerender(sheet(false));

    expect(timing).not.toHaveBeenCalled();
    expect(content()).toBeNull();
  });

  it('닫으면 내려가는 애니메이션이 끝난 뒤 모달을 내린다', async () => {
    const { rerender } = await render(sheet(true));
    await finishAnimations();

    await rerender(sheet(false));
    expect(content()).toBeOnTheScreen();

    await finishAnimations();
    expect(content()).toBeNull();
  });

  it('다시 열 때 끌어내렸던 거리도 네이티브 애니메이션으로 되돌린다', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(sheet(true));

    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 0, useNativeDriver: true }),
    );
  });

  it('내려가는 중에 다시 열면 그대로 열린 채로 남는다', async () => {
    const { rerender } = await render(sheet(true));
    await finishAnimations();

    await rerender(sheet(false));
    await rerender(sheet(true));
    await finishAnimations();

    expect(content()).toBeOnTheScreen();
  });

  it('다 내려가 모달을 내린 뒤에 onClosed 를 부른다 (그 뒤에 화면을 옮기거나 포커스를 옮긴다)', async () => {
    const onClosed = jest.fn();
    const withClosed = (visible: boolean) => (
      <BottomSheet
        visible={visible}
        onClose={jest.fn()}
        onClosed={onClosed}
        testID="sheet"
      >
        <Text>시트 내용</Text>
      </BottomSheet>
    );
    const { rerender } = await render(withClosed(true));
    await finishAnimations();

    await rerender(withClosed(false));
    expect(onClosed).not.toHaveBeenCalled();
    await finishAnimations();

    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(content()).toBeNull();
  });

  // '닫기' 뒤 내려가는 동안 '취소' 를 누르거나 같은 버튼을 두 번 누르지 않게
  it('내려가는 동안에는 시트를 누를 수 없다', async () => {
    const { rerender } = await render(sheet(true));
    await finishAnimations();
    expect(screen.getByTestId('sheet')).toHaveProp('pointerEvents', 'auto');

    await rerender(sheet(false));

    expect(screen.getByTestId('sheet')).toHaveProp('pointerEvents', 'none');
  });

  it('배경을 누르면 닫기를 요청한다', async () => {
    const onClose = jest.fn();
    await render(sheet(true, onClose));

    await fireEvent.press(
      screen.getByTestId('sheet-backdrop', { includeHiddenElements: true }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('배경은 스크린리더에서 숨긴다 (닫기는 시트 버튼·두 손가락 Z·뒤로가기로)', async () => {
    await render(sheet(true));

    expect(
      screen.getByTestId('sheet-backdrop', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('sheet-backdrop')).toBeNull();
  });

  it('Android 뒤로가기는 닫기를 요청한다', async () => {
    const onClose = jest.fn();
    await render(sheet(true, onClose));

    await act(() => modal().props.onRequestClose());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('VoiceOver 두 손가락 Z 는 닫기를 요청한다', async () => {
    const onClose = jest.fn();
    await render(sheet(true, onClose));

    const panel = screen.getByTestId('sheet');
    expect(panel).toHaveProp('accessibilityViewIsModal', true);
    expect(panel).toHaveProp('collapsable', false);
    await fireEvent(panel, 'accessibilityEscape');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('아래로 끌기', () => {
    it('충분히 끌어내리면 닫기를 요청한다', async () => {
      const onClose = jest.fn();
      await render(sheet(true, onClose));

      const result = await drag(dragArea(), { dy: 160 });

      expect(result.granted).toBe(true);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('끄는 도중에 바깥이 다시 그려져도 같은 응답자를 쓴다', async () => {
      const { rerender } = await render(sheet(true));
      const before = dragArea().onResponderMove;

      await rerender(sheet(true, jest.fn()));

      expect(dragArea().onResponderMove).toBe(before);
    });

    it('조금만 끌면 닫지 않고 제자리로 돌아간다', async () => {
      const onClose = jest.fn();
      const spring = jest.spyOn(Animated, 'spring');
      await render(sheet(true, onClose));

      await drag(dragArea(), { dy: 40 });

      expect(onClose).not.toHaveBeenCalled();
      expect(spring).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ toValue: 0, useNativeDriver: true }),
      );
    });

    it('위로 끌거나 가로로 밀면 받지 않는다 (시트 안 버튼·스크롤 몫)', async () => {
      const onClose = jest.fn();
      await render(sheet(true, onClose));
      const handlers = dragArea();

      expect((await drag(handlers, { dy: -120 })).granted).toBe(false);
      expect((await drag(handlers, { dx: 120, dy: 20 })).granted).toBe(false);
      expect(onClose).not.toHaveBeenCalled();
    });
  });
  describe('모양 (Figma 시트마다 다르다)', () => {
    it('기본은 신청 취소 시트(2889:13197) 모양이다: 손잡이, 위 모서리 24, 아래는 안전 영역 + 16', async () => {
      await render(sheet(true));

      expect(
        screen.getByTestId('sheet-handle', { includeHiddenElements: true }),
      ).toBeTruthy();
      expect(screen.getByTestId('sheet')).toHaveStyle({
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      });
      expect(screen.getByTestId('sheet-content')).toHaveStyle({
        paddingTop: 12,
        paddingHorizontal: 24,
        paddingBottom: 16,
      });
    });

    it('document 는 약관 동의 시트(3569:7702) 모양이다: 손잡이 없이 위 모서리 28, 위 24·아래 36, 좌우 여백은 내용이 정한다', async () => {
      await render(
        <BottomSheet
          visible
          onClose={jest.fn()}
          variant="document"
          testID="sheet"
        >
          <Text>시트 내용</Text>
        </BottomSheet>,
      );

      expect(
        screen.queryByTestId('sheet-handle', { includeHiddenElements: true }),
      ).toBeNull();
      expect(screen.getByTestId('sheet')).toHaveStyle({
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
      });
      expect(screen.getByTestId('sheet-content')).toHaveStyle({
        paddingTop: 24,
        paddingHorizontal: 0,
        paddingBottom: 36,
      });
    });
  });
});
