import { render, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { escapeFrom, escapeTarget } from '../../../../../jest/voiceOver';
import { colors, typography } from '../../../../shared/design-system';
import { NoticeModal } from './NoticeModal';

// 회사 참여 결과 안내 모달. Figma 마이페이지 › 회사찾기 - 이미 참여(51028:17074)의 Modal(51028:17133):
// 회사 찾기 화면 위 검정 50%, 카드 폭 262·모서리 24(변수 모달)·좌우 20. 위 24 의 제목 → 위아래 12 안의 설명 → 위 16·아래 24 안의 확인
const notice = {
  title: '이미 참여 중인 회사예요',
  message:
    '오빗 서비스에 이미 소속되어 있어\n참여 요청을 다시 보낼 수 없습니다.',
};

describe('NoticeModal', () => {
  it('제목·설명·확인을 보여주고, 확인·두 손가락 Z 로 닫는다', async () => {
    const onClose = jest.fn();
    await render(<NoticeModal notice={notice} onClose={onClose} />);

    expect(
      screen.getByRole('header', { name: notice.title }),
    ).toBeOnTheScreen();
    expect(screen.getByText(notice.message)).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: '확인' }));
    await escapeFrom(notice.title);

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('notice 가 없으면 띄우지 않는다', async () => {
    await render(<NoticeModal notice={null} onClose={jest.fn()} />);

    expect(screen.queryByRole('header', { name: notice.title })).toBeNull();
  });

  describe('Figma 값 (51028:17133)', () => {
    it('뒤 배경은 검정 50% 이다', async () => {
      await render(<NoticeModal notice={notice} onClose={jest.fn()} />);

      expect(escapeTarget(notice.title)).toHaveStyle({
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      });
    });

    it('카드는 폭 262·모서리 24·좌우 20 이고 흰 채움이다. 위아래 여백은 안쪽 묶음이 갖는다', async () => {
      await render(<NoticeModal notice={notice} onClose={jest.fn()} />);

      const card = screen.getByTestId('notice-modal-card');
      expect(card).toHaveStyle({
        width: 262,
        borderRadius: 24,
        paddingHorizontal: 20,
        backgroundColor: colors.white[100],
      });
      const style = StyleSheet.flatten(card.props.style);
      expect(style.padding ?? 0).toBe(0);
      expect(style.paddingVertical ?? 0).toBe(0);
      expect(style.paddingTop ?? 0).toBe(0);
    });

    // Frame 2117905339: 위 24. 제목 Body/S/Bold, 변수 Gray800(#222222) = 로컬 Gray900 값, 가운데
    it('제목은 위 24 에 Body/S/Bold #222222 가운데다', async () => {
      await render(<NoticeModal notice={notice} onClose={jest.fn()} />);

      const title = screen.getByRole('header', { name: notice.title });
      expect(title).toHaveStyle({
        ...typography['Body/S/Bold'],
        color: colors.gray[900],
        textAlign: 'center',
      });
      expect(title.parent).toHaveStyle({ paddingTop: 24 });
    });

    // Frame 14: 위아래 12 안에 Caption/M/Medium, 색은 라이브러리 Gray500(#7F7F7F)
    it('설명은 위아래 12 안에 Caption/M/Medium 라이브러리 Gray500 가운데다', async () => {
      await render(<NoticeModal notice={notice} onClose={jest.fn()} />);

      const message = screen.getByText(notice.message);
      expect(message).toHaveStyle({
        ...typography['Caption/M/Medium'],
        color: colors.libraryGray[500],
        textAlign: 'center',
      });
      expect(message.parent).toHaveStyle({ paddingVertical: 12 });
    });

    // Frame 10: 버튼 위 16·아래 24
    it('확인은 설명 아래 16, 카드 아래 끝에서 24 위다', async () => {
      await render(<NoticeModal notice={notice} onClose={jest.fn()} />);

      expect(screen.getByRole('button', { name: '확인' }).parent).toHaveStyle({
        paddingTop: 16,
        paddingBottom: 24,
      });
    });
  });
});
