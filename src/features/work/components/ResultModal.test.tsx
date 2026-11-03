import { render, screen, userEvent } from '@testing-library/react-native';
import { escapeFrom, escapeTarget } from '../../../../jest/voiceOver';
import { colors } from '../../../shared/design-system';
import type { SubmitResult } from '../model';
import { ResultModal } from './ResultModal';

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
    expect(screen.getByText('고객 요청')).toHaveStyle({
      color: colors.warning[1],
    });
  });

  // Figma 는 한 줄이다. 폭이 모자랄 때만 자연스럽게 줄이 바뀐다
  it('작업 취소: 설명에 강제 줄바꿈이 없다', async () => {
    await render(
      <ResultModal
        visible
        result={{ kind: 'canceled', reason: '고객 요청', at: '10.01 15:15' }}
        onConfirm={jest.fn()}
      />,
    );

    const description = screen.getByText(
      '등록 담당자가 이 작업을 취소했습니다',
      { normalizer: text => text },
    );
    expect(description).toHaveTextContent(/^[^\n]+$/);
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

    // 지금은 배경색이 있어 네이티브 뷰가 된다. 배경색이 빠지면 escape 핸들러만 남아 Fabric 이 평탄화한다
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
