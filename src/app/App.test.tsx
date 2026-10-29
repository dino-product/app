import { render, screen, userEvent } from '@testing-library/react-native';
import { BackHandler, Linking } from 'react-native';
import App from './App';

describe('App', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('첫 화면은 작업 수행 메인화면(내 작업)이다', async () => {
    await render(<App />);

    expect(screen.getByRole('header', { name: '내 작업' })).toBeOnTheScreen();
  });

  it('작업을 열면 작업 상세로, 뒤로 가기로 메인화면으로 돌아온다', async () => {
    await render(<App />);

    await userEvent.press(
      screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
    );
    expect(screen.getByRole('header', { name: '작업 상세' })).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(screen.getByRole('header', { name: '내 작업' })).toBeOnTheScreen();
  });

  it('작업을 시작하고 상세에 다녀와도 "작업 수행중" 이 유지된다', async () => {
    await render(<App />);

    await userEvent.press(screen.getByRole('button', { name: '작업 시작' }));
    await userEvent.press(screen.getByRole('button', { name: '작업 수행중' }));
    await userEvent.press(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(
      screen.getByRole('button', { name: '작업 수행중' }),
    ).toBeOnTheScreen();
  });

  it('Android 뒤로가기를 누르면 상세에서 메인화면으로 돌아온다', async () => {
    const listeners: Array<Parameters<typeof BackHandler.addEventListener>[1]> =
      [];
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        listeners.push(handler);
        return { remove: jest.fn() };
      });
    await render(<App />);

    await userEvent.press(
      screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
    );
    const handled = listeners[listeners.length - 1](
      // RN 0.88 의 핸들러는 이벤트 인자를 받지만 App 은 쓰지 않는다
      undefined as never,
    );

    expect(handled).toBe(true);
    expect(
      await screen.findByRole('header', { name: '내 작업' }),
    ).toBeOnTheScreen();
  });

  it('완료 보고를 제출하고 메인으로 돌아오면 다시 "작업 시작" 상태다', async () => {
    await render(<App />);

    await userEvent.press(screen.getByRole('button', { name: '작업 시작' }));
    await userEvent.press(screen.getByRole('button', { name: '작업 수행중' }));
    await userEvent.press(
      screen.getByRole('button', { name: '작업 전 사진 추가' }),
    );
    await userEvent.press(
      screen.getByRole('button', { name: '작업 후 사진 추가' }),
    );
    await userEvent.type(screen.getByLabelText('결제 금액 입력'), '75000');
    await userEvent.press(
      screen.getByRole('button', { name: '결제 방식 선택' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '카드' }));
    await userEvent.press(
      screen.getByRole('button', { name: '완료보고 제출' }),
    );
    await userEvent.press(
      await screen.findByRole('button', { name: '메인 화면으로' }),
    );

    expect(screen.getByRole('button', { name: '작업 시작' })).toBeOnTheScreen();
  });

  it('상세에서 하단 탭 "홈" 을 누르면 메인화면으로 돌아온다', async () => {
    await render(<App />);

    await userEvent.press(
      screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
    );
    await userEvent.press(screen.getByRole('tab', { name: '홈' }));

    expect(screen.getByRole('header', { name: '내 작업' })).toBeOnTheScreen();
  });

  it('전화·길찾기 링크를 열지 못해도 앱이 처리되지 않은 오류를 내지 않는다', async () => {
    const openURL = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValue(new Error('no handler'));
    await render(<App />);

    await userEvent.press(
      screen.getByRole('button', { name: '보일러 점검 상세 보기' }),
    );
    await userEvent.press(
      screen.getByRole('button', { name: '박민지 고객에게 전화' }),
    );
    await userEvent.press(screen.getByRole('button', { name: '길찾기' }));

    expect(openURL).toHaveBeenCalledWith('tel:010-1234-5678');
    expect(openURL).toHaveBeenLastCalledWith(
      expect.stringMatching(/^(https:\/\/maps\.apple\.com\/\?q=|geo:0,0\?q=)/),
    );
  });

  describe('내 일정', () => {
    async function openSchedule() {
      await render(<App />);
      await userEvent.press(screen.getByRole('tab', { name: '내 일정' }));
    }

    it('하단 탭으로 내 일정과 홈을 오간다', async () => {
      await openSchedule();
      expect(screen.getByRole('header', { name: '내 일정' })).toBeOnTheScreen();

      await userEvent.press(screen.getByRole('tab', { name: '홈' }));
      expect(screen.getByRole('header', { name: '내 작업' })).toBeOnTheScreen();
    });

    it('응답 필요 요청을 수락하면 목록에서 빠진다', async () => {
      await openSchedule();
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      const before = screen.getAllByRole('button', { name: /수락$/ }).length;

      await userEvent.press(
        screen.getAllByRole('button', { name: /수락$/ })[0],
      );

      expect(screen.queryAllByRole('button', { name: /수락$/ })).toHaveLength(
        before - 1,
      );
    });

    it('거절하면 거절 사유를 받고 요청을 목록에서 뺀다', async () => {
      await openSchedule();
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      const before = screen.getAllByRole('button', { name: /거절$/ }).length;

      await userEvent.press(
        screen.getAllByRole('button', { name: /거절$/ })[0],
      );
      expect(
        screen.getByRole('header', { name: '거절 사유' }),
      ).toBeOnTheScreen();
      await userEvent.press(
        screen.getByRole('radio', { name: '일정이 맞지 않습니다' }),
      );
      await userEvent.press(screen.getByRole('button', { name: '거절 제출' }));

      expect(screen.getByRole('header', { name: '내 일정' })).toBeOnTheScreen();
      expect(screen.queryAllByRole('button', { name: /거절$/ })).toHaveLength(
        before - 1,
      );
    });

    it('요청 상세에서 수락하면 내 일정으로 돌아오고 요청이 빠진다', async () => {
      await openSchedule();
      await userEvent.press(screen.getByRole('tab', { name: /^응답 필요/ }));
      const before = screen.getAllByRole('button', { name: /수락$/ }).length;

      await userEvent.press(
        screen.getAllByRole('button', { name: / 상세,/ })[0],
      );
      expect(
        screen.getByRole('header', { name: '작업 상세' }),
      ).toBeOnTheScreen();
      await userEvent.press(screen.getByRole('button', { name: '수락' }));

      expect(screen.getByRole('header', { name: '내 일정' })).toBeOnTheScreen();
      expect(screen.queryAllByRole('button', { name: /수락$/ })).toHaveLength(
        before - 1,
      );
    });
  });
});
