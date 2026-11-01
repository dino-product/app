import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import type { SubmitResult } from '../model';
import { ResultModal } from './ResultModal';

// 두 손가락 Z: VoiceOver 는 포커스한 요소에서 위로 올라가며 escape 를 받는 뷰를 찾는다.
// 모달 내용은 따로 띄운 뷰 계층이라 Modal 위로는 올라가지 않고, Modal 자신도 escape 를 받지 않는다
const escapeTarget = (title: string) => {
  for (
    let node = screen.getByRole('header', { name: title }).parent;
    node && node.type !== 'Modal';
    node = node.parent
  ) {
    if (node.props.onAccessibilityEscape) {
      return node;
    }
  }
  return null;
};
// RN 의 escape 이벤트는 버블링하지 않으므로 받는 뷰에 직접 보낸다
const escapeFrom = (title: string) => {
  const target = escapeTarget(title);
  if (!target) {
    throw new Error(`"${title}" 모달은 escape 를 받지 않는다`);
  }
  return fireEvent(target, 'accessibilityEscape');
};

describe('ResultModal', () => {
  it('제출 완료: 제목·안내·상태·제출 시간을 보여준다', async () => {
    await render(
      <ResultModal
        visible
        result={{ kind: 'submitted', at: '10.01 15:15' }}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.getByRole('header', { name: '제출 완료' })).toBeOnTheScreen();
    expect(screen.getByText('작업이 완료 처리되었습니다')).toBeOnTheScreen();
    expect(screen.getByText('완료')).toBeOnTheScreen();
    expect(screen.getByText('10.01 15:15')).toBeOnTheScreen();
  });

  it('작업 취소: 취소 사유를 Warning/1 로 강조한다', async () => {
    await render(
      <ResultModal
        visible
        result={{ kind: 'canceled', reason: '고객 요청', at: '10.01 15:15' }}
        onConfirm={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('header', { name: '작업이 취소되었습니다' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('등록 담당자가 이 작업을\n취소했습니다'),
    ).toBeOnTheScreen();
    expect(screen.getByText('고객 요청')).toHaveStyle({
      color: colors.warning[1],
    });
  });

  it('"메인 화면으로" 를 누르면 onConfirm 을 호출한다', async () => {
    const onConfirm = jest.fn();
    await render(
      <ResultModal
        visible
        result={{ kind: 'submitted', at: '10.01 15:15' }}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.press(
      screen.getByRole('button', { name: '메인 화면으로' }),
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // iOS 의 RN Modal 은 escape 를 처리하지 않아 모달 내용이 직접 받는다
  it.each<[string, SubmitResult]>([
    ['제출 완료', { kind: 'submitted', at: '10.01 15:15' }],
    [
      '작업이 취소되었습니다',
      { kind: 'canceled', reason: '고객 요청', at: '10.01 15:15' },
    ],
  ])(
    '%s: 두 손가락 Z 로 "메인 화면으로" 와 같이 닫는다',
    async (title, result) => {
      const onConfirm = jest.fn();
      await render(
        <ResultModal visible result={result} onConfirm={onConfirm} />,
      );

      await escapeFrom(title);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    },
  );

  it('escape 를 받는 뷰는 iOS 뷰 평탄화로 사라지지 않는다', async () => {
    await render(
      <ResultModal
        visible
        result={{ kind: 'submitted', at: '10.01 15:15' }}
        onConfirm={jest.fn()}
      />,
    );

    // Fabric 은 escape 핸들러만 있는 View 를 평탄화해 네이티브 뷰로 만들지 않는다
    expect(escapeTarget('제출 완료')?.props.collapsable).toBe(false);
  });

  it('visible 이 false 면 아무것도 그리지 않는다', async () => {
    await render(
      <ResultModal
        visible={false}
        result={{ kind: 'submitted', at: '10.01 15:15' }}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.queryByText('제출 완료')).not.toBeOnTheScreen();
  });
});
