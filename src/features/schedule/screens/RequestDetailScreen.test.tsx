import {
  act,
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { colors } from '../../../shared/design-system';
import { haptic } from '../../../shared/haptics';
import type { HostElement } from '../../../shared/testing/touchTarget';
import { workDetail } from '../../work/mockData';
import { RequestDetailScreen } from './RequestDetailScreen';

jest.mock('../../../shared/haptics', () => ({
  haptic: { success: jest.fn(), warning: jest.fn(), selection: jest.fn() },
}));

describe('RequestDetailScreen', () => {
  const renderRequest = (
    overrides: Partial<Parameters<typeof RequestDetailScreen>[0]> = {},
  ) =>
    render(
      <RequestDetailScreen
        work={workDetail}
        onBack={jest.fn()}
        onAccept={jest.fn(async () => true)}
        onReject={jest.fn()}
        onCall={jest.fn()}
        onNavigate={jest.fn()}
        {...overrides}
      />,
    );

  // #32: 햅틱은 결과다. 수락이 서버에서 성공한 뒤에만 울린다
  it('수락이 성공하면 성공 햅틱을, 거절 화면으로 갈 때는 울리지 않는다', async () => {
    jest.mocked(haptic.success).mockClear();
    await renderRequest();

    await userEvent.press(screen.getByRole('button', { name: '거절' }));
    expect(haptic.success).not.toHaveBeenCalled();

    await userEvent.press(screen.getByRole('button', { name: '수락' }));
    expect(haptic.success).toHaveBeenCalledTimes(1);
  });

  it('수락이 실패하면 햅틱을 울리지 않는다', async () => {
    jest.mocked(haptic.success).mockClear();
    await renderRequest({ onAccept: jest.fn(async () => false) });

    await userEvent.press(screen.getByRole('button', { name: '수락' }));

    expect(haptic.success).not.toHaveBeenCalled();
  });

  it('수락하는 동안 수락·거절이 잠기고, 끝나면 풀린다 (다시 눌러도 한 번만 보낸다)', async () => {
    let finish: (accepted: boolean) => void = () => {};
    const onAccept = jest.fn(
      () =>
        new Promise<boolean>(resolve => {
          finish = resolve;
        }),
    );
    await renderRequest({ onAccept });

    await userEvent.press(screen.getByRole('button', { name: '수락' }));
    await userEvent.press(screen.getByRole('button', { name: '수락' }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '수락' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '거절' })).toBeDisabled();

    await act(async () => finish(false));
    expect(screen.getByRole('button', { name: '수락' })).toBeEnabled();
  });

  it('작업 정보를 보여주고 하단의 거절·수락·뒤로가 콜백을 부른다', async () => {
    const onAccept = jest.fn();
    const onReject = jest.fn();
    const onBack = jest.fn();
    await render(
      <RequestDetailScreen
        work={workDetail}
        onBack={onBack}
        onAccept={onAccept}
        onReject={onReject}
        onCall={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );

    expect(screen.getByRole('header', { name: '작업 상세' })).toBeOnTheScreen();
    expect(screen.getByText('도어록 교체')).toBeOnTheScreen();
    expect(screen.getByText('박민지')).toBeOnTheScreen();
    expect(screen.getByText('75,000원')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '수락' }));
    await userEvent.press(screen.getByRole('button', { name: '거절' }));
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(onAccept).toHaveBeenCalled();
    expect(onReject).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });

  // 작업 정보 영역은 작업 수행 상세와 같은 컴포넌트를 쓴다
  it('작업 내용 카드는 회색 채움이다', async () => {
    await render(
      <RequestDetailScreen
        work={workDetail}
        onBack={jest.fn()}
        onAccept={jest.fn()}
        onReject={jest.fn()}
        onCall={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );

    expect(screen.getByTestId('work-content-card')).toHaveStyle({
      backgroundColor: colors.background[3],
    });
  });

  // Figma 2714:12494 아래 바(393x102): 거절·수락은 Bottom CTA L(56), 사이 10, 바 위 14·아래 32(홈 인디케이터 자리).
  // 거절 사유 화면의 아래 바와 같다
  it('하단 거절·수락은 높이 56 의 큰 버튼이고 사이 10, 바 위 14·아래 32 다', async () => {
    await renderRequest();

    const accept = screen.getByRole('button', { name: '수락' });
    const reject = screen.getByRole('button', { name: '거절' });
    for (const button of [accept, reject]) {
      expect(button).toHaveStyle({ minHeight: 56, borderRadius: 12 });
    }
    const actions = accept.parent as HostElement;
    expect(actions).toHaveStyle({ gap: 10, paddingTop: 14 });
    expect(actions.parent).toHaveStyle({ paddingBottom: 32 });
  });
  // #104: Figma 응답 필요 작업 상세 `2714-12494` 의 현장 사진 섹션
  describe('현장 사진 섹션', () => {
    it('제목 "현장 사진" 은 카드 바깥에 있고 카드 안에 주소와 사진 칸이 있다', async () => {
      await renderRequest();

      const title = screen.getByRole('header', { name: '현장 사진' });
      const card = screen.getByTestId('site-photo-card');
      expect(within(card).queryByText('현장 사진')).not.toBeOnTheScreen();
      expect(title).toBeOnTheScreen();
      expect(within(card).getByText('주소')).toBeOnTheScreen();
      expect(within(card).getByText(workDetail.address)).toBeOnTheScreen();
      expect(within(card).getAllByTestId('photo-thumb')).toHaveLength(
        workDetail.requestImages.length,
      );
    });

    it('카드는 흰 배경에 Gray100 테두리, 사진 칸은 110×110 이다', async () => {
      await renderRequest();

      expect(screen.getByTestId('site-photo-card')).toHaveStyle({
        backgroundColor: colors.white[100],
        borderColor: colors.gray[100],
        borderWidth: 1,
        borderRadius: 16,
        padding: 20,
        gap: 16,
      });
      expect(screen.getAllByTestId('photo-thumb')[0]).toHaveStyle({
        width: 110,
        height: 110,
        borderRadius: 10,
      });
    });

    it('보기 전용이다 (추가·삭제 버튼과 "n/6" 이 없다)', async () => {
      await renderRequest();

      expect(
        screen.queryByRole('button', { name: /사진.*(추가|삭제)/ }),
      ).not.toBeOnTheScreen();
      expect(screen.queryByText(/\/6/)).not.toBeOnTheScreen();
    });

    it('작업 내용 카드 안에는 작업 요청 이미지 줄이 없다', async () => {
      await renderRequest();

      expect(screen.queryByText('작업 요청 이미지')).not.toBeOnTheScreen();
    });

    it('사진이 없어도 섹션은 주소와 함께 남는다', async () => {
      await renderRequest({ work: { ...workDetail, requestImages: [] } });

      expect(
        screen.getByRole('header', { name: '현장 사진' }),
      ).toBeOnTheScreen();
      expect(screen.queryAllByTestId('photo-thumb')).toHaveLength(0);
    });
  });
});
