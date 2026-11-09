import { render, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { escapeFrom, escapeTarget } from '../../../../jest/voiceOver';
import { colors, typography } from '../../../shared/design-system';
import { iconSvgs } from '../../../shared/design-system/icons/svgs';
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

  // #180: Figma 제출 완료(2741:22853)·작업 취소(2741:26603) 모달
  describe('Figma 모달 값', () => {
    const submitted: SubmitResult = { kind: 'submitted', at: '10.01 15:15' };
    const canceled: SubmitResult = {
      kind: 'canceled',
      reason: '고객 요청',
      at: '10.01 15:15',
    };
    const titleOf = (result: SubmitResult) =>
      result.kind === 'submitted' ? '제출 완료' : '작업이 취소되었습니다';
    const descriptionOf = (result: SubmitResult) =>
      result.kind === 'submitted'
        ? '작업이 완료 처리되었습니다'
        : '등록 담당자가 이 작업을 취소했습니다';

    it.each([submitted, canceled])(
      '뒤 배경은 검정 50% 이다 (%o)',
      async result => {
        await render(
          <ResultModal visible result={result} onConfirm={jest.fn()} />,
        );

        expect(escapeTarget(titleOf(result))).toHaveStyle({
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        });
      },
    );

    // Modal 262: 모서리 24, 좌우 20, 위아래 여백 없음(위 묶음이 24, 아래 버튼 묶음이 16·24 를 갖는다)
    it.each([submitted, canceled])(
      '카드는 폭 262·모서리 24·좌우 20 이고 흰 채움이다 (%o)',
      async result => {
        await render(
          <ResultModal visible result={result} onConfirm={jest.fn()} />,
        );

        const card = screen.getByTestId('result-modal-card');
        expect(card).toHaveStyle({
          width: 262,
          borderRadius: 24,
          paddingHorizontal: 20,
          backgroundColor: colors.white[100],
        });
        const style = StyleSheet.flatten(card.props.style);
        expect(style.padding ?? 0).toBe(0);
        expect(style.paddingVertical ?? 0).toBe(0);
      },
    );

    // Frame 2117905339: 위 24, 아이콘 40 과 제목 사이 16. 제목 Body/S/Bold Gray900(#222222) 가운데
    it.each([submitted, canceled])(
      '아이콘은 위 24 에 있고 제목은 그 아래 16 이다 (%o)',
      async result => {
        await render(
          <ResultModal visible result={result} onConfirm={jest.fn()} />,
        );

        const title = screen.getByRole('header', { name: titleOf(result) });
        expect(title).toHaveStyle({
          ...typography['Body/S/Bold'],
          color: colors.gray[900],
          textAlign: 'center',
        });
        expect(title.parent).toHaveStyle({
          paddingTop: 24,
          gap: 16,
          alignItems: 'center',
        });
      },
    );

    // Frame 14: 위아래 12 안에 Caption/M/Medium, 색은 라이브러리 Gray500(#7F7F7F)
    it.each([submitted, canceled])(
      '설명은 위아래 12 안에 Caption/M/Medium 라이브러리 Gray500 가운데다 (%o)',
      async result => {
        await render(
          <ResultModal visible result={result} onConfirm={jest.fn()} />,
        );

        const description = screen.getByText(descriptionOf(result));
        expect(description).toHaveStyle({
          ...typography['Caption/M/Medium'],
          color: colors.libraryGray[500],
          textAlign: 'center',
        });
        expect(description.parent).toHaveStyle({ paddingVertical: 12 });
      },
    );

    // Frame 2147239460: 모서리 8 Gray50, 안쪽 12, 두 줄 사이 4
    it.each([submitted, canceled])(
      '요약 상자는 Gray50·모서리 8·안쪽 12, 줄 사이 4 다 (%o)',
      async result => {
        await render(
          <ResultModal visible result={result} onConfirm={jest.fn()} />,
        );

        const summary = screen.getByText('10.01 15:15').parent?.parent;
        expect(summary).toHaveStyle({
          padding: 12,
          gap: 4,
          borderRadius: 8,
          backgroundColor: colors.gray[50],
        });
      },
    );

    // Frame 10: 버튼 위 16·아래 24
    it('"메인 화면으로" 버튼은 요약 아래 16, 카드 아래 끝에서 24 위다', async () => {
      await render(
        <ResultModal visible result={submitted} onConfirm={jest.fn()} />,
      );

      expect(
        screen.getByRole('button', { name: '메인 화면으로' }).parent,
      ).toHaveStyle({ paddingTop: 16, paddingBottom: 24 });
    });

    // App Icon(3166:3162)은 Select/1 단색 원에 Secondary 체크다. 온보딩의 modal-check(그라데이션 원)와 다르다
    it('제출 완료 아이콘은 Figma 에서 내보낸 Select/1 원 체크다', async () => {
      await render(
        <ResultModal visible result={submitted} onConfirm={jest.fn()} />,
      );

      const icon = screen.getByTestId('result-modal-icon', {
        includeHiddenElements: true,
      });
      expect(icon).toHaveStyle({ width: 40, height: 40 });
      const [svg] = icon.children;
      expect(typeof svg === 'string' ? svg : svg.props.xml).toBe(
        iconSvgs['submit-check'].xml,
      );
      expect(iconSvgs['submit-check'].xml).toContain(
        'fill="#4F3BFE" fill-opacity="0.06"',
      );
    });

    it('취소 아이콘은 Warning/2 원에 Warning/1 × 다', async () => {
      await render(
        <ResultModal visible result={canceled} onConfirm={jest.fn()} />,
      );

      const [svg] = screen.getByTestId('result-modal-icon', {
        includeHiddenElements: true,
      }).children;
      expect(typeof svg === 'string' ? svg : svg.props.xml).toBe(
        iconSvgs['modal-x'].xml,
      );
    });
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
